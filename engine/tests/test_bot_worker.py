"""The Telegram worker must not pin a pooled connection across the ask path,
must not block the event loop, and must not lose a message silently.

The old worker did all three in one statement:

    with get_conn() as conn:
        reply = handle_update(c, ...)          # -> answer_query -> 2 more conns

`answer_query` opens two connections of its own and makes an embedding call plus
a chat call in between, so that line was a re-entrant acquisition held across a
120s network round-trip, on the event loop, wrapped in a bare `except` with no
log line.
"""

import asyncio
import logging
import os
import uuid
from contextlib import contextmanager

import pytest

from app.bot import worker
from app.telegram import handler as tg_handler

DB = os.environ.get("DATABASE_URL")


def _update(update_id: int = 1, text: str = "hello") -> dict:
    return {
        "update_id": update_id,
        "message": {"text": text, "from": {"id": 42, "username": "u"}, "chat": {"id": 99}},
    }


def test_handle_one_runs_off_the_event_loop():
    """asyncio.to_thread, not a direct call — otherwise one person's 120s
    question freezes every other workspace's bot too."""
    loop_thread: list[str] = []
    main_thread = None

    def fake_handler(workspace_id, update):
        import threading

        loop_thread.append(threading.current_thread().name)
        return "ok"

    async def go():
        import threading

        nonlocal main_thread
        main_thread = threading.current_thread().name
        return await worker._handle_one("ws", _update())

    original = worker.handle_update_pooled
    worker.handle_update_pooled = fake_handler
    try:
        assert asyncio.run(go()) == "ok"
    finally:
        worker.handle_update_pooled = original

    assert loop_thread and loop_thread[0] != main_thread, (
        "the handler ran on the event loop thread — it must be dispatched via to_thread"
    )


@pytest.mark.skipif(not DB, reason="needs DATABASE_URL")
def test_pooled_handler_releases_its_connection_before_answering(monkeypatch, track_checkouts):
    """The connection used to resolve the Telegram identity must be back in the
    pool before answer_query runs — answer_query opens two of its own and makes
    an embedding call plus a chat call in between."""
    observed: list[int] = []

    def fake_resolve(conn, workspace_id, update):
        return tg_handler.Principal(
            link_id=str(uuid.uuid4()), group_ids=[], text="q", telegram_user_id=42
        )

    with track_checkouts(tg_handler) as held:

        def fake_answer_query(*args, **kwargs):
            observed.append(held())

            class R:
                answer = "an answer"
                citations = []

            return R()

        monkeypatch.setattr(tg_handler, "answer_query", fake_answer_query)
        monkeypatch.setattr(tg_handler, "resolve_principal", fake_resolve)
        tg_handler.handle_update_pooled("ws", _update())

    assert observed == [0], f"a pooled connection was held across the ask path: {observed}"


def test_a_failed_answer_is_logged_and_replied_to_not_swallowed(monkeypatch, caplog):
    """It used to be `except Exception: reply = None` — the person got nothing
    and no operator learned why. The recovery lives in _poll_once, so that is
    what is driven here, with the DB and Telegram both stubbed out."""
    sent: list[str] = []

    executed: list[tuple] = []

    class FakeConn:
        @contextmanager
        def transaction(self):
            yield

        def execute(self, sql, params=None):
            executed.append((sql, params))

    @contextmanager
    def fake_conn():
        yield FakeConn()

    async def boom(workspace_id, update):
        raise RuntimeError("model exploded")

    monkeypatch.setattr(worker, "get_conn", fake_conn)
    monkeypatch.setattr(
        worker.tg_store,
        "connected_bots",
        lambda conn: [{"workspace_id": "ws", "token": "t", "username": "b", "offset": 0}],
    )
    monkeypatch.setattr(worker.tg_api, "get_updates", lambda token, offset, timeout: [_update()])
    monkeypatch.setattr(
        worker.tg_api,
        "send_message",
        lambda token, chat_id, text, parse_mode=None: sent.append(text),
    )
    monkeypatch.setattr(worker, "_handle_one", boom)

    with caplog.at_level(logging.ERROR):
        asyncio.run(worker._poll_once())

    assert sent == [worker.FAILED], "the person must be told, not left in silence"
    assert any("failed to answer update" in r.getMessage() for r in caplog.records)
    # The offset still advances: a message that reliably raises must not wedge
    # the bot into re-delivering it on every poll forever. That is a deliberate
    # trade, which is exactly why the log line above is not optional.
    assert any("last_update_id" in sql for sql, _ in executed)


def test_offset_advances_only_after_the_update_was_handled():
    """`last = max(last, update_id)` used to run BEFORE handling, so a message
    that raised was acked anyway. The ordering is what this asserts."""
    import inspect

    src = inspect.getsource(worker._poll_once)
    handled_at = src.index("_handle_one")
    acked_at = src.index("last = max(last, update_id)")
    assert handled_at < acked_at, "the update is acked before it is handled"


@pytest.mark.parametrize("update", [{"update_id": 1}, {"update_id": 2, "message": {}}])
def test_non_text_updates_are_ignored(update):
    assert tg_handler.resolve_principal(None, "ws", update) is None
