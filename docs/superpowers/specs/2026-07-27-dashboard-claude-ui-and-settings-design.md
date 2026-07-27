# Dashboard shell, chat pane and Settings — design

**Date:** 2026-07-27
**Status:** approved, ready for a plan
**Scope:** `web/` only. The engine, `access.py`, retrieval, the Telegram path and
the marketing app are untouched.

## 1. Why

The authenticated product has three problems that are all the same problem —
nobody ever designed the *shell*, only the pages inside it.

1. **Two stacked sidebars.** `(app)/layout.tsx` renders a 240px `Rail`; then
   `/dashboard` renders a second 256px `Conversations` sidebar inside it. About
   500px of chrome before any content, and two different visual languages for
   "navigation".
2. **No account surface at all.** `users.locale` has existed since the i18n work
   (`lib/db/schema.ts:38`) and **nothing in the product can change it** — a
   Russian- or Uzbek-speaking user is stuck on whatever the owner seeded.
   `/change-password` exists but is reachable only by forced redirect; there is no
   link to it anywhere. No theme, no profile, no session management.
3. **The chat pane reads like a form, not a conversation.** A page header with an
   `<h1>Ask</h1>`, a single-line `<input>` with a separate "Ask" button, and every
   answer boxed in a drop-shadowed card.

The reference target is claude.ai: one sidebar, no page header in the chat pane, a
composer that owns its own controls, answers as plain flowing text, and Settings
as a modal that never loses your place.

## 2. What "look like claude.ai" means here — and what it doesn't

**Adopted:** the shell, the composer, message rendering, the user-pill menu, the
Settings modal with its `label ⟶ right-aligned control` row grammar, and a real
light/dark theme.

**Not adopted:** claude.ai's palette and type. CompanyMind keeps its violet
accent (`--brain #684bff`), Space Grotesk display face, and warm-paper ground. The
dark theme is derived from *that* identity — warm near-black — not from
claude.ai's neutral greys.

**Not in scope:** streaming answers. Today `/api/ask` is one POST and the whole
answer arrives at once. Streaming would turn `ask/service.py::answer_query` into
an SSE endpoint on a code path the Telegram worker shares, roughly doubling the
job. It is a separate piece of work; §5.4 specifies an honest waiting state
instead.

## 3. Shell

### 3.1 One sidebar

`_components/Rail.tsx` and `dashboard/Conversations.tsx` are replaced by a single
`_components/Sidebar.tsx`, mounted once in `(app)/layout.tsx`. Top to bottom:

| Region | Contents |
|---|---|
| Header | `Wordmark`, chat search toggle, collapse toggle |
| Primary | `+ New chat` |
| Nav | Ask · Sources · Access · People\* · Integrations\* · Atlas\* · Platform\* |
| Recents | The caller's chat threads, `⋮` on hover → rename / delete |
| Footer | User pill → menu |

`*` = the existing conditional logic from `Rail.tsx:39-58` is carried over
verbatim (owner-only entries, and Platform only when `isSuperAdmin &&
deploymentMode === 'hosted'`).

**The user-pill menu** replaces everything currently loose at the bottom of the
rail: email header, **Settings** (`⌘,` / `Ctrl+,`), Language submenu, Replay the
guided tour (today's `Guide` button), the egress claim line, Sign out.

**Chat search** is today's `Conversations` search box (`GET /api/chats?q=`,
debounced 250ms) — it filters Recents by thread title and is revealed by the
header's search toggle rather than occupying a permanent row.

**Collapsed state** is persisted in `localStorage` and renders a 56px icon rail.
It is presentation only — no nav entry appears or disappears with it.

**Mobile** (`max-md`): the sidebar becomes an off-canvas drawer behind a
hamburger in a slim top bar. This deletes `AskWorkspace.tsx:83-91`'s ad-hoc
"Chats" toggle, which only ever opened the *second* sidebar.

### 3.2 Tour anchors must survive

