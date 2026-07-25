"""Aggregate usage — the data behind the super-admin panel's usage view.

Aggregate-only by design (product decision, not a convention): the admin sees
whether the product is being used and whether retrieval is failing, never what
any individual asked. The SQL below never selects `query_log.question` at
all — not "selects it and drops it before returning," but never puts it in a
SELECT list in the first place — so the omission survives a careless refactor.
See engine/tests/test_usage.py for the test that holds this invariant.
"""

MIN_DAYS = 1
MAX_DAYS = 365

_SUMMARY_SQL = """
WITH ql AS (
    SELECT workspace_id, user_id, question_type, degraded
    FROM query_log
    WHERE created_at >= now() - make_interval(days => %(days)s)
),
doc_counts AS (
    SELECT workspace_id, count(*) AS n
    FROM documents
    WHERE status = 'indexed'
    GROUP BY workspace_id
),
folder_counts AS (
    SELECT workspace_id, count(*) AS n
    FROM folders
    GROUP BY workspace_id
)
SELECT
    w.id,
    w.name,
    count(ql.workspace_id) AS questions,
    count(DISTINCT ql.user_id) AS active_users,
    coalesce(dc.n, 0) AS documents_indexed,
    coalesce(fc.n, 0) AS folders,
    count(*) FILTER (WHERE ql.question_type = 'lookup') AS q_lookup,
    count(*) FILTER (WHERE ql.question_type = 'comparison') AS q_comparison,
    count(*) FILTER (WHERE ql.question_type = 'aggregate') AS q_aggregate,
    count(*) FILTER (WHERE ql.question_type = 'enumerate') AS q_enumerate,
    count(*) FILTER (WHERE 'lexical_arm_empty' = ANY(ql.degraded)) AS lexical_arm_empty,
    count(*) FILTER (WHERE 'answer_uncited' = ANY(ql.degraded)) AS answer_uncited
FROM workspaces w
LEFT JOIN ql ON ql.workspace_id = w.id
LEFT JOIN doc_counts dc ON dc.workspace_id = w.id
LEFT JOIN folder_counts fc ON fc.workspace_id = w.id
GROUP BY w.id, w.name, dc.n, fc.n
ORDER BY w.name
"""

_PER_DAY_SQL = """
SELECT (date_trunc('day', created_at) AT TIME ZONE 'UTC')::date AS day,
       count(*) AS questions,
       count(DISTINCT user_id) AS active_users
FROM query_log
WHERE created_at >= now() - make_interval(days => %(days)s)
GROUP BY 1
ORDER BY 1
"""

# active_users cannot be derived from the per-workspace rows above: a person who
# asks questions in two workspaces would be counted once in each workspace's own
# DISTINCT, and summing those doubles them. This is its own unscoped DISTINCT
# over the whole window, across every workspace at once.
_TOTAL_ACTIVE_USERS_SQL = """
SELECT count(DISTINCT user_id)
FROM query_log
WHERE created_at >= now() - make_interval(days => %(days)s)
"""


def usage_summary(conn, days: int = 30) -> dict:
    """Trailing-window aggregate usage, platform-wide and per workspace.

    Every value returned is a count. `active_users` is `count(DISTINCT
    user_id)` — a number, never a list of ids or emails. Telegram-originated
    queries (`user_id IS NULL`, `telegram_link_id` set instead) are counted in
    `questions` but cannot contribute to `active_users` — COUNT(DISTINCT ...)
    ignores NULLs, so they are counted, not silently dropped.

    Every per-workspace `active_users` is its own DISTINCT scoped to that
    workspace. `totals["active_users"]` and each `per_day[]["active_users"]`
    are each their own unscoped DISTINCT over the relevant window too — NOT a
    sum of the per-workspace values — because a person active in two
    workspaces (or on two different days) is one active user, and summing
    per-workspace DISTINCTs would double-count them.

    `per_day` returns one row per day that actually has data; gaps are not
    synthesised as zero-rows.
    """
    days = max(MIN_DAYS, min(MAX_DAYS, days))

    rows = conn.execute(_SUMMARY_SQL, {"days": days}).fetchall()
    per_day_rows = conn.execute(_PER_DAY_SQL, {"days": days}).fetchall()
    total_active_users = conn.execute(_TOTAL_ACTIVE_USERS_SQL, {"days": days}).fetchone()[0]

    workspaces = [
        {
            "workspace_id": str(r[0]),
            "name": r[1],
            "questions": r[2],
            "active_users": r[3],
            "documents_indexed": r[4],
            "folders": r[5],
            "question_types": {
                "lookup": r[6],
                "comparison": r[7],
                "aggregate": r[8],
                "enumerate": r[9],
            },
            "lexical_arm_empty": r[10],
            "answer_uncited": r[11],
        }
        for r in rows
    ]

    def _sum(key: str) -> int:
        return sum(w[key] for w in workspaces)

    totals = {
        "questions": _sum("questions"),
        # NOT _sum("active_users"): the per-workspace values are each a DISTINCT
        # count scoped to that workspace, so summing them double-counts anyone
        # active in more than one workspace. This is a headline number on the
        # admin panel, so it must be the real platform-wide DISTINCT — do not
        # "simplify" this back into a sum.
        "active_users": total_active_users,
        "documents_indexed": _sum("documents_indexed"),
        "folders": _sum("folders"),
        "question_types": {
            t: sum(w["question_types"][t] for w in workspaces)
            for t in ("lookup", "comparison", "aggregate", "enumerate")
        },
        "lexical_arm_empty": _sum("lexical_arm_empty"),
        "answer_uncited": _sum("answer_uncited"),
    }

    per_day = [
        {"date": r[0].isoformat(), "questions": r[1], "active_users": r[2]}
        for r in per_day_rows
    ]

    return {"days": days, "workspaces": workspaces, "totals": totals, "per_day": per_day}
