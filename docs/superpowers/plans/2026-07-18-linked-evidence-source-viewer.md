# Linked Evidence — Source Viewer + Tappable Citations (Plan C)

> **For agentic workers:** Use superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Every citation (web + Telegram) becomes a tappable link that opens the document in the CompBrain web app with the **exact cited passage highlighted** — permission-checked. Plus: fix the Telegram provenance-log gap.

**Design (approved):** store each document's extracted text at ingest; a login-gated, group-scoped `/s/<chunkId>` viewer renders the document with `[char_start,char_end]` highlighted; Telegram replies link each source via `parse_mode=HTML`; the web Ask links citations to the same viewer. Tap-through auth = "log into the app" (signed one-time links deferred).

## Constraints
- The viewer is **permission-checked**: the caller must be able to see the document (owner bypass or the doc's groups intersect the caller's groups), else 404. Never leak a restricted source via a link.
- Telegram links point at `APP_URL` (engine/worker env). The bot still never sends the document itself — only a link into the sovereign app.
- Reuse brand tokens; the highlight is `--brain` tinted.

---

## Task 1: Schema — documents.extracted_text + query_log telegram audit
- [ ] Add to `web/lib/db/schema.ts`: `documents.extractedText` (`text('extracted_text')`, nullable); make `queryLog.userId` nullable and add `queryLog.telegramLinkId` (uuid, nullable, FK telegram_links, onDelete set null/cascade).
- [ ] `npm run db:generate` + migrate + verify.
- [ ] Commit.

## Task 2: Engine — store extracted text at ingest + fix Telegram audit
- [ ] In `engine/app/ingest/store.py`, after parsing, `UPDATE documents SET extracted_text=%s` (parsed.text) within the indexed transaction.
- [ ] In `engine/app/telegram/handler.py`, replace the owner-attributed `query_log` insert with a direct insert using `telegram_link_id` + null `user_id` (now nullable): `INSERT INTO query_log (workspace_id, telegram_link_id, question, retrieved_chunk_ids, model) VALUES (...)`. This fixes the gap and is cleaner.
- [ ] Backfill note: existing docs have null extracted_text; the viewer falls back to concatenating chunk text if extracted_text is null.
- [ ] Full engine suite; commit.

## Task 3: Engine handler — tappable HTML source links + APP_URL
- [ ] Add `app_url: str = ""` to `engine/app/settings.py`; add `APP_URL` to `.env`/`.env.example` + compose (engine + bot).
- [ ] `api.send_message(token, chat_id, text, parse_mode=None)` — pass `parse_mode` through.
- [ ] In `handler.py`, build the reply as: the (HTML-escaped) answer, then a `Sources:` footer where each citation is `<a href="{APP_URL}/s/{chunk_id}">[n] {filename} · p.{page}</a>`; send with `parse_mode="HTML"`. Escape `& < >` in the answer.
- [ ] Update `test_tg_handler.py` to assert the reply contains an `<a href=".../s/` link when APP_URL is set (monkeypatch settings.app_url). Run; commit.

## Task 4: Web — source viewer `/s/[chunkId]`
- [ ] Create `web/lib/source.ts`: `getSource(chunkId, workspaceId)` → `{ filename, page, charStart, charEnd, text }` where `text` = the document's `extractedText` (or concatenated chunks fallback); returns null if not found. Enforce permission: resolve the caller's access and require the document's groups intersect (or all_access) — else return null.
- [ ] Create `web/app/(app)/s/[chunkId]/page.tsx` (authed segment so the rail + login gate apply): resolve access, call `getSource`; if null → a "not found or not permitted" state; else render the document text with `[charStart,charEnd]` wrapped in a `<mark>` (teal tint), the filename · page as a mono header, and auto-scroll to the mark.
- [ ] Build; commit.

## Task 5: Web Ask — link citations to the viewer
- [ ] Add `chunkId` to the citation payload: `chat.ts` `ChatMessage.citations` gains `chunkId`; `listMessages` + `saveTurn` include it (citations table already stores `chunkId`).
- [ ] In `AskChat.tsx`, make each citation pill (and the inline `[n]`) a link to `/s/<chunkId>` (open in a new tab), keeping the inline snippet reveal as a quick preview.
- [ ] Typecheck; build; commit.

## Task 6: Verify
- [ ] Rebuild engine + worker + web; re-ingest `knowledge.txt` (or backfill extracted_text) so it has text.
- [ ] Web: ask a question → click a citation → the `/s/<chunkId>` viewer opens with the passage highlighted. A restricted doc is not viewable by a non-member.
- [ ] Telegram (if tunnelled/deployed): the reply's source link opens the viewer. Locally, assert the reply contains the `<a href>` link and the viewer route renders for a valid chunk.
- [ ] Confirm `query_log` now records the Telegram query (telegram_link_id set).
- [ ] Suites green.

## Notes / deferred
Signed one-time tap-through links (no separate login); inline `[n]` links in Telegram (footer links first); highlight across page boundaries for multi-page PDFs.