`lib/tour/targets.ts` defines a closed union of five targets, and
`lib/tour/steps.ts` points steps at `rail-sources` and `rail-access`. The nav
links move into the new component but **keep those two `useTourTarget` refs**.
The union is deliberately not renamed: `TourTarget` is typed precisely so a lost
anchor is a `tsc` error, and that guarantee is worth more than a tidier name.
`ask-pane` and `ask-composer` likewise stay on the chat pane and the composer.

### 3.3 Chat selection moves to the URL

Today `selectedChatId` is `useState` inside `AskWorkspace`, with `Conversations`
as a sibling and a `reloadSignal` counter to force refetches. A layout-level
sidebar cannot see component state, so selection moves to the route:

- `/dashboard` — new chat
- `/dashboard/c/[chatId]` — an open thread

`AskChat` reads the id from route params instead of a prop. The sidebar's Recents
are `<Link>`s. This deletes `reloadSignal` and the `onFirstMessage` round trip
(the first send `router.replace`s to the new thread's URL), and it buys
back/forward, deep links and refresh-safety.

**Invariant preserved:** `chatOwned()` already scopes every read to
`(workspaceId, userId)`. A chat id in the URL is *not* an authorization input —
the route still resolves the workspace from the session, never the request, and
`chat-isolation.test.ts` must stay green unchanged.

## 4. Theme

### 4.1 Tokens

`styles/tokens.css` keeps every token **name**. Current values move under
`:root, [data-theme='light']`; a `[data-theme='dark']` block is added:

| Token | Light (unchanged) | Dark |
|---|---|---|
| `--paper` | `#f3eee3` | warm near-black |
| `--paper-raised` | `#fbf8f1` | one step up from paper |
| `--paper-sunk` | `#e8e1d2` | one step down |
| `--ink` / `--ink-soft` | `#1c1b18` / `#635e54` | warm off-white / warm mid-grey |
| `--line` / `--line-control` | `#d8d0be` / `#857960` | dark hairline / a border that still clears 3:1 |
| `--brain` / `--query` / `--sovereign` | as today | lightened until they read on dark paper |
| `--brain-text` etc. | *darkened* to pass AA | ***lightened*** to pass AA |

The `*-text` variants exist because the accents cannot legally carry body text on
cream. On dark the same rule holds with the direction reversed. **Exact dark
values are chosen during implementation against a real WCAG relative-luminance
calculation, not by eye** — the same discipline the file's existing contrast law
already documents — and §7 adds a test that recomputes every ratio so the law
cannot rot.

### 4.2 Applying it

`theme` is stored on `users` (`'system' | 'light' | 'dark'`, default `'system'`)
and mirrored into a non-sensitive cookie so the root layout can stamp
`data-theme` on `<html>` server-side. A tiny inline script in `<head>` resolves
`system` against `matchMedia` before first paint, so there is no flash.

Reading a cookie in `app/layout.tsx` opts its routes into dynamic rendering. Every
authenticated route is already dynamic (`runtime = 'nodejs'`, `getCurrentUser()`
on each render); `/login` becomes dynamic too, which is acceptable for a page that
already sets a session cookie on submit.

`viewport.themeColor` becomes the two-entry light/dark media array.

`motion` (`'system' | 'reduced'`) rides along the same path as `data-motion` on
`<html>`, and `globals.css`'s existing `prefers-reduced-motion` block gains a
`[data-motion='reduced']` selector beside it.

### 4.3 Atlas

`dashboard/atlas/Atlas.tsx` paints to a `<canvas>` and hardcodes eight colours
tuned for the cream ground — `#F3EEE3` (line halo), `#1c1b18` (ink), the
department palette, `EVERYONE_GREY`, `MUTED`, `DEADSTALE_FADED`, and the lens hit
colours. These move into CSS custom properties read at runtime via
`getComputedStyle(document.documentElement)` — the pattern `marketing`'s
`lib/swarm/tokens.ts` already uses — with dark variants added. Graph layout,
clustering and lens logic are untouched.

## 5. Chat pane

### 5.1 Layout

The `<h1>Ask</h1>` header (`AskChat.tsx:168-173`) is deleted. Content sits in a
~46rem column. A thread shows a title bar with inline rename and delete; a new
chat shows nothing above the greeting.

### 5.2 Empty state

Centred, time-of-day greeting (`Good afternoon, {name}`, localised), the composer
directly beneath it, suggestion chips under that (reusing `getSuggestions`), and
the egress claim as a quiet footer line.

`GetStarted.tsx` is absorbed. Its two branches survive as copy on this one
surface: the owner sees "upload your first documents", the member sees
`emptyStates.askNoDocuments.memberBody` — because for a member "empty" means
"nothing in *your* access groups", not "the workspace is empty", and telling them
to upload is an instruction they have no permission to follow. `showGetStarted`'s
suggestion-count guard (`AskWorkspace.tsx:20-32`) is preserved: a workspace with
indexed but unfiled documents must fall through to the composer, never to a panel
with nothing clickable in it.

### 5.3 Messages

- **User turn:** right-aligned bubble on `--paper-sunk`.
- **Assistant turn:** plain flowing text. No card, no shadow, no border.
- **Citations are unchanged functionally** — inline `[n]` chips, the footer chip
  row, the `↗` source link to `/s/[chunkId]`, the expandable snippet, and the
  `firstCitedMessageId` anchor that positions `CitationHint`. They are restyled
  flat, not redesigned. The non-linkable citation case (re-ingested document,
  `chunkId === null`) keeps its explanatory title attribute.
- **Hover action row** under each answer: Copy · Sources · Retry.

### 5.4 Waiting state

`Searching your sources…` (`AskChat.tsx:257-261`) becomes a staged indicator:
*Searching your sources* → *Reading the matches* → *Writing the answer*, advanced
on elapsed time.

These are the pipeline's real stages in their real order. Because the request is
one-shot, the client does not know how many documents were read until the answer
lands — **so no stage may state a count**. A number here would be invented, and
this product's entire claim is that what it shows you is true.

### 5.5 Composer

A rounded card containing an auto-growing textarea (grows to ~8 rows, then
scrolls). Enter sends, Shift+Enter newlines. Bottom-left: `➕` upload, **owner
only** — `POST /api/documents` is already `getOwner()`-gated, so rendering it to a
member would only produce a 403 they cannot act on. Bottom-right: send, disabled
while empty or busy. Microcopy beneath the card.

Uploads still land in Sources and still need folder/group assignment there; the
composer button is a shortcut into the existing `useDocumentUpload` flow, not a
per-chat attachment.

## 6. Settings

### 6.1 Shell

An intercepted parallel route, so Settings overlays the app and Escape puts you
back exactly where you were:

```
app/(app)/dashboard/layout.tsx          renders {children}{settings}
app/(app)/dashboard/@settings/default.tsx            → null
app/(app)/dashboard/@settings/(.)settings/[section]/page.tsx   → modal
app/(app)/dashboard/settings/[section]/page.tsx                → full page
```

Both slots render the same section components, so a hard refresh or a pasted link
gives a full page and in-app navigation gives the modal. The interceptor and the
intercepted route are both direct children of `dashboard/`, which is what makes
`(.)` the correct marker regardless of how deep the navigation originates.

*Fallback, if interception misbehaves across the `/dashboard/c/[id]` depth:* drive
the same modal from a `?settings=<section>` search param. Same components, same
URL-addressability, no interception machinery. Decide by build, not by debate.

### 6.2 Row grammar

One primitive — `SettingsRow` — takes a label, an optional description line, and a
control rendered right-aligned. Hairline between rows, section headings above
groups. Every control autosaves; there is no Save button.

### 6.3 Sections

**General**
- Name — text, saves on blur
- Email — read-only
- **Language** — `en` / `ru` / `uz` → `users.locale`. This is the column that has
  had no UI since it was added.
- Appearance — segmented System / Light / Dark
- Motion — segmented System / Reduced
- Replay the guided tour — button calling the existing `start({ fromBeginning: true })`

**Account**
- Change password — inline form reusing `lib/auth/change-password.ts`. The
  standalone `/change-password` route **stays**: it is the redirect target for
  `mustChangePassword` and lives outside `(app)` precisely so it cannot redirect
  to itself.
- **Active sessions** — one row per live session: device, IP, created. `sessions`
  already stores `userAgent` and `ip`. The caller's own session is marked.
- Sign out of all devices

**Workspace** — owner only
- Rename workspace
- Deployment mode and the egress claim, read-only
- Rows linking to People, Access groups, Integrations — the pages keep their own
  routes; Settings is a doorway, not a second implementation

**Data**
- What is stored and where, in plain language
- Delete all my conversations

### 6.4 API and schema

| Route | Gate | Notes |
|---|---|---|
| `PATCH /api/me` | `getCurrentUser()` | name, locale, theme, motion |
| `GET /api/me/sessions` | `getCurrentUser()` | the caller's own sessions only |
| `DELETE /api/me/sessions` | `getCurrentUser()` | sign out everywhere |
| `PATCH /api/workspace` | `getOwner()` | rename |
| `DELETE /api/chats` | `getCurrentUser()` | the caller's own chats only |

All mutating routes verify CSRF, matching every existing route.

**Schema:** two columns on `users` — `theme text not null default 'system'`,
`motion text not null default 'system'` — via `drizzle-kit generate`. No
hand-edited migration.

**`Session` gains `sessionId`.** `validateSessionToken` already reads the session
row; returning its id is what lets the sessions list mark "this device". Adding a
field is safe for all existing callers.

**`lib/chat.ts` gains `deleteAllChats(workspaceId, userId)`** beside the existing
single `deleteChat`.

### 6.5 Authorization boundaries

`/api/me` mutates only the caller's own row, resolved from the session. It must
**ignore any user id in the body** — the same rule that already governs workspace
resolution ("workspace comes from the session, never the request").

`PATCH /api/workspace` is `getOwner()`-gated. It is deliberately **not** added to
`control-plane-gates.test.ts`: that table's contract is routes that change *who
sees what*, and renaming a workspace changes nothing about access. Diluting it
would weaken the one test whose meaning is currently exact. It gets its own
gating test instead (§7).

## 7. Verification

**Must stay green, unchanged:** `i18n.test.ts` (key parity across en/ru/uz),
`control-plane-gates.test.ts`, `tour/targets.test.ts` and `tour/steps.test.ts`,
`chat-isolation.test.ts`, `people-routes.test.ts`, `deployment-mode.test.ts`.

**New:**
- **Dark-palette contrast test** — computes real WCAG relative-luminance ratios
  for every ink/paper and accent-text/paper pair in both themes and asserts the
  thresholds the token file's contrast law states. This is what stops the dark
  values from being eyeballed.
- **`/api/me` validation** — rejects an unknown locale, theme or motion value;
  ignores a body-supplied user id; requires CSRF.
- **Settings route gating** — a member `PATCH /api/workspace` gets 403 **and the
  write does not land**. A 403 after the write is not a fix.
- **Sessions scoping** — `GET /api/me/sessions` returns only the caller's rows.

**i18n:** every new user-facing string is added to all three dictionaries in the
same change. `i18n.test.ts` enforces this and will fail otherwise.

**Manual:** the app runs at `localhost:3000` via `docker compose`; each stage is
checked in the browser before the next one starts.

## 8. Build order

1. **Theme plumbing** — tokens, `data-theme`/`data-motion`, cookie, no-flash
   script, contrast test. Nothing moves visually yet.
2. **Sidebar merge + chat URLs** — the shell change and `/dashboard/c/[id]`.
3. **Chat pane restyle** — empty state, thread, messages, composer, waiting state.
4. **Settings** — migration, API routes, modal shell, the four sections.
5. **Atlas colours, Platform shell polish, i18n backfill.**

Each stage is committed on its own and leaves the app working.

## 9. Explicitly out of scope

Streaming answers · any engine change · `/change-password`'s removal · the
marketing app · Atlas's graph, clustering or lens logic · a workspace switcher
(one user, one firm is an enforced invariant) · cross-firm user management from
the platform tier (the thing the three-tier split exists to remove).
