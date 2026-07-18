import asyncio

from ..db import get_conn
from ..telegram import api as tg_api, store as tg_store
from ..telegram.handler import handle_update


async def _poll_once() -> None:
    conn = get_conn()
    try:
        bots = tg_store.connected_bots(conn)
    finally:
        conn.close()

    for bot in bots:
        offset = (bot["offset"] or 0) + 1
        try:
            updates = await asyncio.to_thread(tg_api.get_updates, bot["token"], offset, 0)
        except Exception:
            continue
        last = bot["offset"] or 0
        for u in updates:
            last = max(last, u["update_id"])
            c = get_conn()
            try:
                reply = handle_update(c, bot["workspace_id"], u)
            except Exception:
                reply = None
            finally:
                c.close()
            chat = (u.get("message") or {}).get("chat", {})
            if reply and chat.get("id"):
                try:
                    await asyncio.to_thread(
                        tg_api.send_message, bot["token"], chat["id"], reply, "HTML"
                    )
                except Exception:
                    pass
        if last != (bot["offset"] or 0):
            c = get_conn()
            try:
                with c.transaction():
                    c.execute(
                        "UPDATE telegram_bots SET last_update_id=%s WHERE workspace_id=%s",
                        (last, bot["workspace_id"]),
                    )
            finally:
                c.close()


async def run() -> None:
    print("[bot] worker started")
    while True:
        try:
            await _poll_once()
        except Exception as e:  # noqa: BLE001 — never let the loop die
            print(f"[bot] poll error: {e}")
        await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(run())
