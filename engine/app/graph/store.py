import json
from datetime import datetime, timezone

import numpy as np

from .model import DocInfo, Finding


def _now():
    return datetime.now(timezone.utc)


def everyone_id(conn, ws: str) -> str:
    row = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (ws,)
    ).fetchone()
    return str(row[0]) if row else ""


def group_count(conn, ws: str) -> int:
    return conn.execute("SELECT count(*) FROM groups WHERE workspace_id=%s", (ws,)).fetchone()[0]


def group_names(conn, ws: str) -> dict[str, tuple[str, bool]]:
    """group id -> (name, is_default) for every group in the workspace."""
    rows = conn.execute(
        "SELECT id, name, is_default FROM groups WHERE workspace_id=%s", (ws,)
    ).fetchall()
    return {str(r[0]): (r[1], bool(r[2])) for r in rows}


def load_docs(conn, ws: str) -> list[DocInfo]:
    """One DocInfo per document with >=1 embedded chunk. Mean chunk vector,
    its document_groups, age in days, and whether any chunk was ever retrieved."""
    # Mean vector per doc, computed by pgvector's avg(vector) aggregate rather than
    # streaming every chunk embedding into Python (~4 KB per chunk at 1024 dims).
    rows = conn.execute(
        "SELECT c.document_id, AVG(c.embedding), MIN(d.created_at) "
        "FROM chunks c JOIN documents d ON d.id = c.document_id "
        "WHERE c.workspace_id=%s AND c.embedding IS NOT NULL "
        "GROUP BY c.document_id",
        (ws,),
    ).fetchall()
    means: dict[str, np.ndarray] = {}
    created: dict[str, datetime] = {}
    for did, mean, cat in rows:
        # register_vector() hands back pgvector.Vector wrappers, not numpy arrays.
        vec = mean.to_numpy() if hasattr(mean, "to_numpy") else np.asarray(mean, dtype=float)
        means[str(did)] = vec.astype(float)
        created[str(did)] = cat
    # Groups per doc.
    grp: dict[str, set[str]] = {}
    for did, gid in conn.execute(
        "SELECT document_id, group_id FROM document_groups WHERE workspace_id=%s", (ws,)
    ).fetchall():
        grp.setdefault(str(did), set()).add(str(gid))
    # Retrieved chunk ids ever logged -> the set of doc ids that own them.
    #
    # ONE query, not one per log row. This used to issue a chunks lookup inside
    # the loop over query_log, so a workspace with 10k logged questions ran 10k
    # queries to compute a single boolean per document — and load_docs is called
    # twice per document-graph request. Unioning the ids first is the whole fix;
    # the chunk id set is bounded by final_k (8) per query and de-duplicates
    # heavily across questions, so it stays small even when the log does not.
    all_chunk_ids: set[str] = set()
    for (chunk_ids,) in conn.execute(
        "SELECT retrieved_chunk_ids FROM query_log "
        "WHERE workspace_id=%s AND retrieved_chunk_ids IS NOT NULL",
        (ws,),
    ).fetchall():
        if chunk_ids:
            all_chunk_ids.update(str(c) for c in chunk_ids)
    retrieved_docs: set[str] = set()
    if all_chunk_ids:
        retrieved_docs = {
            str(r[0])
            for r in conn.execute(
                "SELECT DISTINCT document_id FROM chunks "
                "WHERE workspace_id=%s AND id = ANY(%s::uuid[])",
                (ws, list(all_chunk_ids)),
            ).fetchall()
        }
    now = _now()
    out: list[DocInfo] = []
    for did, mean in means.items():
        age = (now - created[did]).total_seconds() / 86400 if created.get(did) else 0.0
        out.append(DocInfo(did, grp.get(did, set()), mean, age, did in retrieved_docs))
    out.sort(key=lambda d: d.id)  # stable order for determinism
    return out


def start_job(conn, ws: str) -> str:
    row = conn.execute(
        "INSERT INTO graph_build_jobs (workspace_id, status, started_at) "
        "VALUES (%s,'running',%s) RETURNING id",
        (ws, _now()),
    ).fetchone()
    return str(row[0])


def finish_job(conn, ws: str, job_id: str, error: str | None = None) -> None:
    conn.execute(
        "UPDATE graph_build_jobs SET status=%s, error=%s, finished_at=%s "
        "WHERE id=%s AND workspace_id=%s",
        ("failed" if error else "done", error, _now(), job_id, ws),
    )


def latest_job(conn, ws: str) -> dict | None:
    r = conn.execute(
        "SELECT id,status,error,finished_at FROM graph_build_jobs "
        "WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 1",
        (ws,),
    ).fetchone()
    if not r:
        return None
    return {"id": str(r[0]), "status": r[1], "error": r[2],
            "computed_at": r[3].isoformat() if r[3] else None}


