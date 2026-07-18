# Telegram Integration — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Telegram bot per workspace. A person `/start`s the bot, an admin approves them and assigns groups in the dashboard, and the bot answers their questions — **scoped to exactly the documents their groups allow** (reusing Plan A), ask-only, over long-polling.

**Architecture:** The **engine owns all Telegram + token logic** (so encryption lives in one language). Connect/validate/encrypt happens in engine endpoints; a separate **bot worker** process (`engine/app/bot/`, reusing engine `retrieve`/`answer`/`db`) long-polls `getUpdates` for every connected bot and answers. The **dashboard** owns the admin side: connect a bot, and approve/block Telegram users + assign their groups (plain DB writes). The bot token is stored **encrypted** (Fernet, key from `TELEGRAM_ENC_KEY`).

**Tech Stack:** engine + `cryptography` (Fernet) + httpx to the Bot API; a long-poll worker; Next.js integrations routes + UI; a compose `bot` service.

This is **Plan B** of `docs/superpowers/specs/2026-07-18-access-groups-and-telegram-design.md`. It builds on Plan A (access groups) — a Telegram user's access resolves through the *same* `document_groups` filter.

## Global Constraints

- **Ask-only / read-only:** the bot replies with an answer + citation labels (`filename · p.N`). It **never** sends raw files. Every answer is scoped by the asker's groups; Telegram users are never `all_access`.
- **Every Telegram query writes a `query_log` row** (provenance) tagged with the Telegram identity.
- **Long-polling only** (bot polls out; no inbound webhook).
- **Token encrypted at rest** (Fernet); decrypted only inside the engine/worker. Never returned to the browser, never logged.
- Engine Telegram endpoints are `X-Engine-Secret`-guarded. The browser never calls the engine.
- **Honesty:** the connect UI states plainly that Telegram messages transit Telegram's cloud; the bot is ask-only and never sends documents; for strict zero-egress, use the web app.
- Reuse brand tokens; mono for labels; `-text` accent variants; visible focus + reduced-motion.

---

## File Structure

**Web — schema:** `lib/db/schema.ts` (+ `telegramBots`, `telegramLinks`, + `groupMembers.telegramLinkId`) + migration.
**Web — created:** `lib/telegram.ts` (engine proxy + link/group queries), `app/api/integrations/telegram/route.ts` (GET status+links, POST connect, DELETE disconnect), `app/api/telegram-links/[id]/route.ts` (POST approve/block), `app/api/telegram-links/[id]/groups/route.ts` (PUT set groups), `app/(app)/dashboard/integrations/page.tsx` (+ `Integrations.tsx`).
**Web — modified:** `app/(app)/_components/Rail.tsx` (+ Integrations), `lib/groups.ts` (+ `setTelegramLinkGroups`).
**Engine — created:** `app/telegram/__init__.py`, `app/telegram/crypto.py` (Fernet), `app/telegram/api.py` (getMe/sendMessage/getUpdates), `app/telegram/store.py` (bots/links DB + tg access resolution), `app/telegram/handler.py` (`handle_update`), `app/bot/__init__.py`, `app/bot/worker.py` (long-poll loop); tests `test_tg_crypto.py`, `test_tg_handler.py`.
**Engine — modified:** `app/main.py` (`/telegram/connect`, `/telegram/disconnect`), `app/settings.py` (`telegram_enc_key`), `pyproject.toml` (+ `cryptography`).
**Root:** `docker-compose.yml` (+ `bot` service), `.env`/`.env.example` (+ `TELEGRAM_ENC_KEY`).

---

## Task 1: Schema — telegram_bots, telegram_links, group_members.telegram_link_id

**Files:** Modify `web/lib/db/schema.ts`; migration.

- [ ] **Step 1: Append + extend in `web/lib/db/schema.ts`**

