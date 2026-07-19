import numpy as np

from ..ask.answer import get_chat_call
from ..db import get_conn
from ..settings import settings
from . import cluster, label, layout, lenses, store


def _visible(conn, ws, user_id: str, role: str, as_group) -> set[str]:
    """Doc ids the principal may see. Atlas is an owner-only surface;
    `as_group` (not `role`) drives filtering here — None/""/"owner" previews the
    whole workspace, a group id previews exactly what a member of that group
    would see. That must match the real access rule
    (`access.py::resolve_access`): a non-owner member is scoped to their groups
    PLUS the workspace's default "Everyone" group, not the named group alone —
    otherwise this governance/audit preview understates what the member
    actually sees."""
    if as_group in (None, "", "owner"):
        rows = conn.execute(
            "SELECT id FROM documents WHERE workspace_id=%s", (ws,)
        ).fetchall()
        return {str(r[0]) for r in rows}
    everyone_id = store.everyone_id(conn, ws)
    gids = list({as_group, everyone_id}) if everyone_id else [as_group]
    rows = conn.execute(
        "SELECT DISTINCT document_id FROM document_groups "
        "WHERE workspace_id=%s AND group_id = ANY(%s::uuid[])",
        (ws, gids),
    ).fetchall()
    return {str(r[0]) for r in rows}


def _doc_texts(conn, ws, doc_ids: list[str]) -> list[str]:
    """First chunk text per doc, in the same order as doc_ids (for keywords/titles)."""
    if not doc_ids:
        return []
    rows = conn.execute(
        "SELECT DISTINCT ON (document_id) document_id, text FROM chunks "
        "WHERE workspace_id=%s AND document_id = ANY(%s::uuid[]) ORDER BY document_id, ordinal",
        (ws, doc_ids),
    ).fetchall()
    by_id = {str(r[0]): r[1] for r in rows}
    return [by_id.get(did, "") for did in doc_ids]


def build_graph(ws: str, job_id: str | None = None) -> dict:
    """Orchestrates the whole Atlas build: load docs -> cluster -> keywords
    + labels -> layout -> permission/orphan/dead/stale/over-exposure lenses ->
    persist. Runs inside one pooled connection; on any failure the job row is
    marked failed and the exception re-raised.

    `job_id`: when None, a fresh 'running' job row is started here (used by
    direct/test callers). When provided, that job is REUSED rather than
    starting a second one — the caller (POST /graph/rebuild) already created
    it synchronously before backgrounding this call, so the client's first
    poll is guaranteed to observe a 'running' job instead of racing this
    background task's own start_job."""
    with get_conn() as conn:
        if job_id is None:
            job_id = store.start_job(conn, ws)
        try:
            docs = store.load_docs(conn, ws)
            ev = store.everyone_id(conn, ws)
            gcount = store.group_count(conn, ws)
            if not docs:
                store.write_build(conn, ws, [], {}, [])
                store.finish_job(conn, ws, job_id)
                return store.latest_job(conn, ws)

            vectors = np.vstack([d.vector for d in docs])
            labels = cluster.cluster_docs(vectors, seed=settings.graph_seed)
            for d, lab in zip(docs, labels):
                d.cluster = int(lab)

            texts = _doc_texts(conn, ws, [d.id for d in docs])
            kw = cluster.keywords_per_cluster(texts, labels)
            call = get_chat_call()

            order = sorted(set(int(x) for x in labels))
            centroids = np.vstack([vectors[labels == c].mean(axis=0) for c in order])
            pos = layout.layout_positions(centroids, seed=settings.graph_seed)

            cluster_to_idx = {c: i for i, c in enumerate(order)}
            topics = []
            for i, c in enumerate(order):
                member_ids = [d.id for d in docs if d.cluster == c]
                titles = [t for d, t in zip(docs, texts) if d.cluster == c][:5]
                topics.append(
                    {
                        "label": label.label_cluster(kw.get(c, []), titles, call=call),
                        "keywords": kw.get(c, []),
                        "centroid": centroids[i],
                        "x": float(pos[i][0]),
                        "y": float(pos[i][1]),
                        "doc_ids": member_ids,
                    }
                )

            deg = lenses.degrees(docs, settings.graph_orphan_threshold)
            findings = (
                lenses.permission_findings(docs, ev)
                + lenses.orphan_docs(docs, settings.graph_orphan_threshold)
                + lenses.dead_stale_findings(docs, settings.graph_stale_days)
                + lenses.over_exposure_findings(
                    docs, ev, gcount, settings.graph_overexposed_threshold
                )
            )
            orphan_ids = {f.document_id for f in findings if f.kind == "orphan"}
            doc_meta = {
                d.id: {
                    "topic": cluster_to_idx[d.cluster],
                    "degree": deg.get(d.id, 0),
                    "exposure": lenses.exposure_score(d.groups, ev, gcount),
                    "orphan": d.id in orphan_ids,
                    "last_retrieved_at": None,
                }
                for d in docs
            }
            store.write_build(conn, ws, topics, doc_meta, findings)
            store.finish_job(conn, ws, job_id)
        except Exception as e:  # noqa: BLE001 — job row records the failure, then re-raise
            store.finish_job(conn, ws, job_id, error=str(e)[:500])
            raise
        return store.latest_job(conn, ws)


