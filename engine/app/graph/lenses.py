import numpy as np
from .model import DocInfo, Finding


def exposure_score(groups: set[str], everyone_id: str, group_count: int) -> float:
    if not groups:
        return 0.0
    if everyone_id in groups or group_count <= 1:
        return 1.0
    return min(1.0, len(groups) / group_count)


def _cos(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _by_cluster(members: list[DocInfo]) -> dict[int, list[DocInfo]]:
    out: dict[int, list[DocInfo]] = {}
    for m in members:
        out.setdefault(m.cluster, []).append(m)
    return out


def permission_findings(members: list[DocInfo], everyone_id: str) -> list[Finding]:
    """Within each cluster, the consensus group set = groups present in > 50% of
    docs. A doc is anomalous when its group set diverges from consensus (Jaccard)."""
    findings: list[Finding] = []
    for cluster, docs in _by_cluster(members).items():
        if len(docs) < 4:
            continue
        counts: dict[str, int] = {}
        for d in docs:
            for g in d.groups:
                counts[g] = counts.get(g, 0) + 1
        consensus = {g for g, c in counts.items() if c > len(docs) / 2}
        if not consensus:
            continue
        for d in docs:
            union = d.groups | consensus
            if not union:
                continue
            jac = len(d.groups & consensus) / len(union)
            severity = 1.0 - jac
            if severity < 0.5:
                continue
            over = everyone_id in d.groups and everyone_id not in consensus
            findings.append(
                Finding(
                    "permission_anomaly",
                    d.id,
                    round(severity, 3),
                    {
                        "consensus": sorted(consensus),
                        "doc_groups": sorted(d.groups),
                        "direction": "over_shared" if over or d.groups > consensus else "siloed",
                    },
                )
            )
    return findings


def orphan_docs(members: list[DocInfo], threshold: float = 0.15) -> list[Finding]:
    findings: list[Finding] = []
    for cluster, docs in _by_cluster(members).items():
        for i, d in enumerate(docs):
            best = max(
                (_cos(d.vector, o.vector) for j, o in enumerate(docs) if j != i),
                default=0.0,
            )
            if best < threshold:
                findings.append(Finding("orphan", d.id, round(1.0 - best, 3),
                                        {"max_similarity": round(best, 3)}))
    return findings


def degrees(members: list[DocInfo], threshold: float = 0.15) -> dict[str, int]:
    deg: dict[str, int] = {d.id: 0 for d in members}
    for cluster, docs in _by_cluster(members).items():
        for i, d in enumerate(docs):
            deg[d.id] = sum(
                1 for j, o in enumerate(docs) if j != i and _cos(d.vector, o.vector) >= threshold
            )
    return deg


def dead_stale_findings(docs: list[DocInfo], stale_days: float) -> list[Finding]:
    findings: list[Finding] = []
    for d in docs:
        if not d.retrieved:
            findings.append(Finding("dead", d.id, 0.6, {"reason": "never retrieved"}))
        if d.created_at_days > stale_days:
            sev = min(1.0, d.created_at_days / (stale_days * 3))
            findings.append(Finding("stale", d.id, round(sev, 3),
                                    {"age_days": round(d.created_at_days)}))
    return findings