```ts
export const telegramBots = pgTable('telegram_bots', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().unique().references(() => workspaces.id, { onDelete: 'cascade' }),
  botTokenEncrypted: text('bot_token_encrypted').notNull(),
  botUsername: text('bot_username').notNull(),
  lastUpdateId: bigint('last_update_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const telegramLinks = pgTable(
  'telegram_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
    telegramUsername: text('telegram_username'),
    displayName: text('display_name'),
    status: text('status').notNull().default('pending'), // pending | approved | blocked
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [index('telegram_links_workspace_idx').on(t.workspaceId)],
)
```
And add the Telegram-principal column to `groupMembers` (add this field to the existing table definition):
```ts
    telegramLinkId: uuid('telegram_link_id').references(() => telegramLinks.id, { onDelete: 'cascade' }),
```

- [ ] **Step 2:** `cd web && npm run db:generate` then migrate; verify `telegram_bots`, `telegram_links` exist and `group_members` has `telegram_link_id`.
- [ ] **Step 3: Commit** — `git add web/lib/db/schema.ts web/lib/db/migrations && git commit -m "Schema: telegram_bots, telegram_links, group_members.telegram_link_id"`

---

## Task 2: Engine token crypto + Telegram API client + connect endpoints

**Files:** Modify `engine/pyproject.toml`, `engine/app/settings.py`, `engine/app/main.py`; create `engine/app/telegram/{__init__,crypto,api,store}.py`; test `engine/tests/test_tg_crypto.py`.

- [ ] **Step 1:** `cd engine && uv add cryptography`. Add `telegram_enc_key: str = ""` to `Settings`.
- [ ] **Step 2: `crypto.py`** — Fernet encrypt/decrypt using `settings.telegram_enc_key`.

```python
from cryptography.fernet import Fernet
from ..settings import settings

def _f() -> Fernet:
    return Fernet(settings.telegram_enc_key.encode())

def encrypt(plain: str) -> str:
    return _f().encrypt(plain.encode()).decode()

def decrypt(token: str) -> str:
    return _f().decrypt(token.encode()).decode()
```

- [ ] **Step 3: test `test_tg_crypto.py`** — round-trip (needs a real Fernet key in env).

```python
import os, pytest
from cryptography.fernet import Fernet

@pytest.fixture(autouse=True)
def _key(monkeypatch):
    from app import settings as s
    monkeypatch.setattr(s.settings, "telegram_enc_key", Fernet.generate_key().decode())

def test_encrypt_roundtrip():
    from app.telegram.crypto import encrypt, decrypt
    assert decrypt(encrypt("123:abc")) == "123:abc"
```

- [ ] **Step 4: `api.py`** — thin httpx client.

```python
import httpx

BASE = "https://api.telegram.org/bot{token}/{method}"

def call(token: str, method: str, params: dict | None = None, timeout: float = 30) -> dict:
    r = httpx.post(BASE.format(token=token, method=method), json=params or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()

def get_me(token: str) -> dict:
    return call(token, "getMe")

def send_message(token: str, chat_id: int, text: str) -> None:
    call(token, "sendMessage", {"chat_id": chat_id, "text": text})

def get_updates(token: str, offset: int | None, timeout: int = 20) -> list[dict]:
    res = call(token, "getUpdates", {"offset": offset, "timeout": timeout}, timeout=timeout + 10)
    return res.get("result", [])
```

- [ ] **Step 5: `store.py`** — bot/link DB helpers + Telegram access resolution.

