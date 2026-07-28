import asyncio
import logging

from ..db import get_conn
from ..telegram import api as tg_api, store as tg_store
from ..telegram.handler import handle_update_pooled

log = logging.getLogger(__name__)

# Sent when answering raised. Silence is the wrong failure here: the person sees
# nothing, assumes the bot is broken, and no operator learns that it is.
FAILED = "Something went wrong answering that. Please try again in a moment."


async def _handle_one(workspace_id: str, update: dict) -> str | None:
    """One update, off the event loop.

    `handle_update_pooled` is synchronous and spends most of its time inside an
    embedding call and a chat call (timeout=120). Calling it directly from the
    coroutine froze the whole worker — including every OTHER workspace's bot —
    for the duration of one person's question."""
    return await asyncio.to_thread(handle_update_pooled, workspace_id, update)


async def _poll_once() -> None:
    with get_conn() as conn:
        bots = tg_store.connected_bots(conn)

    for bot in bots:
        ws = bot["workspace_id"]
        offset = (bot["offset"] or 0) + 1
        try:
            updates = await asyncio.to_thread(tg_api.get_updates, bot["token"], offset, 0)
        except Exception:
            # Telegram unreachable or the token was revoked. Do NOT advance the
            # offset — nothing was consumed, so the next poll retries.
            log.warning("[bot] getUpdates failed for workspace %s", ws, exc_info=True)
            continue

        last = bot["offset"] or 0
        for u in updates:
            update_id = u["update_id"]
            chat = (u.get("message") or {}).get("chat", {})
            try:
                reply = await _handle_one(ws, u)
            except Exception:
                # The offset still advances below: a message that reliably
                # raises would otherwise wedge this bot forever, re-delivered
                # on every poll. That is a deliberate trade, so it is LOGGED —
                # it used to be an `except: reply = None` with no line anywhere,
                # which meant a person's question vanished silently.
                log.exception("[bot] failed to answer update %s in workspace %s", update_id, ws)
                reply = FAILED

            if reply and chat.get("id"):
                try:
                    await asyncio.to_thread(
                        tg_api.send_message, bot["token"], chat["id"], reply, "HTML"
                    )
                except Exception:
                    log.exception(
                        "[bot] failed to send reply for update %s in workspace %s", update_id, ws
                    )
            # Acked only after we have tried to handle and answer it.
            last = max(last, update_id)

        if last != (bot["offset"] or 0):
            with get_conn() as c:
                with c.transaction():
                    c.execute(
                        "UPDATE telegram_bots SET last_update_id=%s WHERE workspace_id=%s",
                        (last, ws),
                    )


async def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("[bot] worker started")
    while True:
        try:
            await _poll_once()
        except Exception:  # noqa: BLE001 — never let the loop die
            log.exception("[bot] poll error")
        await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(run())
