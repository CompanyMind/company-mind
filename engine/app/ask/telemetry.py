import time
from contextlib import contextmanager
from dataclasses import dataclass, field


@dataclass
class RetrievalDebug:
    """Per-query retrieval telemetry. Exists so that a degraded pipeline is
    visible in the audit log instead of looking identical to a healthy one."""

    dense_n: int = 0
    lexical_n: int = 0
    fused_n: int = 0
    rerank_in_n: int = 0
    final_n: int = 0
    # Which reranker actually ran. Without this, `rerank_applied: true` from the
    # identity FakeReranker reads exactly like a real cross-encoder pass.
    reranker: str = ""
    rerank_applied: bool = False
    degraded: list[str] = field(default_factory=list)
    timings_ms: dict[str, float] = field(default_factory=dict)

    def finalize(self) -> None:
        # plainto_tsquery ANDs every term, so a long natural-language question
        # routinely matches nothing and "hybrid" retrieval collapses to dense-only.
        # Recording it is how we measure how often that actually happens.
        if self.lexical_n == 0:
            self.degraded.append("lexical_arm_empty")
        if self.dense_n == 0:
            self.degraded.append("dense_arm_empty")

    def as_dict(self) -> dict:
        return {
            "candidate_counts": {
                "dense": self.dense_n,
                "lexical": self.lexical_n,
                "fused": self.fused_n,
                "rerank_in": self.rerank_in_n,
                "final": self.final_n,
            },
            "reranker": self.reranker,
            "rerank_applied": self.rerank_applied,
            "degraded": list(self.degraded),
            "timings_ms": {k: round(v, 2) for k, v in self.timings_ms.items()},
        }


@contextmanager
def stage(dbg: RetrievalDebug, name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        dbg.timings_ms[name] = (time.perf_counter() - start) * 1000.0