```python
from .crypto import encrypt, decrypt
from ..db import get_conn

def connect_bot(workspace_id: str, token: str, username: str) -> None:
    conn = get_conn()
    try:
        with conn.transaction():
            conn.execute(
                "INSERT INTO telegram_bots (workspace_id, bot_token_encrypted, bot_username) "
                "VALUES (%s,%s,%s) ON CONFLICT (workspace_id) DO UPDATE "
                "SET bot_token_encrypted=EXCLUDED.bot_token_encrypted, bot_username=EXCLUDED.bot_username",
                (workspace_id, encrypt(token), username),
            )
    finally:
        conn.close()

def disconnect_bot(workspace_id: str) -> None:
    conn = get_conn()
    try:
        with conn.transaction():
            conn.execute("DELETE FROM telegram_bots WHERE workspace_id=%s", (workspace_id,))
    finally:
        conn.close()

def connected_bots(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT workspace_id, bot_token_encrypted, bot_username, last_update_id FROM telegram_bots"
    ).fetchall()
    return [
        {"workspace_id": str(r[0]), "token": decrypt(r[1]), "username": r[2], "offset": r[3]}
        for r in rows
    ]

def tg_access(conn, workspace_id: str, link_id: str) -> list[str]:
    ev = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (workspace_id,)
    ).fetchone()
    rows = conn.execute(
        "SELECT group_id FROM group_members WHERE workspace_id=%s AND telegram_link_id=%s",
        (workspace_id, link_id),
    ).fetchall()
    ids = {str(ev[0])} if ev else set()
    ids |= {str(r[0]) for r in rows}
    return list(ids)
```

- [ ] **Step 6: engine `/telegram/connect` + `/telegram/disconnect`** in `main.py` (secret-guarded). Connect: `getMe(token)` → if not ok, 400; else `connect_bot` + return `{username}`.

```python
from .telegram import api as tg_api, store as tg_store

class TgConnectBody(BaseModel):
    workspace_id: str
    token: str

@app.post("/telegram/connect", dependencies=[Depends(require_secret)])
def telegram_connect(body: TgConnectBody):
    me = tg_api.get_me(body.token)
    if not me.get("ok"):
        raise HTTPException(status_code=400, detail="invalid bot token")
    username = me["result"].get("username", "bot")
    tg_store.connect_bot(body.workspace_id, body.token, username)
    return {"username": username}

class TgWsBody(BaseModel):
    workspace_id: str

@app.post("/telegram/disconnect", dependencies=[Depends(require_secret)])
def telegram_disconnect(body: TgWsBody):
    tg_store.disconnect_bot(body.workspace_id)
    return {"ok": True}
```
(Import `HTTPException` from fastapi.)

- [ ] **Step 7:** Run `uv run pytest tests/test_tg_crypto.py -q` → PASS. Commit — engine crypto + Telegram client + connect endpoints.

---

## Task 3: Engine message handler (TDD) — /start, approval gate, scoped answer

**Files:** Create `engine/app/telegram/handler.py`; test `engine/tests/test_tg_handler.py`.

**Interfaces:** `handle_update(conn, workspace_id, update) -> str | None` — returns the reply text (or None to ignore). Pure logic + DB; no network. Upserts links, gates on status, and for approved users runs the permission-scoped retrieve+answer and logs the query.

- [ ] **Step 1: test `test_tg_handler.py`** (needs DATABASE_URL) — seed a workspace + a Finance-only doc; a `/start` from a new user creates a pending link and returns a "requested" message; a question while pending returns the pending message; after approving + adding the link to Finance, the question returns an answer mentioning the doc; a still-pending different user is refused.
- [ ] **Step 2: `handler.py`**

