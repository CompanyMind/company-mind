import numpy as np

from ..ask.answer import get_chat_call
from ..db import get_conn
from ..settings import settings
from . import cluster, label, layout, lenses, store


def _visible(conn, ws, user_id: str, role: str, as_group) -> set[str]:
    """Doc ids the principal may see. The Brain Map is an owner-only surface;
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


def build_graph(ws: str) -> dict:
    """Orchestrates the whole Brain Map build: load docs -> cluster -> keywords
    + labels -> layout -> permission/orphan/dead/stale lenses -> persist. Runs
    inside one pooled connection; on any failure the job row is marked failed
    and the exception re-raised."""
    with get_conn() as conn:
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


def list_findings(ws, user_id, role, as_group, kind) -> list[dict]:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        return store.read_findings(conn, ws, vis, kind)


def dismiss_finding(ws, finding_id) -> bool:
    with get_conn() as conn:
        return store.dismiss(conn, ws, finding_id)