def get_graph(ws, user_id, role, as_group) -> dict:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        topics = store.read_topics(conn, ws, vis)
        job = store.latest_job(conn, ws)
    # Top-level topic<->topic edges (e.g. nearby centroids) are a fast-follow;
    # the client force-lays topics from x/y in the meantime.
    return {"topics": topics, "edges": [], "job": job}


def get_topic(ws, topic_id, user_id, role, as_group) -> dict:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        nodes = store.read_topic_docs(conn, ws, topic_id, vis)
    return {"nodes": nodes, "edges": []}  # doc<->doc edges (on-demand kNN): fast-follow


def _department(groups: set[str], gnames: dict[str, tuple[str, bool]]) -> str:
    """First non-default group name, deterministically (min by name). A doc
    with only the default "Everyone" group (or no groups at all) is bucketed
    into "Everyone"."""
    names = sorted(gnames[gid][0] for gid in groups if gid in gnames and not gnames[gid][1])
    return names[0] if names else "Everyone"


def document_graph(ws, user_id, role, as_group) -> dict:
    """Obsidian-style document graph: every visible document as a node
    (colored by department client-side), connected by cosine-similarity kNN
    edges over the same mean chunk vectors the topic clustering uses."""
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        docs = [d for d in store.load_docs(conn, ws) if d.id in vis]
        if not docs:
            return {"nodes": [], "edges": []}
        gnames = store.group_names(conn, ws)
        doc_ids = [d.id for d in docs]
        filenames = {
            str(r[0]): r[1]
            for r in conn.execute(
                "SELECT id, filename FROM documents WHERE workspace_id=%s AND id = ANY(%s::uuid[])",
                (ws, doc_ids),
            ).fetchall()
        }
        meta = {
            str(r[0]): (r[1] or 0.0, bool(r[2]))
            for r in conn.execute(
                "SELECT document_id, exposure_score, is_orphan FROM graph_doc_meta "
                "WHERE workspace_id=%s AND document_id = ANY(%s::uuid[])",
                (ws, doc_ids),
            ).fetchall()
        }

    # Cosine similarity matrix over the kept docs' mean vectors.
    vectors = np.vstack([d.vector for d in docs])
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    unit = vectors / norms
    sim = unit @ unit.T

    topk = settings.graph_edge_topk
    threshold = settings.graph_edge_threshold
    edge_weight: dict[tuple[str, str], float] = {}
    for i, d in enumerate(docs):
        row = sim[i].copy()
        row[i] = -1.0  # exclude self
        neighbors = np.argsort(-row)[:topk]
        for j in neighbors:
            c = float(row[j])
            if c < threshold:
                continue
            a, b = d.id, docs[j].id
            key = (a, b) if a < b else (b, a)
            if key not in edge_weight or c > edge_weight[key]:
                edge_weight[key] = c

    degree: dict[str, int] = {d.id: 0 for d in docs}
    edges = []
    for (a, b), c in edge_weight.items():
        degree[a] += 1
        degree[b] += 1
        edges.append({"source": a, "target": b, "weight": round(c, 3)})
    edges.sort(key=lambda e: (e["source"], e["target"]))

    nodes = []
    for d in docs:
        exposure, orphan = meta.get(d.id, (0.0, False))
        nodes.append(
            {
                "id": d.id,
                "filename": filenames.get(d.id, ""),
                "department": _department(d.groups, gnames),
                "exposure_score": exposure,
                "is_orphan": orphan,
                "degree": degree.get(d.id, 0),
            }
        )
    nodes.sort(key=lambda n: n["id"])
    return {"nodes": nodes, "edges": edges}


def list_findings(ws, user_id, role, as_group, kind) -> list[dict]:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        return store.read_findings(conn, ws, vis, kind)


def dismiss_finding(ws, finding_id) -> bool:
    with get_conn() as conn:
        return store.dismiss(conn, ws, finding_id)
