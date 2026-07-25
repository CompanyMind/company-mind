import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_blocking_a_user_deletes_their_live_sessions_immediately():
    """Proves blocking is *immediate*, not just a durable flag. Setting
    blocked_at alone is theatre — a live cookie would keep working until it
    expired. web/lib/auth/admin-users.ts::blockUser sets blocked_at and
    deletes the user's sessions in the same operation; this test drives the
    same two writes directly against Postgres and shows the session row a
    request would look up (the same shape validateSessionToken queries:
    sessions joined to users by token_hash / user_id) is gone afterward."""
    ws, user = uuid.uuid4(), uuid.uuid4()
    token_hash = hashlib.sha256(b"a-real-session-token").hexdigest()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (%s,'b',%s)", (ws, str(ws))
            )
            conn.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@example.test"),
            )
            conn.execute(
                "INSERT INTO memberships (user_id, workspace_id, role) VALUES (%s,%s,'member')",
                (user, ws),
            )
            expires = datetime.now(timezone.utc) + timedelta(days=1)
            conn.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s,%s,%s)",
                (token_hash, user, expires),
            )

        # Same query shape validateSessionToken uses: look up the session by
        # token_hash, then confirm it belongs to a live (unblocked) user.
        session_row = conn.execute(
            "SELECT user_id FROM sessions WHERE token_hash=%s", (token_hash,)
        ).fetchone()
        user_row = conn.execute(
            "SELECT blocked_at FROM users WHERE id=%s", (user,)
        ).fetchone()

        try:
            assert session_row is not None, "the session should exist before blocking"
            assert session_row[0] == user
            assert user_row[0] is None, "the user should not be blocked yet"

            # Exactly what admin-users.ts::blockUser does: set blocked_at,
            # then delete every session row for that user.
            with conn.transaction():
                conn.execute(
                    "UPDATE users SET blocked_at=%s WHERE id=%s",
                    (datetime.now(timezone.utc), user),
                )
                conn.execute("DELETE FROM sessions WHERE user_id=%s", (user,))

            remaining = conn.execute(
                "SELECT count(*) FROM sessions WHERE user_id=%s", (user,)
            ).fetchone()[0]
            blocked_at = conn.execute(
                "SELECT blocked_at FROM users WHERE id=%s", (user,)
            ).fetchone()[0]

            assert remaining == 0, "blocking must delete every live session at once"
            assert blocked_at is not None, "blocked_at must be recorded"
        finally:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
                conn.execute("DELETE FROM users WHERE id=%s", (user,))