```python
from .store import tg_access
from ..ask.retrieve import retrieve
from ..ask.answer import answer_question

REQUESTED = "Access requested. An admin will approve you shortly."
PENDING = "Your access is still pending approval."
BLOCKED = "Your access has been blocked."

def _upsert_link(conn, workspace_id, tg_user) -> tuple[str, str]:
    row = conn.execute(
        "SELECT id, status FROM telegram_links WHERE workspace_id=%s AND telegram_user_id=%s",
        (workspace_id, tg_user["id"]),
    ).fetchone()
    if row:
        return str(row[0]), row[1]
    r = conn.execute(
        "INSERT INTO telegram_links (workspace_id, telegram_user_id, telegram_username, display_name, status) "
        "VALUES (%s,%s,%s,%s,'pending') RETURNING id",
        (workspace_id, tg_user["id"], tg_user.get("username"), tg_user.get("first_name")),
    ).fetchone()
    return str(r[0]), "pending"

def handle_update(conn, workspace_id: str, update: dict) -> str | None:
    msg = update.get("message")
    if not msg or "text" not in msg:
        return None
    text = msg["text"].strip()
    tg_user = msg["from"]
    with conn.transaction():
        link_id, status = _upsert_link(conn, workspace_id, tg_user)
    if text.startswith("/start"):
        return REQUESTED if status == "pending" else "You're connected. Ask me anything about your team's knowledge."
    if status == "pending":
        return PENDING
    if status == "blocked":
        return BLOCKED
    # approved -> permission-scoped answer
    group_ids = tg_access(conn, workspace_id, link_id)
    retrieved = retrieve(workspace_id, text, group_ids=group_ids, all_access=False)
    result = answer_question(text, retrieved)
    with conn.transaction():
        conn.execute(
            "INSERT INTO query_log (workspace_id, user_id, question, retrieved_chunk_ids, model) "
            "SELECT %s, m.user_id, %s, %s, %s FROM memberships m "
            "WHERE m.workspace_id=%s AND m.role='owner' LIMIT 1",
            (workspace_id, f"[telegram:{tg_user['id']}] {text}",
             [r.chunk_id for r in retrieved], "fake-telegram", workspace_id),
        )
    cites = " ".join(f"[{c.marker}] {c.filename}" for c in result.citations)
    return result.answer + (f"\n\nSources: {cites}" if cites else "")
```
(Note: `query_log.user_id` is NOT NULL; v1 attributes Telegram queries to the workspace owner with a `[telegram:<id>]` prefix in the question. A dedicated `telegram_link_id` column on `query_log` is a later refinement.)

- [ ] **Step 3:** Run the handler test → PASS. Full engine suite. Commit.

---

## Task 4: Bot worker (long-poll) + compose service

**Files:** Create `engine/app/bot/__init__.py`, `engine/app/bot/worker.py`; modify `docker-compose.yml`, `.env`/`.env.example`.

- [ ] **Step 1: `worker.py`** — an asyncio loop: every cycle, load connected bots; for each, `get_updates(offset)`, run `handle_update` per update, `send_message` the reply, and persist the new `last_update_id`.

```python
import asyncio
from ..db import get_conn
from ..telegram import api as tg_api, store as tg_store
from ..telegram.handler import handle_update

async def _poll_once():
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
            finally:
                c.close()
            chat = (u.get("message") or {}).get("chat", {})
            if reply and chat.get("id"):
                try:
                    await asyncio.to_thread(tg_api.send_message, bot["token"], chat["id"], reply)
                except Exception:
                    pass
        if last != (bot["offset"] or 0):
            c = get_conn()
            try:
                with c.transaction():
                    c.execute("UPDATE telegram_bots SET last_update_id=%s WHERE workspace_id=%s",
                              (last, bot["workspace_id"]))
            finally:
                c.close()

async def run():
    while True:
        await _poll_once()
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(run())
```
(Use `timeout=0` on getUpdates to keep the loop simple; a real long-poll timeout is an optimization.)

