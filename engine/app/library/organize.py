"""AI organise: cluster unfiled documents into named folders.

Reuses the Atlas pipeline rather than introducing new ML — the same KMeans over
mean document vectors, the same TF-IDF keywords, and the same LLM labeller with
its deterministic keyword fallback. That keeps this runnable with no GPU and
makes it testable under the fake providers.

Only unfiled documents are touched: a user's own filing is never overwritten.
"""

import numpy as np
from sklearn.cluster import KMeans

from ..ask.answer import get_chat_call
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


def organize_unfiled(conn, workspace_id: str) -> dict:
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
    call = get_chat_call()

    created: list[dict] = []
    organized = 0
    for cluster in sorted({int(x) for x in labels}):
        members = [d for d, lab in zip(doc_ids, labels) if int(lab) == cluster]
        titles = [t for t, lab in zip(texts, labels) if int(lab) == cluster][:5]
        base = label_cluster(kw.get(cluster, []), titles, call=call)
        folder = lib_folders.create_folder(
            conn,
            workspace_id,
            _unique_name(conn, workspace_id, base),
            origin="ai",
            keywords=kw.get(cluster, []),
        )
        if folder is None:  # lost a race; skip rather than crash the whole run
            continue
        for doc_id in members:
            lib_folders.set_document_folder(conn, workspace_id, doc_id, folder["id"])
            organized += 1
        created.append(
            {"id": folder["id"], "name": folder["name"], "document_count": len(members)}
        )
    return {"folders": created, "organized": organized}
