import json
import os
import sys

import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_fixture_eval_runs_and_finds_no_permission_leak():
    """The gate that must never go red for the wrong reason: a member principal
    must never retrieve an HR-restricted document."""
    from evals.run import seed_fixture_workspace, run_eval

    ws = seed_fixture_workspace()
    try:
        report = run_eval(ws, "evals/fixtures/golden.jsonl", k=8)
        assert report["leaks"] == [], report["leaks"]
        # f7 and f8 are unanswerable: they carry no gold, so they must be scored
        # separately and must NOT be averaged into the means as structural zeros.
        assert set(report["per_question"]) == {"f1", "f2", "f3", "f4", "f5", "f6"}
        assert set(report["unanswerable"]) == {"f7", "f8"}
        assert report["means"]["n_answerable"] == 6.0
        assert report["means"]["n_unanswerable"] == 2.0
        # With FakeEmbeddings the dense arm is not semantic, so only assert on the
        # lexical-driven exact-token question, which must always be findable.
        assert report["per_question"]["f2"]["doc_recall"] == 1.0
    finally:
        from evals.run import drop_fixture_workspace

        drop_fixture_workspace(ws)


def test_stale_baseline_with_no_shared_question_ids_fails_loudly(tmp_path, monkeypatch, capsys):
    """paired_bootstrap() reports (0.0, 0.0, 0.0) — read as "no change" — when the
    baseline and the current run share zero question ids, which happens if the
    golden set's question ids are edited/renamed without regenerating the
    baseline (--write-baseline). A gate that reports "no change" while comparing
    nothing is exactly the silent-good-for-the-wrong-reason failure mode this
    harness exists to prevent, so main() must treat a fully stale baseline as a
    hard failure rather than a silent pass."""
    from evals.run import drop_fixture_workspace, main, seed_fixture_workspace

    stale_baseline = tmp_path / "stale-baseline.json"
    stale_baseline.write_text(
        json.dumps({"not-a-real-id": {"doc_recall": 1.0, "quote_recall": 1.0, "ndcg": 1.0}})
    )

    ws = seed_fixture_workspace()
    try:
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "run.py",
                "--workspace", ws,
                "--golden", "evals/fixtures/golden.jsonl",
                "--baseline", str(stale_baseline),
            ],
        )
        rc = main()
        out = capsys.readouterr().out
        assert rc == 1
        assert "REGRESSION CHECK ABORTED" in out
    finally:
        drop_fixture_workspace(ws)
