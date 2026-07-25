"""ANN-vs-exact recall probe.

Answers one question before Phase 2 changes any GUC: how much recall does the
HNSW index actually lose when the permission filter is selective? pgvector's own
README notes that with ef_search=40 and a 10%-selective filter, roughly 4 of 40
rows survive; engine/app/ask/retrieve.py::_dense_ids is that query verbatim, with
LIMIT 40 and ef_search left at its default of 40.

Needs no relevance labels: exact search (enable_indexscan=off) is ground truth.

CAVEAT: run this against the real corpus with real embeddings before deciding.
FakeEmbeddings are uniform on the sphere, which is a pathological distribution for
HNSW and will not predict behaviour on real text.
"""

import argparse
import json
import time
from dataclasses import asdict, dataclass

from app.db import get_conn
from app.ingest.embed import get_provider


@dataclass
class ProbeRow:
    selectivity: float
    ef_search: int
    iterative_scan: str
    recall: float
    ann_ms: float
    exact_ms: float


def _visible_predicate(selectivity: float) -> str:
    """Synthesize an ACL filter of a chosen selectivity without touching real
    permissions: hash the chunk id into [0,1) and keep the bottom slice. Shaped
    like the real predicate — a boolean over each candidate row — so the planner
    sees the same kind of filter."""
    if selectivity >= 1.0:
        return "TRUE"
    return f"(('x' || substr(md5(c.id::text), 1, 8))::bit(32)::bigint / 4294967295.0) < {selectivity}"


def _search(conn, ws: str, qlit: str, pred: str, limit: int, exact: bool,
            ef: int, iterative: str) -> tuple[list[str], float]:
    with conn.transaction():
        if exact:
            conn.execute("SET LOCAL enable_indexscan = off")
            conn.execute("SET LOCAL enable_bitmapscan = off")
        else:
            conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef)}")
            conn.execute(f"SET LOCAL hnsw.iterative_scan = '{iterative}'")
        start = time.perf_counter()
        rows = conn.execute(
            f"SELECT c.id FROM chunks c WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            f"AND {pred} ORDER BY c.embedding <=> %s::vector LIMIT %s",
            (ws, qlit, limit),
        ).fetchall()
        elapsed = (time.perf_counter() - start) * 1000.0
    return [str(r[0]) for r in rows], elapsed


def probe(
    workspace_id: str,
    queries: list[str],
    selectivities: list[float],
    ef_values: list[int],
    iterative_modes: list[str],
    limit: int = 40,
) -> list[ProbeRow]:
    provider = get_provider()
    qlits = [
        "[" + ",".join(str(x) for x in provider.embed([q])[0]) + "]" for q in queries
    ]
    out: list[ProbeRow] = []
    with get_conn() as conn:
        for sel in selectivities:
            pred = _visible_predicate(sel)
            truth: list[list[str]] = []
            exact_ms = 0.0
            for qlit in qlits:
                ids, ms = _search(conn, workspace_id, qlit, pred, limit, True, 0, "off")
                truth.append(ids)
                exact_ms += ms
            for ef in ef_values:
                for mode in iterative_modes:
                    hits = 0
                    total = 0
                    ann_ms = 0.0
                    for qlit, gold in zip(qlits, truth):
                        ids, ms = _search(conn, workspace_id, qlit, pred, limit, False, ef, mode)
                        ann_ms += ms
                        gold_set = set(gold)
                        hits += len(gold_set & set(ids))
                        total += len(gold_set)
                    out.append(
                        ProbeRow(
                            selectivity=sel,
                            ef_search=ef,
                            iterative_scan=mode,
                            recall=(hits / total) if total else 1.0,
                            ann_ms=round(ann_ms / max(1, len(qlits)), 2),
                            exact_ms=round(exact_ms / max(1, len(qlits)), 2),
                        )
                    )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--queries", required=True, help="file with one query per line")
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--out", default="probe_ann.json")
    args = ap.parse_args()

    with open(args.queries, encoding="utf-8") as fh:
        queries = [line.strip() for line in fh if line.strip()]

    rows = probe(
        args.workspace,
        queries,
        selectivities=[1.0, 0.30, 0.10, 0.02, 0.01, 0.005],
        ef_values=[40, 100, 200, 400],
        iterative_modes=["off", "relaxed_order"],
        limit=args.limit,
    )
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump([asdict(r) for r in rows], fh, indent=2)

    print(f"{'sel':>7} {'ef':>5} {'iterative':>14} {'recall':>7} {'ann_ms':>8} {'exact_ms':>9}")
    for r in rows:
        print(
            f"{r.selectivity:>7.3f} {r.ef_search:>5} {r.iterative_scan:>14} "
            f"{r.recall:>7.3f} {r.ann_ms:>8.2f} {r.exact_ms:>9.2f}"
        )


if __name__ == "__main__":
    main()