- [ ] **Step 2: compose `bot` service** — reuse the engine image, command `uv run python -m app.bot.worker`, same env as engine + `TELEGRAM_ENC_KEY`; no ports; depends_on db. Add `TELEGRAM_ENC_KEY` to `engine` too.
- [ ] **Step 3:** Add `TELEGRAM_ENC_KEY` to `.env.example` (documented: a Fernet key) and generate one into local `.env` (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
- [ ] **Step 4:** `docker compose config` validates. Commit — bot worker + compose service.

---

## Task 5: Web integrations API (connect/disconnect/status + approve/block + groups)

**Files:** Create `web/lib/telegram.ts`, `web/app/api/integrations/telegram/route.ts`, `web/app/api/telegram-links/[id]/route.ts`, `web/app/api/telegram-links/[id]/groups/route.ts`; modify `web/lib/groups.ts` (+ `setTelegramLinkGroups`).

- [ ] **Step 1: `lib/telegram.ts`** — `connectTelegram(workspaceId, token)` and `disconnectTelegram(workspaceId)` proxy to the engine (internal secret); `getTelegramStatus(workspaceId)` reads `telegram_bots`; `listLinks(workspaceId)` reads `telegram_links` (+ each link's group ids).
- [ ] **Step 2: `lib/groups.ts` + `setTelegramLinkGroups(linkId, workspaceId, groupIds)`** — writes `group_members` rows with `telegramLinkId` (mirror of `setGroupMembers`).
- [ ] **Step 3: `app/api/integrations/telegram/route.ts`** — `GET` (status + links + workspace groups), `POST {token}` (connect via engine, auth+CSRF), `DELETE` (disconnect).
- [ ] **Step 4: `app/api/telegram-links/[id]/route.ts`** — `POST {action}` approve/block (sets status + approvedAt). `app/api/telegram-links/[id]/groups/route.ts` — `PUT {groupIds}`.
- [ ] **Step 5:** Typecheck + commit.

---

## Task 6: Integrations UI + rail

**Files:** Create `web/app/(app)/dashboard/integrations/page.tsx`, `web/app/(app)/dashboard/integrations/Integrations.tsx`; modify `web/app/(app)/_components/Rail.tsx`.

- [ ] **Step 1: `Integrations.tsx`** (client) — a **Telegram** card: if disconnected, an input for the bot token + Connect (with the honesty note about Telegram's cloud); if connected, show `@username` + Disconnect. **Access requests**: list links (pending highlighted) with **Approve / Block** and a group multiselect (reusing the chip pattern). On-brand.
- [ ] **Step 2: `integrations/page.tsx`** — server page (getCurrentUser + issueCsrf) rendering `<Integrations />` in the standard shell with an "Integrations" header.
- [ ] **Step 3: Rail** — add `{ href: '/dashboard/integrations', label: 'Integrations' }`.
- [ ] **Step 4: Build + commit.**

---

## Task 7: End-to-end verification

**Needs a real Telegram bot token from @BotFather** (ask the founder). Stubbed unit tests (Tasks 2–3) already prove the handler + crypto without a token.

- [ ] **Step 1:** Bring up db + engine + bot + web (compose or host). Set `TELEGRAM_ENC_KEY`.
- [ ] **Step 2 (dashboard):** Integrations → paste the bot token → Connect → shows `@username`.
- [ ] **Step 3 (Telegram):** message the bot `/start` → "Access requested"; a question → "pending". In the dashboard, the request appears; **Approve** + assign a group; message again → a **permission-scoped cited answer** (only from docs that group can see).
- [ ] **Step 4:** Assert `query_log` has the Telegram query; a user with no group (or Everyone only, docs restricted) gets the refusal.
- [ ] **Step 5:** Stop; run suites.

---

## Self-Review (against spec)

**Coverage:** §2 telegram_bots/telegram_links (+ group_members.telegram_link_id) → T1; token encryption → T2; connect/disconnect → T2; /start + approval gate + scoped answer + audit → T3; long-poll worker + compose → T4; admin approve/block + group assign → T5; Integrations UI + honesty note → T6. ✓
**Placeholders:** none. **Types:** engine `tg_access`→`retrieve(group_ids,...)` reuses Plan A; `telegram_links.status` values consistent across handler + web. ✓
**Known limits:** `query_log` attributes Telegram queries to the owner with a `[telegram:id]` prefix (dedicated column later); worker uses short-poll (`timeout=0` + 2s sleep) not true long-poll; one process for all bots; no rate-limit on the bot; Telegram cloud transit disclosed, not eliminated (Mattermost is the strict-sovereign alternative, later).
