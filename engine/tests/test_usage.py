import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

from app.library import usage as lib

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, name: str = "u") -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)", (ws, name, str(ws)))
    return str(ws)


def _user(conn) -> str:
    u = uuid.uuid4()
    conn.execute(
        "INSERT INTO users (id, email, password_hash) VALUES (%s,%s,'x')",
        (u, f"{u}@example.test"),
    )
    return str(u)


def _telegram_link(conn, ws: str) -> str:
    link = uuid.uuid4()
    conn.execute(
        "INSERT INTO telegram_links (id, workspace_id, telegram_user_id, telegram_username, "
        "display_name, status) VALUES (%s,%s,%s,'tguser','TG User','approved')",
        (link, ws, 12345),
    )
    return str(link)


def _query(
    conn,
    ws: str,
    *,
    user_id: str | None = None,
    telegram_link_id: str | None = None,
    question: str = "some question",
    question_type: str = "lookup",
    degraded: list[str] | None = None,
    created_at: datetime | None = None,
) -> None:
    conn.execute(
        "INSERT INTO query_log (workspace_id, user_id, telegram_link_id, question, "
        "question_type, degraded, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (
            ws,
            user_id,
            telegram_link_id,
            question,
            question_type,
            degraded,
            created_at or datetime.now(timezone.utc),
        ),
    )


def _cleanup(ws: str) -> None:
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_usage_summary_counts_questions_and_active_users():
    """usage_summary is platform-wide by design (it lists every workspace, even
    idle ones), so the shared dev DB's pre-existing query_log rows (from other
    days, other workspaces) are expected to be present. Per-workspace figures
    are asserted directly (isolated by workspace_id, unaffected by pollution);
    totals and per_day are asserted as a *delta* against a baseline captured
    before this test's rows exist, so the test is robust either way."""
    now = datetime.now(timezone.utc)
    today = now
    yesterday = now - timedelta(days=1)
    yesterday_key = yesterday.date().isoformat()
    today_key = today.date().isoformat()

    with psycopg.connect(DB) as conn:
        baseline = lib.usage_summary(conn, days=30)
        baseline_per_day = {d["date"]: d for d in baseline["per_day"]}
        base_yesterday = baseline_per_day.get(yesterday_key, {"questions": 0, "active_users": 0})
        base_today = baseline_per_day.get(today_key, {"questions": 0, "active_users": 0})

        with conn.transaction():
            ws = _ws(conn, "Acme")
            u1, u2 = _user(conn), _user(conn)
            link = _telegram_link(conn, ws)

            # Day 1 (yesterday): u1 asks a lookup question, u2 asks a comparison question.
            _query(conn, ws, user_id=u1, question_type="lookup", created_at=yesterday)
            _query(conn, ws, user_id=u2, question_type="comparison", created_at=yesterday)

            # Day 2 (today): u1 asks again (aggregate), and a Telegram identity asks
            # (enumerate) — no user_id, so it must count toward `questions` but not
            # toward `active_users`.
            _query(conn, ws, user_id=u1, question_type="aggregate", created_at=today)
            _query(
                conn,
                ws,
                user_id=None,
                telegram_link_id=link,
                question_type="enumerate",
                created_at=today,
                degraded=["lexical_arm_empty"],
            )

        result = lib.usage_summary(conn, days=30)

    try:
        assert result["days"] == 30
        # usage_summary lists every workspace (so the panel can see zero-activity
        # ones too) — the dev DB carries workspaces from other tests/tasks, so
        # find this test's own workspace rather than assume it's alone.
        matches = [w for w in result["workspaces"] if w["workspace_id"] == ws]
        assert len(matches) == 1
        w = matches[0]
        assert w["name"] == "Acme"
        assert w["questions"] == 4, "the telegram-originated row must be counted, not dropped"
        assert w["active_users"] == 2, "active_users is a count of DISTINCT user_id; telegram rows (user_id IS NULL) don't contribute"
        assert isinstance(w["active_users"], int)
        assert w["question_types"] == {
            "lookup": 1,
            "comparison": 1,
            "aggregate": 1,
            "enumerate": 1,
        }
        assert w["lexical_arm_empty"] == 1
        assert w["answer_uncited"] == 0

        assert result["totals"]["questions"] == baseline["totals"]["questions"] + 4
        assert result["totals"]["active_users"] == baseline["totals"]["active_users"] + 2
        assert result["totals"]["lexical_arm_empty"] == baseline["totals"]["lexical_arm_empty"] + 1

        per_day = {d["date"]: d for d in result["per_day"]}
        assert per_day[yesterday_key]["questions"] == base_yesterday["questions"] + 2
        assert per_day[yesterday_key]["active_users"] == base_yesterday["active_users"] + 2
        assert per_day[today_key]["questions"] == base_today["questions"] + 2
        assert per_day[today_key]["active_users"] == base_today["active_users"] + 1
    finally:
        _cleanup(ws)


def test_usage_summary_never_returns_question_text_or_per_user_rows():
    """The aggregate-only guarantee, made structural rather than a convention.

    The `question` column must never be selected by usage_summary's SQL at all —
    that is what makes this test pass structurally rather than by luck (a query
    that selected `question` and merely omitted it from the returned dict would
    still risk leaking it via a future refactor)."""
    sentinel = "SENTINEL-SECRET-QUESTION-do-not-leak-this-4f8a1c"

    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn, "Sentinel Co")
            user_id = _user(conn)
            _query(conn, ws, user_id=user_id, question=sentinel, question_type="lookup")

        result = lib.usage_summary(conn, days=30)

    try:
        serialized = json.dumps(result)
        assert sentinel not in serialized, "usage_summary must never return question text"
        assert user_id not in serialized, "usage_summary must never key or embed a user id"

        # No per-user row anywhere: every workspace entry's values are counts
        # (int/dict-of-ints), never a list of individual activity.
        for w in result["workspaces"]:
            for key, value in w.items():
                if key in ("workspace_id", "name"):
                    continue
                if isinstance(value, dict):
                    assert all(isinstance(v, int) for v in value.values()), (
                        f"{key} must be a dict of counts, not per-user data"
                    )
                else:
                    assert isinstance(value, int), f"{key} must be a count, not a row or list"
    finally:
        _cleanup(ws)
