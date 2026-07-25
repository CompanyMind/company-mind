"""Retrieval evaluation runner.

Two modes:
  * fixture (CI)  — synthetic corpus, deterministic fake providers, no network.
                    Gates on INVARIANTS: zero permission leaks, exact-token recall,
                    and no paired regression against the committed baseline.
  * real          — point --golden at the pilot's golden set with real models
                    configured. Those files are customer data and are never committed.
"""

import argparse
import json
import os
import pathlib
import uuid

from app.db import get_conn
from app.ingest.store import process_document
from app.ask.retrieve import retrieve

from .goldenset import GoldenQuestion, load_golden
from .metrics import paired_bootstrap, score_question

FIXTURE_CORPUS = pathlib.Path(__file__).parent / "fixtures" / "corpus"
GATED_METRICS = ("doc_recall", "quote_recall", "ndcg")


def seed_fixture_workspace() -> str:
    """Create a throwaway workspace, ingest the fixture corpus through the real
    pipeline, and restrict the HR document to an HR-only group."""
    ws = str(uuid.uuid4())
    with get_conn() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (%s,'eval',%s)", (ws, ws)
            )
            conn.execute(
                "INSERT INTO groups (workspace_id, name, slug, is_default) "
                "VALUES (%s,'Everyone',%s,true)",
                (ws, f"everyone-{ws}"),
            )
            hr = conn.execute(
                "INSERT INTO groups (workspace_id, name, slug, is_default) "
                "VALUES (%s,'HR',%s,false) RETURNING id",
                (ws, f"hr-{ws}"),
            ).fetchone()[0]

    for path in sorted(FIXTURE_CORPUS.glob("*.txt")):
        data = path.read_bytes()
        with get_conn() as conn:
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,%s,'text/plain',%s,%s,'uploaded') RETURNING id",
                (ws, path.name, len(data), f"eval/{path.name}"),
            ).fetchone()[0]
            everyone = conn.execute(
                "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (ws,)
            ).fetchone()[0]
            with conn.transaction():
                conn.execute(
                    "INSERT INTO ingestion_jobs (document_id, workspace_id, status) "
                    "VALUES (%s,%s,'queued')",
                    (doc, ws),
                )
                target = hr if path.name.startswith("hr-") else everyone
                conn.execute(
                    "INSERT INTO document_groups (document_id, workspace_id, group_id) "
                    "VALUES (%s,%s,%s)",
                    (doc, ws, target),
                )
        process_document(str(doc), ws, path.name, "text/plain", data)
    return ws


def drop_fixture_workspace(ws: str) -> None:
    with get_conn() as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def _group_ids(ws: str, names: list[str]) -> list[str]:
    if not names:
        return []
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id FROM groups WHERE workspace_id=%s AND name = ANY(%s)", (ws, names)
        ).fetchall()
    return [str(r[0]) for r in rows]


def run_eval(workspace_id: str, golden_path: str, k: int = 8) -> dict:
    questions: list[GoldenQuestion] = load_golden(golden_path)
    per_question: dict[str, dict] = {}   # ANSWERABLE only — these drive the means
    unanswerable: dict[str, dict] = {}
    clusters: dict[str, str] = {}
    leaks: list[dict] = []

    for q in questions:
        hits, dbg = retrieve(
            workspace_id,
            q.question,
            k=k,
            group_ids=_group_ids(workspace_id, q.group_names),
            all_access=q.all_access,
        )
        retrieved = [{"filename": h.filename, "text": h.text} for h in hits]
        # Permission checks apply to EVERY question, answerable or not.
        for forbidden in q.must_not_retrieve:
            if any(r["filename"] == forbidden for r in retrieved):
                leaks.append({"question": q.id, "document": forbidden})

        if not q.answerable:
            # No gold exists, so retrieval metrics are undefined. Averaging their
            # structural zeros into the means would depress every reported number
            # in proportion to the unanswerable share of the set (the spec calls
            # for 20 of 120). Tracked separately; whether the ANSWER refuses is a
            # Phase 5 metric, not a retrieval one.
            unanswerable[q.id] = {"retrieved_n": float(len(retrieved))}
            continue

        scores = score_question(retrieved, q, k)
        scores["lexical_n"] = float(dbg.lexical_n)
        scores["degraded_n"] = float(len(dbg.degraded))
        per_question[q.id] = scores
        clusters[q.id] = (q.gold_filenames or [q.id])[0]

    means = {
        m: (sum(s[m] for s in per_question.values()) / len(per_question) if per_question else 0.0)
        for m in (*GATED_METRICS, "mrr", "lexical_n", "degraded_n")
    }
    means["n_answerable"] = float(len(per_question))
    means["n_unanswerable"] = float(len(unanswerable))
    return {
        "per_question": per_question,
        "unanswerable": unanswerable,
        "means": means,
        "leaks": leaks,
        "clusters": clusters,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workspace", help="existing workspace id; omit to seed the fixture corpus")
    ap.add_argument("--golden", default="evals/fixtures/golden.jsonl")
    ap.add_argument("--baseline", default="evals/baseline.json")
    ap.add_argument("--write-baseline", action="store_true")
    ap.add_argument("--k", type=int, default=8)
    args = ap.parse_args()

    ws, seeded = (args.workspace, False)
    if not ws:
        ws, seeded = seed_fixture_workspace(), True
    try:
        report = run_eval(ws, args.golden, args.k)
    finally:
        if seeded:
            drop_fixture_workspace(ws)

    print(json.dumps(report["means"], indent=2))

    if report["leaks"]:
        for leak in report["leaks"]:
            print(f"PERMISSION LEAK: question {leak['question']} retrieved {leak['document']}")
        return 1

    if args.write_baseline:
        with open(args.baseline, "w", encoding="utf-8") as fh:
            json.dump(report["per_question"], fh, indent=2, sort_keys=True)
        print(f"baseline written to {args.baseline}")
        return 0

    if not os.path.exists(args.baseline):
        print(f"no baseline at {args.baseline}; run with --write-baseline to create one")
        return 0

    with open(args.baseline, encoding="utf-8") as fh:
        base = json.load(fh)

    # paired_bootstrap() silently returns (0.0, 0.0, 0.0) — read as "no change" —
    # when `base` and the current run share zero question ids, e.g. because the
    # golden set's ids were edited/renamed without regenerating the baseline via
    # --write-baseline. A gate that reports "no change" while comparing nothing is
    # exactly the failure mode this harness exists to prevent, so treat a fully
    # stale baseline as a hard failure rather than a silent pass.
    shared_ids = sorted(set(base) & set(report["per_question"]))
    if not shared_ids:
        print(
            "REGRESSION CHECK ABORTED: baseline and this run share zero question ids "
            f"(baseline has {sorted(base)}, this run has {sorted(report['per_question'])}). "
            "The baseline is stale — regenerate it with --write-baseline."
        )
        return 1
    print(f"regression check: comparing {len(shared_ids)}/{len(report['per_question'])} "
          "current question(s) against the baseline")

    failed = False
    for metric in GATED_METRICS:
        mean, lo, hi = paired_bootstrap(base, report["per_question"], metric, report["clusters"])
        verdict = "REGRESSION" if hi < 0 else ("improvement" if lo > 0 else "no change")
        print(f"{metric:>13}: delta {mean:+.4f}  95% CI [{lo:+.4f}, {hi:+.4f}]  {verdict}")
        if hi < 0:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
