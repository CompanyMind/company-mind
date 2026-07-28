"""AI organise: cluster unfiled documents into named folders.

Reuses the Atlas pipeline rather than introducing new ML — the same KMeans over
mean document vectors, the same TF-IDF keywords, and the same LLM labeller with
its deterministic keyword fallback. That keeps this runnable with no GPU and
makes it testable under the fake providers.

Only unfiled documents are touched: a user's own filing is never overwritten.
"""

from dataclasses import dataclass, field

import numpy as np
from sklearn.cluster import KMeans

from ..ask.answer import get_chat_call
from ..db import get_conn
from ..graph.cluster import keywords_per_cluster
from ..graph.label import label_cluster
from ..settings import settings
from . import folders as lib_folders


class NothingToOrganize(Exception):
    """No unfiled document has an embedding, so there is nothing to cluster."""


def _k_for(n: int) -> int:
    """Folder count. Deliberately different from Atlas's topic count: a first
    upload of a dozen files should yield a handful of folders, not one."""
    if n < 4:
        return 1
    return max(2, min(8, round(n**0.5)))


def _load_unfiled(conn, workspace_id: str):
    """(doc_ids, vectors, first-chunk texts) for unfiled documents that have at
    least one embedded chunk."""
    rows = conn.execute(
        "SELECT d.id, AVG(c.embedding) "
        "FROM documents d JOIN chunks c ON c.document_id = d.id "
        "WHERE d.workspace_id=%s AND d.folder_id IS NULL AND c.embedding IS NOT NULL "
        "GROUP BY d.id ORDER BY d.id",
        (workspace_id,),
    ).fetchall()
    if not rows:
        return [], None, []
    doc_ids = [str(r[0]) for r in rows]
    vectors = np.vstack(
        [(r[1].to_numpy() if hasattr(r[1], "to_numpy") else np.asarray(r[1], dtype=float))
         for r in rows]
    )
    text_rows = conn.execute(
        "SELECT DISTINCT ON (document_id) document_id, text FROM chunks "
        "WHERE workspace_id=%s AND document_id = ANY(%s::uuid[]) ORDER BY document_id, ordinal",
        (workspace_id, doc_ids),
    ).fetchall()
    by_id = {str(r[0]): r[1] for r in text_rows}
    return doc_ids, vectors, [by_id.get(d, "") for d in doc_ids]


def _unique_name(conn, workspace_id: str, base: str) -> str:
    """Append ' 2', ' 3', … until the name is free. create_folder is
    case-insensitive, so this must be too."""
    name = base
    n = 1
    while True:
        taken = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s)",
            (workspace_id, name),
        ).fetchone()
        if not taken:
            return name
        n += 1
        name = f"{base} {n}"


@dataclass
class Cluster:
    """One prospective folder: its members, its keywords, and — once
    `label_plan` has run — the name the model (or the deterministic fallback)
    gave it."""

    members: list[str]
    keywords: list[str]
    titles: list[str]
    label: str = ""


@dataclass
class OrganizePlan:
    clusters: list[Cluster] = field(default_factory=list)


def plan_organize(conn, workspace_id: str) -> OrganizePlan:
    """Phase 1 — DB read + clustering. No network, so it is safe to hold a
    pooled connection here."""
    doc_ids, vectors, texts = _load_unfiled(conn, workspace_id)
    if not doc_ids:
        raise NothingToOrganize("no unfiled documents with embeddings")

    k = _k_for(len(doc_ids))
    labels = (
        np.zeros(len(doc_ids), dtype=int)
        if k <= 1
        else KMeans(
            n_clusters=min(k, len(doc_ids)), random_state=settings.graph_seed, n_init=10
        ).fit_predict(vectors)
    )
    kw = keywords_per_cluster(texts, labels)
    return OrganizePlan(
        clusters=[
            Cluster(
                members=[d for d, lab in zip(doc_ids, labels) if int(lab) == cluster],
                keywords=kw.get(cluster, []),
                titles=[t for t, lab in zip(texts, labels) if int(lab) == cluster][:5],
            )
            for cluster in sorted({int(x) for x in labels})
        ]
    )


def label_plan(plan: OrganizePlan) -> OrganizePlan:
    """Phase 2 — one chat call per cluster. Takes NO connection, deliberately:
    each call has a 60s timeout and the pool has ten connections shared with
    ask, ingest, Telegram and Atlas. `label_cluster` already falls back to
    deterministic keyword labels when no model is configured or a call fails,
    so this phase cannot fail the run."""
    call = get_chat_call()
    for c in plan.clusters:
        c.label = label_cluster(c.keywords, c.titles, call=call)
    return plan


def apply_organize(conn, workspace_id: str, plan: OrganizePlan) -> dict:
    """Phase 3 — DB writes. No network."""
    created: list[dict] = []
    organized = 0
    for c in plan.clusters:
        folder = lib_folders.create_folder(
            conn,
            workspace_id,
            _unique_name(conn, workspace_id, c.label),
            origin="ai",
            keywords=c.keywords,
        )
        if folder is None:  # lost a race; skip rather than crash the whole run
            continue
        for doc_id in c.members:
            lib_folders.set_document_folder(conn, workspace_id, doc_id, folder["id"])
            organized += 1
        created.append(
            {"id": folder["id"], "name": folder["name"], "document_count": len(c.members)}
        )
    return {"folders": created, "organized": organized}


def organize_unfiled(conn, workspace_id: str) -> dict:
    """All three phases on a caller-supplied connection.

    Kept for direct/test callers that already own a connection. The API path
    must NOT use this — see organize_unfiled_pooled, which is the same work with
    the connection released around the model calls."""
    return apply_organize(conn, workspace_id, label_plan(plan_organize(conn, workspace_id)))


def organize_unfiled_pooled(workspace_id: str) -> dict:
    """The API path: read, release, call the model, re-acquire, write."""
    with get_conn() as conn:
        plan = plan_organize(conn, workspace_id)
    labelled = label_plan(plan)  # network — no connection held
    with get_conn() as conn:
        return apply_organize(conn, workspace_id, labelled)
