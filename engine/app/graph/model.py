from dataclasses import dataclass, field
import numpy as np


@dataclass
class DocInfo:
    id: str
    groups: set[str]          # group ids that can see the doc
    vector: np.ndarray
    created_at_days: float     # age in days at build time
    retrieved: bool            # any chunk ever in query_log.retrieved_chunk_ids
    cluster: int = -1


@dataclass
class Finding:
    kind: str                  # permission_anomaly|over_exposure|orphan|dead|stale
    document_id: str
    severity: float
    detail: dict = field(default_factory=dict)