def _vec_lit(v) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


def write_build(conn, ws, topics: list[dict], doc_meta: dict, findings: list[Finding]) -> None:
    """Replace the workspace's graph atomically. `topics` carry `doc_ids`."""
    with conn.transaction():
        conn.execute("DELETE FROM graph_findings WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_doc_meta WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_topic_members WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_topics WHERE workspace_id=%s", (ws,))
        topic_ids: list[str] = []
        for t in topics:
            row = conn.execute(
                "INSERT INTO graph_topics (workspace_id,label,keywords,centroid,doc_count,x,y) "
                "VALUES (%s,%s,%s,%s::vector,%s,%s,%s) RETURNING id",
                (ws, t["label"], t["keywords"], _vec_lit(t["centroid"]),
                 len(t["doc_ids"]), t["x"], t["y"]),
            ).fetchone()
            tid = str(row[0])
            topic_ids.append(tid)
            if t["doc_ids"]:
                conn.cursor().executemany(
                    "INSERT INTO graph_topic_members (topic_id,document_id,workspace_id) "
                    "VALUES (%s,%s,%s)",
                    [(tid, did, ws) for did in t["doc_ids"]])
        # executemany for the three bulk tables: an Atlas build writes one row
        # per document and one per finding, and a loop of execute() made each of
        # those a separate round-trip inside the same transaction.
        if doc_meta:
            conn.cursor().executemany(
                "INSERT INTO graph_doc_meta (document_id,workspace_id,topic_id,degree,"
                "exposure_score,is_orphan,last_retrieved_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [(did, ws, topic_ids[m["topic"]] if m["topic"] is not None else None,
                  m["degree"], m["exposure"], m["orphan"], m["last_retrieved_at"])
                 for did, m in doc_meta.items()])
        if findings:
            conn.cursor().executemany(
                "INSERT INTO graph_findings (workspace_id,kind,document_id,severity,detail,status) "
                "VALUES (%s,%s,%s,%s,%s,'open')",
                [(ws, f.kind, f.document_id, f.severity, json.dumps(f.detail)) for f in findings])


def read_topics(conn, ws: str, visible: set[str]) -> list[dict]:
    rows = conn.execute(
        "SELECT t.id,t.label,t.keywords,t.x,t.y, "
        " array_agg(m.document_id) FILTER (WHERE m.document_id IS NOT NULL) "
        "FROM graph_topics t LEFT JOIN graph_topic_members m ON m.topic_id=t.id "
        "WHERE t.workspace_id=%s GROUP BY t.id ORDER BY t.label",
        (ws,),
    ).fetchall()
    out = []
    for r in rows:
        members = [str(x) for x in (r[5] or []) if str(x) in visible]
        if not members:
            continue
        out.append({"id": str(r[0]), "label": r[1], "keywords": r[2] or [],
                    "x": r[3], "y": r[4], "doc_count": len(members)})
    return out


def read_topic_docs(conn, ws: str, topic_id: str, visible: set[str]) -> list[dict]:
    rows = conn.execute(
        "SELECT d.id,d.filename,dm.exposure_score,dm.is_orphan,dm.last_retrieved_at "
        "FROM graph_topic_members m JOIN documents d ON d.id=m.document_id "
        "LEFT JOIN graph_doc_meta dm ON dm.document_id=d.id "
        "WHERE m.topic_id=%s AND m.workspace_id=%s",
        (topic_id, ws),
    ).fetchall()
    return [
        {"id": str(r[0]), "filename": r[1], "exposure_score": r[2] or 0.0,
         "is_orphan": bool(r[3]), "last_retrieved_at": r[4].isoformat() if r[4] else None}
        for r in rows if str(r[0]) in visible
    ]


def read_findings(conn, ws: str, visible: set[str], kind: str | None = None) -> list[dict]:
    q = ("SELECT f.id,f.kind,f.document_id,f.severity,f.detail,d.filename "
         "FROM graph_findings f JOIN documents d ON d.id=f.document_id "
         "WHERE f.workspace_id=%s AND f.status='open'")
    params: list = [ws]
    if kind:
        q += " AND f.kind=%s"
        params.append(kind)
    q += " ORDER BY f.severity DESC"
    rows = conn.execute(q, tuple(params)).fetchall()
    return [
        {"id": str(r[0]), "kind": r[1], "document_id": str(r[2]), "severity": r[3],
         "detail": r[4] or {}, "filename": r[5]}
        for r in rows if str(r[2]) in visible
    ]


def dismiss(conn, ws: str, finding_id: str) -> bool:
    cur = conn.execute(
        "UPDATE graph_findings SET status='dismissed' WHERE id=%s AND workspace_id=%s",
        (finding_id, ws))
    return cur.rowcount > 0
