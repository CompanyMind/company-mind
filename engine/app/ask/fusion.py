def rrf(
    lists: list[list[str]],
    k: int = 60,
    weights: list[float] | None = None,
) -> list[tuple[str, float]]:
    """Reciprocal rank fusion (Cormack et al., 2009). Each list is chunk-ids in
    best-first order. score(d) = Σ weight_L / (k + rank_L(d)), rank 1-based."""
    ws = weights or [1.0] * len(lists)
    scores: dict[str, float] = {}
    for lst, w in zip(lists, ws):
        for rank0, cid in enumerate(lst):
            scores[cid] = scores.get(cid, 0.0) + w / (k + rank0 + 1)
    return sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))


def cap_by_document(ranked: list[str], chunk_to_doc: dict[str, str], cap: int) -> list[str]:
    """Keep order but let each document contribute at most `cap` chunks."""
    seen: dict[str, int] = {}
    out: list[str] = []
    for cid in ranked:
        doc = chunk_to_doc.get(cid, cid)
        if seen.get(doc, 0) >= cap:
            continue
        seen[doc] = seen.get(doc, 0) + 1
        out.append(cid)
    return out
