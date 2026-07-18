# Access Groups + Telegram Integration — design spec

**Date:** 2026-07-18
**Status:** Approved (design). Builds on Plans 1–3 (auth, ingestion, ask+citations).
**Owner:** Dovud

---

## 0. What this is

Two layered capabilities, decided with the founder on 2026-07-18:

1. **Permission-aware retrieval via access groups** — a person only ever gets answers from documents they're allowed to see. This is the crown jewel (the #1 thing regulated buyers test; beats Onyx, which paywalls it). It applies on **every surface**.
2. **Telegram integration** — one bot per workspace; people `/start` it, an admin approves them and assigns groups; the bot answers, scoped to that person's accessible documents. A distribution surface that *reuses* capability #1.

Built as **two plans**: **Plan A** = access groups + permission-aware retrieval (web). **Plan B** = Telegram, reusing Plan A.

## 1. Confirmed decisions

| Decision | Choice |
|---|---|
| Access model | **Access groups** — documents tagged with groups; people belong to groups; retrieval intersects them |
| Telegram onboarding | **Admin approves + assigns groups** (no self-serve access grant) |
| Filter scope | **Every surface** (web Ask + Telegram + future MCP) — one rule underneath |
| Owner/admin | **Bypass the filter** — workspace owners/admins see all documents; members are group-scoped |
| Default visibility | New documents default to the seeded **"Everyone"** group (backward-compatible; nothing accidentally hidden) |
| Telegram transport | **Long-polling** (bot polls out; no inbound public webhook — better for on-prem) |
| Telegram scope | **Ask-only / read-only** — answer + citation labels; never raw source files; every query audited |

## 2. Data model (new tables)

- **`groups`** — `id`, `workspace_id`, `name`, `slug`, `is_default` (the seeded "Everyone"), `created_at`. Unique(workspace_id, slug).
- **`group_members`** — `id`, `workspace_id`, `group_id`, `user_id` (FK users, nullable), `telegram_link_id` (FK telegram_links, nullable), `created_at`. Exactly one principal column set (a member is a web user **or** a Telegram identity). Unique(group_id, user_id) / (group_id, telegram_link_id).
- **`document_groups`** — `document_id`, `workspace_id`, `group_id`. A document is visible to a group iff a row exists. Primary key (document_id, group_id).
- **`telegram_bots`** — `id`, `workspace_id` (unique), `bot_token_encrypted`, `bot_username`, `status` (`connected`|`disconnected`), `created_at`.
- **`telegram_links`** — `id`, `workspace_id`, `telegram_user_id` (bigint), `telegram_username`, `display_name`, `status` (`pending`|`approved`|`blocked`), `linked_user_id` (FK users, nullable), `created_at`, `approved_at`. Unique(workspace_id, telegram_user_id).

`memberships` (Plan 1) still governs workspace access + owner/member role — unchanged.

## 3. Permission-aware retrieval (Plan A, the core change)

The engine `retrieve()` gains parameters:
- `group_ids: list[str]` — the asking person's groups.
- `all_access: bool` — true for workspace owners/admins (skip the filter).

SQL predicate added to the ANN query:
```
AND ( :all_access
      OR EXISTS (SELECT 1 FROM document_groups dg
                 WHERE dg.document_id = c.document_id
                   AND dg.group_id = ANY(:group_ids)) )
```
Identity → groups is resolved by the **caller**, which already knows who's asking:
- **Web Ask:** the ask route resolves the current user's `group_members` (and `all_access = role in (owner)`), passes them to `/ask`.
- **Telegram:** the bot worker resolves `telegram_user_id → telegram_links(approved) → group_members`, passes them.

Engine `/ask` body gains `group_ids` + `all_access`. The rule lives in **one** SQL predicate, so no surface can forget it.

## 4. Access management UI (Plan A)

- **Groups** (new area, under an "Access" or "Integrations" rail item): create/rename/delete groups; add/remove web-user members; the "Everyone" group is present and non-deletable.
- **Sources:** each document gets a **"Visible to"** control (multi-select of groups; defaults to Everyone). Changing it writes `document_groups`.
- Owners see everything regardless; the UI notes that.

## 5. Telegram integration (Plan B, reuses Plan A)

**Bot worker** — a separate process (`bot/`, Python, reusing engine `retrieve`/`answer`/`db`), long-polling Telegram `getUpdates` for every connected workspace bot. One asyncio process manages all bots.

Flow:
- **`/start`** → upsert a `pending` `telegram_link`; reply "Access requested — an admin will approve you."
- Message while `pending`/`blocked` → "Your access is pending approval." / silence.
- Message while `approved` → resolve `group_ids` → permission-scoped `retrieve` + `answer` → reply with the answer + citation labels (`filename · p.N`). **Never** attach raw files. Write a `query_log` row tagged with the Telegram identity + source `telegram`.

**Bot token** stored **encrypted at rest** (AES-GCM, key from `TELEGRAM_ENC_KEY` env). Decrypted only in the worker.

**Integrations UI** — a **Telegram** card: paste bot token → validated via `getMe` (stores username + encrypted token) → status; disconnect. **Access requests** list: pending/approved links with **Approve / Block** and a group-assignment control (writes `group_members`).

## 6. Sovereignty & honesty (baked in)

The connect screen states plainly: *Telegram messages transit Telegram's cloud; the bot is ask-only and never sends your documents — for strict zero-egress, use the web app.* Long-poll (no inbound), identity-bound, fully audited. `query_log` captures every Telegram query.

## 7. Testing

- **Unit:** group-filter SQL (member of group X sees only X-tagged docs, never Y); owner `all_access` bypass; Telegram link state machine (pending→approved→answers; pending→refused); token encrypt/decrypt round-trip.
- **Integration:** two users, two groups, one restricted doc → each gets only their permitted answer; the excluded user gets an insufficient-evidence refusal for the restricted content.
- **Telegram:** `/start` → approve → ask flow against a stubbed Bot API; unapproved user is refused.

## 8. Build order

**Plan A — Access groups + permission-aware retrieval:** schema (groups/group_members/document_groups); seed "Everyone" + backfill existing docs to it; engine retrieve gains group filter; web ask resolves + passes groups; Groups management UI; per-document "Visible to" control. Deliverable: a member sees only their groups' documents on the web Ask; owner sees all.

**Plan B — Telegram integration:** schema (telegram_bots/telegram_links); token encryption; Integrations UI (connect + approve + assign); the bot worker (long-poll, /start, scoped answers, audit); compose `bot` service. Deliverable: connect a bot, approve a user with a group, they get permission-scoped cited answers in Telegram.

## 9. Out of scope (recorded)

Source-ACL *sync* from SharePoint/AD (needs connectors); self-serve Telegram access; Slack/Teams/Mattermost surfaces; per-chunk (vs per-document) visibility; nested groups. Each is a later slice.
