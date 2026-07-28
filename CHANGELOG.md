# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **The evidence rail.** The citation was the product and the least designed
  thing on screen: a 0.7rem grey monospace chip, with the quoted passage hidden
  behind a click. A thread now carries a rail on its right showing the sources
  of the active answer — numbered to match the marker in the prose, the source's
  filename as an eyebrow, and **the quoted sentence itself as the body of the
  card**, always visible. Reading the claim and reading the proof is one act now.
  - **One rail per thread, not one per answer.** A rail per message would stack
    down the right edge, each misaligned with the answer it belongs to and each
    leaving a column of whitespace after a short reply. This one follows the
    newest answer, and pins to whichever answer you last pointed at.
  - **Binding runs both ways:** hovering `[2]` in the prose lights source 2 in
    the rail, and hovering the card lights the marker. That is what makes a
    claim and its proof read as one object rather than a number and a footnote.
  - **Below 1280px the rail is not rendered** — the chat measure alone (46rem)
    already exceeds the content area there — and the same cards render inline
    under the answer instead. One component, two homes, never both at once.
  - The rail states three genuinely different things rather than one vague one:
    nothing asked yet, this reply needed no document, or this answer's sources
    resolve to nothing.

- **Download and delete for documents in Sources.** The library could show you
  a document and tell you who could see it, but never hand it back or let it go.
  - **Download** (`GET /api/documents/[id]/file`) is offered to anyone the
    document is visible to — a member who can already read its text in a cited
    answer gains nothing from being denied the file. The gate is the access
    model: the new `get_document` applies the same predicate as the listing and
    returns nothing for a document you may not see, so a document id lifted
    from a colleague's citation link 404s instead of yielding the file. Served
    `attachment` + `nosniff`, never inline.
  - **Delete** (`DELETE /api/documents/[id]`) is owner-only and enumerated in
    `web/lib/control-plane-gates.test.ts` — revoking everyone's access to a
    document permanently is the same power as retagging it into nobody's group,
    exercised once and irreversibly. It removes the record, its chunks, its
    ingestion job, its group tags and the stored file. Citations deliberately
    survive with their frozen filename and snippet: an audit trail that rewrites
    itself when the source is deleted is not an audit trail.
  - Confirmation is inline rather than `window.confirm`, so it can be
    translated, can say what deleting actually costs, and keeps the filename
    you are about to destroy readable while you decide.
- `web/lib/content-disposition.ts` — uploads here are routinely Uzbek and
  Russian, and a non-latin-1 filename either throws when the response is built
  or arrives mangled. Emits the RFC 6266 pair (degraded ASCII + RFC 5987
  `filename*`), and strips CR/LF so a filename cannot inject a second header.

- Light/dark theming across the whole app. Every design token in
  `web/styles/tokens.css` is now a CSS `light-dark()` pair, so the entire
  product themes without a single `dark:` variant — Tailwind already resolved
  every colour through `var(--token)`. The theme is stamped on `<html>`
  server-side from a cookie, which means no inline script and no flash. A
  reduced-motion preference rides the same path, for people on a machine whose
  OS setting they cannot change.
- `web/lib/tokens-contrast.test.ts` — the contrast law in `tokens.css` has
  always been a comment, and a comment cannot fail. It is now parsed and every
  WCAG ratio recomputed, in both themes.
- `theme` and `motion` columns on `users`, and `PATCH /api/me` to change them
  along with name and locale.
- **Settings**, opened from the sidebar's account menu or `⌘,`. An intercepted
  route, so it overlays whatever you were doing and Escape puts you back in your
  thread; a hard refresh on the same URL renders it as a full page.
  - **General** — name, **language** (the `users.locale` column has had no UI
    since i18n landed, so ru/uz users were stuck on whatever the owner seeded),
    appearance, motion, replay the guided tour.
  - **Account** — change password, **active sessions** (device, IP, signed-in,
    with the current one marked), sign out of all devices. No IP-geolocation
    lookup: calling out to prettify a row would contradict the product's claim.
  - **Workspace** (owner-only) — rename, the deployment-mode egress claim, and
    doorways to People / Access / Telegram.
  - **Data** — what is stored and where, and delete all my conversations.

### Changed

- **Team is $1,300 a month, up from $1,200.** Changed everywhere it appears in
  all three locales, including the figures derived from it — the per-head price
  in the plan note and in the FAQ answer is $13 now, not $12, and the README's
  price summary matches. The $1,500 comparison (a hundred Individual seats) is
  unchanged, and the claim that Team is cheaper per person than a single seat
  still holds at $13 against $15.
- **The pricing headline stopped being a riddle.** "Two prices. One
  conversation." required you to already know the pricing structure to decode
  it, and "two prices" read as though there were only two plans when there are
  three. It now says what is actually on the page — "Three plans. Two of them
  priced here." — in all three languages, in both places it appears. The Uzbek
  closing headline lost its dangling "oʻsha" ("that one conversation"), which
  had been pointing back at the riddle; English and Russian were already
  self-contained there.
- **The Uzbek marketing copy stops over-translating.** The file claimed to be
  rewritten rather than translated, but three habits gave it away as calque, and
  all three are now fixed across the site (founder review, 2026-07-28):
  - **`uskuna` → `server`** (14 places). `uskuna` is a hand tool. Computing
    hardware in Uzbek is a `server` or a `jihoz`; "runs on your own uskuna" read
    roughly like "runs on your own wrench".
  - **`Egalik paneli` → `Admin panel`.** Nobody in Uzbekistan calls it an
    ownership panel. It is an admin panel and always has been. The rule this
    stands for: a term with no real Uzbek equivalent keeps its loanword.
  - **`miya` is no longer a common noun for the software.** CompanyMind is the
    brand and stays English; calquing "mind" into "miya" produced sentences that
    do not parse, the worst being the Team plan's "for a company ready to put the
    brain in front of every employee who has a question". Body prose says
    `tizim`; the two headline slots keep the metaphor on purpose.
  - Plus the calques around them: "two sizes of one program" (`ikki oʻlcham`),
    "knows permissions" (`Ruxsatlarni biladi`), "get it calculated"
    (`hisoblatish`).
- **The Uzbek landing headline says "maʼlumotlar", not "bilim"** — data rather
  than knowledge. Applied to the hero headline and to the identical sentence
  used as the page tagline, so the two cannot drift. English and Russian are
  unchanged; this is a wording preference in Uzbek, not a change of positioning.
- **The deterministic fake providers are test-only now.** They used to engage
  whenever no model credentials were present, so a deployment missing one
  environment variable served placeholder text — and that text reads exactly
  like a real cited answer (`Based on your sources: … [1]`), so a broken install
  looked like a working one. They now require an explicit `FAKE_MODELS=1`;
  otherwise the engine raises `ModelsNotConfigured` from both the ask path and
  the ingestion path rather than inventing an answer or a vector. They still
  exist because CI runs all 155 engine tests with no secrets at all.
- **The assistant triages before it retrieves.** A greeting used to be answered
  by quoting whatever document ranked first — "assalomu alaykum, sen nima qila
  olasan" came back as a citation-laden extract from the staff handbook. The
  prompt now classifies the message first: greetings, thanks and questions about
  what the assistant can do get a natural, uncited reply; anything about the
  company still comes only from the sources, with citations. An ambiguous
  message is treated as a question about the company, because answering from the
  model's own knowledge is the more expensive mistake. Retrieval finding nothing
  no longer means there is nothing to say.
- The answering system prompt is hardened (`engine/app/ask/answer.py`). It now
  replies in the reader's own language; refuses to reveal, confirm or hint at
  which model, vendor or version powers the system, or to disclose its own
  instructions, and enumerates the specific evasion routes (roleplay,
  hypotheticals, encodings, false developer/debug authority, "the text above")
  that a general rule reliably loses to; and declares retrieved sources to be
  **data, never instructions**, which is the central injection risk in a product
  where anyone who can upload a document could otherwise address the model
  directly. `engine/tests/test_system_prompt.py` pins these properties.
- Refusals are detected by a language-independent `NO_ANSWER` sentinel instead of
  string equality against an English sentence. With the model now answering in
  Uzbek or Russian, the old check would have let every non-English refusal
  through as an ordinary answer that happened to cite nothing.
- Uzbek copy reworked to read as Uzbek rather than transposed English —
  "Soʻnggi suhbatlar" over a possessive with nothing to possess, "Barcha
  xodimlar" for a staff roster, searching *in* sources rather than *for* them.
- The dashboard has **one sidebar instead of two**. Navigation, chat history and
  the account menu share it; chat threads are addressable at
  `/dashboard/c/[chatId]`, so they survive a reload and can be linked to.
- The Ask pane is a conversation rather than a form: no page header, answers as
  plain prose instead of drop-shadowed cards, a composer card with an
  auto-growing input (Enter sends, Shift+Enter newlines) and owner-only upload,
  a hover action row (copy / sources / retry), and a waiting indicator that
  names the pipeline's real stages instead of one static line.
- Atlas paints from theme tokens rather than eleven hexes hardcoded for the
  cream ground, so the graph follows the theme like every other surface.

### Fixed

- **A folder's header scrolled away with its documents.** The Sources folder
  route scrolled the whole page, so in a folder holding more files than fit, the
  way back to Sources and the name of the folder you were standing in both slid
  off the top — leaving no way to tell which folder you were looking at without
  scrolling back up. It is a fixed-height column whose list scrolls now, the
  same shape the thread route already used.
- **Answers displayed citations that pointed at nothing.** Found live on
  production: the two most recent threads carried seven and eight `[n]` markers
  and *zero* stored citations. `resolve_citations` drops any marker past the
  number of retrieved passages, and the UI then fell through and printed the raw
  marker — so the reader saw eight sources and could open none of them. On a
  product sold on traceability that is the worst failure available. Unresolved
  markers are now removed from the prose, and the answer carries a plain notice
  saying it is unbacked and should be treated as unverified. Derived from the
  message itself, so it is also true of every answer already in the database.
- **The chat renders Markdown.** Answers were painted into a single `<p>` with
  no parser, so production showed literal `**Tier 1**` and `*and*` on the
  product's most-seen screen. Lists, tables, headings, code and emphasis now
  render — a policy answer wants a tier table, not a paragraph. Deliberately
  narrower than "render Markdown": **images are dropped entirely**, because a
  tracking image inside an uploaded document would make the reader's browser
  fetch a remote URL and quietly break the "Nothing leaves this server" claim
  printed under the composer; links are restricted to http/https/mailto; raw
  HTML is never enabled.
- **Copy, Sources and Retry were unreachable on every phone and tablet.** They
  were `opacity-0` until `group-hover`, and touch has no hover — so there was no
  way to copy an answer or open its sources at all. They are visible by default
  now; only a device that reports `hover: hover` hides them until hover.
- **The tour pill sat on top of the send button.** Measured at 420px the pill
  overlapped the composer's send control, and at 1200px it covered the trust
  line. No viewport corner is safe when the composer is bottom-anchored and
  full-width, so it docks into the sidebar column on desktop and the free end of
  the mobile top bar instead.
- **Tailwind never compiled classes used in `lib/`.** `content` globbed only
  `./app/**`, so the new Markdown renderer's `list-disc`/`pl-5` were emitted in
  the markup and never in the CSS — bullet lists rendered as bare lines. Silent
  by nature: the class is right there in the DOM. `./lib/**` is scanned now.
- **Atlas labels overprinted into an unreadable pile.** At 152 documents every
  hub drew its filename unconditionally, so the more a workspace knew the less
  its map could be read. A label now reserves a box and is skipped if the space
  is taken — hubs come first, and hover/lens focus always wins. Labels also drop
  the extension, the `department-NN-` filing prefix (the dot's colour already
  says the department) and the slug separators.
- **The Atlas findings rail was 320 undifferentiated cards.** 94 of them read
  "Visible to nearly everyone in the workspace", because `create_document` tags
  every upload to Everyone — so over-exposure is the state a document is *born*
  in. The count is real and stays in the header; the list folds to the five
  worst per kind with an explicit "Showing 5 of 94", sorts by the severity the
  engine already computes, and says which kind of exposure each one is. `Fix`
  became `Review` and is now a button, so `Dismiss` — which retires a governance
  finding for good — is no longer the equally-easy twin beside it.
- **Access showed who but never what.** `list_groups` returns a document count
  per group, so a row reads "Exec-only — opens 12 documents" instead of leaving
  the page's own question unanswered. Groups can be renamed (the API already
  allowed it), deleting one asks first and names what its members lose, and
  group names are no longer CSS-uppercased into system identifiers. The
  duplicate paragraph restating the access rule directly under the permanent
  one is gone.
- **Opening Ask waited on the language model before drawing the composer.** The
  Ask page awaited `getSuggestions()` in its server component, and the engine
  writes those starter questions with one model call per folder, in sequence —
  measured at ~1.0–1.8s each, so up to ~3–5s of blank screen on the way in from
  Sources, for decoration that disappears the moment you type. They are now
  fetched by `AskChat` from `/api/suggestions` once the composer is on screen:
  measured locally, the composer appears after **34ms** and the suggestion chip
  arrives at 1290ms, where before nothing appeared until the latter. Scoping is
  unchanged — `suggest_questions` still resolves access first, because a
  suggested question discloses the document it was drawn from.
- `/api/suggestions` no longer re-queries the membership row for the caller's
  role; it rides on the session, as everywhere else.
- **The on-prem egress claim was being shown on hosted deployments.** Sources
  said "Files never leave your infrastructure" unconditionally, and the guided
  tour's welcome step said "Everything runs on your own infrastructure" in all
  three languages. Neither is available when many firms share one server. Both
  now state only what is true in both modes.
- `web/lib/db/client.ts` cached its connection pool in a module-level binding,
  so Next's dev server built a **new pool of 10 on every hot reload** and
  abandoned the old one. An editing session exhausted Postgres in well under an
  hour, and the symptom (`sorry, too many clients already`) looked nothing like
  its cause. Cached on `globalThis` instead.

### Removed

- `Rail.tsx`, `Conversations.tsx` and `GetStarted.tsx` — replaced by the single
  sidebar and the new empty state.
- `lib/onboarding.ts` and `POST /api/onboarding/dismiss`, which the new empty
  state left with no readers. The `users.onboarding_dismissed_at` column stays,
  marked vestigial in the schema; `tourDismissedAt` was deliberately kept
  separate from it so exactly this removal would be safe.

### Security
- **The control plane was open to every member.** Sixteen mutating API routes were gated by
  `getCurrentUser()` alone, so any signed-in member could `PUT /api/documents/<id>/groups` to retag
  a document they could not open into a group they belonged to, or `PUT /api/groups/<id>/members`
  to add themselves to any group — and `resolve_access` would then faithfully honour it. The access
  model's evaluation was airtight; its inputs were world-writable. Every one is now `getOwner()`-
  gated (403): document groups, group create/rename/delete, group members, folder CRUD, AI organise,
  document upload, and all four Telegram routes — the last of which could grant an identity outside
  the company access to a group. `GET /api/groups` is owner-only too: it returns the group structure
  **and** every colleague's email and name, which is a staff directory whether or not anything is
  written. Covered by `web/lib/control-plane-gates.test.ts`, where the route table *is* the test and
  each case also asserts the underlying mutation was never invoked — a 403 returned after the write
  landed would look fixed without being fixed.
- Upload is now owner-only. `create_document` tags every upload to the Everyone group so a new file
  is never accidentally hidden, which means a member upload would have published to the entire firm
  by default. Relaxing this needs a group choice at upload time first.
- The library listings ignored the access model. `engine/app/library/documents.py::list_documents`
  and `folders.py::list_folders` took only a workspace id — no `group_ids`, no `all_access` —
  while `get_source` three files away took both. Since `/dashboard/sources` is reachable by any
  member, every member saw **every filename in the workspace**, including documents they could
  never open, under a header reading "Everything in <workspace>'s brain". Filenames are not
  neutral metadata here: `redundancy-list.xlsx` discloses precisely what the access model exists
  to protect. Folder names and per-folder counts leaked the same way. Both functions now take
  `group_ids` + `all_access` as **required** parameters (there were only two production call
  sites, so a forgetful caller is now a hard error rather than a silent full-access read —
  defaulting `all_access=True` would have reintroduced the bug). A folder with no visible
  documents is omitted entirely for a non-owner rather than rendered as empty, since an empty
  "Board Minutes" still discloses that board minutes exist.

### Added
- **The marketing site is trilingual — Uzbek, Russian and English, with Uzbek as the default.**
  URLs are always prefixed (`/uz`, `/ru/pricing`, `/en/security`); `proxy.ts` redirects anything
  unprefixed to the default locale, or to the one in the visitor's `NEXT_LOCALE` cookie if they
  picked one. **No `Accept-Language` negotiation**, deliberately: "Uzbek is the default" is a
  product decision and a browser header is not, and serving different content at the same URL
  breaks CDN caching and makes what a crawler indexed depend on which header it sent. All eight
  pages prerender in all three languages with canonical + `hreflang` alternates and a per-locale
  OpenGraph card. The switcher is three real links to *the same page* in the other languages, not
  a `<select>` that pushes you to the homepage.
  - **The root layout moved to `app/[locale]/layout.tsx`.** `<html lang>` has to be the visitor's
    language — a screen reader switches pronunciation on it — and a layout at `app/layout.tsx`
    receives no params, so it could only hard-code one. Consequence: every renderable route now
    lives under `[locale]`, which `proxy.ts` guarantees.
  - **Copy is one file per language against one `Dictionary` type** (`content/types.ts`). All three
    are annotated with it, so a dropped or misspelled key is a compile error rather than a blank
    page in the language nobody on the team reads. Routes (`content/routes.ts`) and the brand name
    (`content/brand.ts`) are not translated and live once — a triplicated href is a broken link in
    exactly one language, which is the kind of bug nobody finds.
  - No client component imports a dictionary: pages resolve one on the server and pass the slice
    down as props, so two of the three languages never reach the browser.
  - **The Uzbek copy is written, not translated.** The first pass followed the English sentence
    structure word by word and read like machine output — "nothing calls home", "behind your own
    walls" and "data egress" have no Uzbek equivalent, and rendering them literally produces
    grammatical nonsense. `content/uz.ts` was rewritten so each idea is said the way an Uzbek
    speaker would say it, with a fixed glossary at the top of the file (egress → *tashqariga
    chiqqan maʼlumot*, cited answer → *manbali javob*, on-prem → *oʻz serveringizda*, design
    partner → *hamkor*, never the calque *dizayn hamkor*).
  - **Manrope was added purely for Cyrillic.** Space Grotesk ships none, so every Russian headline
    was silently falling back to system-ui — the one element that *is* the design. It sits *behind*
    Space Grotesk in the display stack, so the browser falls through glyph by glyph and the
    Cyrillic file is never downloaded on the other two locales.
  - **The 404 is always in Uzbek, and that is a measured trade.** A not-found component gets no
    params; reading the locale from a proxy-set header works and re-classified all eight routes
    from prerendered to render-on-demand, because every page references that boundary. A 404 in the
    wrong language is a small annoyance on a page nobody should reach; server-rendering the whole
    site for every visitor is a cost everyone pays.
- **Published pricing on the marketing site — a reversal of the earlier "no figures anywhere"
  position, which existed because there was no price book.** Individual is $15/month for one
  person; Team is $1,200/month for up to 100 ($12 a head — cheaper per person than a single
  seat, with nobody counting them);
  Enterprise is quoted, because an air-gapped rack in a hospital genuinely is a different
  engagement from a VPC — and the page says that in one sentence instead of hiding behind "contact
  sales". The plans are defined once per language and rendered by both `/pricing` and a new
  homepage scene, so the two cannot drift. Everything else in the honesty rules is unchanged and
  still binding: no certifications, no SLAs, no uptime figures, no deployment durations, no social
  proof — the emphasized plan is badged "up to 100 people", a statement about size, not about
  customers we do not have.
  - Pricing is a real **scene** in the scroll screenplay, not an ordinary section. `activeScene()`
    falls back to `'hero'` when no section owns the viewport centre-line, so a plain `<section>`
    would have snapped the entire composition back to the opening frame for a full viewport of
    scroll.
  - The telemetry rail now retires over any section marked `data-hides-telemetry`, the same way it
    already retires over the footer. Three price cards fill the bottom-right corner it lives in;
    every other scene leaves that corner empty.
- **`DEPLOYMENT_MODE`** (`hosted` default, or `onprem`). The same codebase serves a hosted
  multi-firm deployment and a single-firm on-prem install; only the egress claim and the Platform
  nav entry differ. It gates **presentation only** — authorization stays `getSuperAdmin()` /
  `getOwner()` in both modes, because a mode flag that also granted access would be a second,
  weaker security control shadowing the first. The default is deliberately the *weaker* claim: an
  unset variable must never make the product assert an air-gap it does not have. Only the exact
  string `onprem` unlocks the stronger claim — `on-prem`, `ONPREM`, `true` and friends all resolve
  to hosted, so an air-gap claim can never turn on by a typo.
- **The firm owner's People page** (`/dashboard/people`, `lib/people.ts`, `/api/people/*`) — create
  staff accounts, reset a password, block a leaver, all inside your own firm. This is what makes the
  product sellable: the customer onboards their own staff without the operator. An owner may create
  another owner, since a firm with one admin is a single point of failure the operator then has to
  unlock by hand. **The workspace comes from the session and a body value is ignored outright rather
  than validated** — there is no legitimate reason for a client to name one. Asserted twice: at the
  lib layer (`people-scoping.test.ts`, real DB, cross-firm block/reset refused *and* the target
  verified untouched) and at the route layer (`people-routes.test.ts`, forged `workspaceId` /
  `workspace_id` / `workspace` in the body all ignored).
- **The platform tier** at `/platform` and `/platform/usage`, in its own `(platform)` route group
  with its own shell. Deliberately not under `(app)`: that layout requires a workspace, and the
  operator may not have one. Open a firm (name + first owner's email -> workspace, owner account,
  temp password shown once), suspend/resume it, and reset a firm owner's password — the one
  per-person action the platform tier keeps, because a firm's owner is the top of that firm and
  nobody inside it can unlock them. `lib/platform/aggregate-only.test.ts` asserts every platform
  route 404s for a non-admin and that no response body, recursively, contains question text,
  document text, or a per-user activity row.
- **Firm provisioning** (`web/lib/platform/firms.ts`, engine `POST /workspaces/{id}/bootstrap`).
  `createFirm` creates the workspace, its first owner and the membership in one transaction — a
  half-created firm is invisible in the UI and needs a database client to clean up, which is exactly
  what this panel exists to avoid. The engine bootstrap (the Everyone group) runs *after* the
  transaction commits, never inside it: it is a different service over HTTP and holding a
  transaction open across a network call is the pool-starvation mistake this codebase has already
  paid for twice. Its outcome is returned as `bootstrapped: boolean` rather than logged — a warning
  in a server log is invisible to the operator standing in front of the panel.
- **Password change** (`/change-password`, `lib/auth/change-password.ts`). Previously an
  admin-created account kept the password its creator generated, forever — tolerable when one
  account was seeded by hand, not when a firm's owner creates forty. Requires the current password
  even though the caller is authenticated (otherwise an unlocked screen is a permanent account
  takeover), enforces a 12-character floor without composition rules, and deletes every OTHER
  session for that user while keeping the caller's own — changing a password is what you do after
  one leaks, so leaving the leaked session alive would make the act pointless.
- Workspace suspension is enforced in `validateSessionToken`, beside user blocking and for the same
  reason, and refused at login too — without the login check a suspended firm's user would get a
  valid cookie and be bounced straight back, with no explanation and no way out of the loop.
- `validateSessionUserOnly()` — resolves a session's user *without* requiring a membership, used
  only by `getSuperAdmin()`. A platform operator in hosted mode owns no firm, and
  `validateSessionToken` returns null with no membership row, so the operator could not previously
  log in at all. Keeping it a separate function preserves the non-null `workspace` guarantee for all
  38 `getCurrentUser()` call sites instead of making it nullable everywhere for one screen.
- Schema for the three-tier admin model (migration `0016`): `workspaces.suspended_at` (a firm
  suspended by the platform operator — on the workspace, not per user), `users.must_change_password`
  (set on every admin-created account), and a unique index `memberships_one_workspace_per_user`.
  That last one makes "one user, one firm" an invariant rather than an accident:
  `validateSessionToken` resolves the workspace with `findFirst()` and no `ORDER BY`, so a user with
  two memberships would land in whichever Postgres happened to return. Verified before migrating
  that no existing user holds two.
- `web/lib/chat-isolation.test.ts` — a regression test locking chat history to the signed-in person.
  No production change: `listChats` already filtered on `userId` and `getChatMessages`/`renameChat`/
  `deleteChat` already went through `chatOwned(chatId, workspaceId, userId)`. The tests exist so a
  later refactor cannot quietly widen it to "everyone in the workspace" — which is exactly what the
  document listing had done unnoticed. The load-bearing case asserts a client-supplied `userId` is
  ignored, and it was verified to fail when the route was temporarily made to honour one.

### Changed
- The session now carries the caller's `role`. `validateSessionToken` already fetched the
  `memberships` row to resolve the workspace and then discarded the role, so every surface needing
  it re-queried. Adding it is additive (no call site broke) and costs no extra query;
  `getOwner()` drops its own lookup as a result. An unrecognised role string falls to `'member'` —
  least privilege, never widened.
- `listDocuments` / `listFolders` (web BFF) now take a **required** `Caller` and forward
  `user_id` + `role` to the engine. Required rather than optional for the same reason as the engine
  side: an optional caller is how the listings came to ignore the access model at all.
- The document-level permission predicate now lives once, in
  `engine/app/access.py::document_perm_sql(doc_expr)`, and is used by retrieval
  (`ask/retrieve.py::_perm_sql`, via `c.document_id`) and by both library listings (via `d.id`).
  CLAUDE.md already stated the aim — one predicate, reused by every surface — and the listings
  were where it had not been applied.

### Fixed
- **Marketing: `og:image` had silently disappeared from every page.** Moving the root layout under
  `[locale]` also detached `app/opengraph-image.tsx`, because a metadata image attaches to the
  segment tree it sits in — the generated HTML simply had no card and no error anywhere. And once
  each page defined its own `openGraph` block, the automatic injection stopped for a second reason:
  **`openGraph` does not deep-merge across segments**, so a page setting `openGraph: { url }` and
  expecting to inherit `siteName`, `locale`, `type` and the image lost all four. `lib/metadata.ts`
  now returns the complete block, image included, and the image lives at
  `app/[locale]/opengraph-image.tsx` with its own `generateStaticParams` (without one the build
  emits a single on-demand `ƒ /-/opengraph-image` instead of three prerendered cards). Both found
  by grepping the built HTML, which is now the way to check this after any routing change — the
  failure is invisible until someone pastes a link into Slack.
- **Marketing: `og:url` on every subpage pointed at the homepage**, inherited from the layout, so a
  share of `/pricing` resolved to `/`. Each page now emits its own.
- `Sources.tsx`'s upload input used `className="hidden"` — the same WCAG 2.1 SC 2.1.1 (Level A)
  keyboard trap fixed in the tour's `UploadStep.tsx` last week and recorded then as still present
  here. `display:none` removes an element from the tab order entirely, so a keyboard-only user
  could never reach the file chooser. Now `sr-only` plus a `has-[:focus-visible]` ring on the
  label. This was the last instance of the bug.
- Guided tour: `UploadStep.tsx`'s dropzone file input used `className="hidden"` (`display:none`),
  which removes an element from the tab order entirely — a keyboard-only user could never reach or
  open the native file chooser at the tour's upload step, confirmed live (`Tab` skipped straight
  from the card to "Skip this"). WCAG 2.1 SC 2.1.1, Level A. Changed to `className="sr-only"`
  (visually hidden, stays focusable and announced to assistive tech) plus a
  `has-[:focus-visible]` ring on the wrapping label, since the input's own focus ring is otherwise
  clipped to 1px. Confirmed live after the fix: `Tab` reaches the input, `Enter` opens the native
  file chooser, and a visible ring appears on the label (6.27:1 against `--paper`).
- Guided tour: focus fell to `<body>` whenever the tour ended (`Escape`, `TARGET_NOT_FOUND`, or
  `Done`), confirmed live across all three paths. `TourProvider.tsx` now captures
  `document.activeElement` when `start()` runs and restores it in `endTour()` if still attached to
  the document — fixes the common Guide-replay path (confirmed live: ending a Guide-launched tour
  now returns focus to the Guide button, not `<body>`). Auto-start and pill-launched sessions still
  fall back to `<body>`, since neither has a durable element to restore to — a known, documented
  gap (see the new accessibility note below), not chased further in the last task of this feature.

### Added
- `docs/product/2026-07-26-tour-accessibility-note.md` — a WCAG 2.1 AA note for the guided tour
  with measured evidence (contrast ratios computed from `styles/tokens.css` and cross-checked
  against live `getComputedStyle()` reads; keyboard-only, focus-management, 400%-zoom/320px in all
  three locales, and `prefers-reduced-motion` all verified live against the real Docker app) and
  honestly stated gaps, including the two fixes above and two gaps left undone (no `aria-live` on
  the upload status line, and the identical hidden-file-input pattern still present in the
  standalone `Sources.tsx`, out of this task's scope). Explicitly **not** an EAA/EN 301 549
  conformance claim, which requires a documented assessment this task does not perform — states
  that distinction outright rather than letting an AA note read as more than it is. No real screen
  reader (NVDA/JAWS/VoiceOver) was available in this environment; states that plainly rather than
  fabricating a session, and uses Playwright's accessibility-tree snapshot as the documented
  fallback.

### Removed
- `/dashboard/admin`, `AdminPanel.tsx` and all of `/api/admin/*`. Their two halves moved in opposite
  directions — usage and the firm list up to `/platform`, account creation down to the firm owner —
  so nothing was left for the page to be. **`POST /api/admin/users` is deleted, not moved**: it let
  the platform operator mint an account inside any firm, which is the firm's job. That deletion is
  the point of the tier split.
- The rejected first-run panel. `ProgressStrip.tsx` (a dismissible strip listing "Add documents /
  Sort them / Ask a question") is deleted outright, and `GetStarted.tsx`'s `workspaceEmpty` branch
  no longer renders the same three-item numbered instruction list — the founder's own verdict on
  this UI: *"it shows in one static part it wrote down the instruction but i do not want it."* The
  starter-suggestions branch (three clickable questions on a populated-but-unasked workspace) is
  untouched — that was always a real empty state, not a tutorial, and was never what got rejected.
  `AskWorkspace.tsx` no longer imports or renders `ProgressStrip`; `dashboard/page.tsx`'s onboarding
  facts (`deriveOnboarding`, `onboarding_dismissed_at`) are kept exactly as they were — they still
  decide `workspaceEmpty`/whether Get Started shows at all, which is a live, still-needed question
  independent of the panel that used to sit on top of it.

### Added
- Real empty states, replacing the deleted panel — one line of orientation plus a single action,
  never a list. **Ask pane** (no documents): one sentence plus an **Add documents** button to
  Sources. **Sources**: an **Upload documents** button now lives inside `FolderGrid`'s own empty
  message (`onUploadClick` opens the same hidden file input `Sources.tsx`'s top-of-page button
  already drives — one upload implementation, two entry points). **Access**: permanent prose on the
  access model — group intersection, owner bypass — rendered directly on `/dashboard/access`, not
  only inside the tour's `access-v1` card, since a bank evaluator re-reading how the model works six
  months from now has no tour to replay it from. **Atlas**: what it is and that it needs documents,
  in its existing empty-canvas message — Atlas is deliberately not a tour step (`react-force-graph-2d`
  paints to one `<canvas>`, so no selector can ever resolve a graph node), which makes this the only
  place it gets explained at all. All four are localized: `emptyStates.{askNoDocuments,sourcesEmpty,
  access,atlas}` added to `web/lib/i18n/{en,ru,uz}.ts`, keeping every locale's key set in sync
  (`i18n.test.ts`) and the Uzbek free of ASCII apostrophes.
- The just-in-time citation hint (`web/app/(app)/_components/tour/CitationHint.tsx`) — a single
  non-modal coach mark anchored to the first citation chip of the first cited answer a user ever
  sees, shown once per user and never again. Deliberately not a tour step: the citation button does
  not exist in the DOM until an answer with a citation actually renders, so a fixed step anchored to
  one is broken by construction, and teaching it at the moment it happens beats narrating it 90
  seconds earlier at `ask-v1`. No scrim, no focus trap, no stolen focus — dismisses on click
  (anywhere, including the citation chip itself) or Escape, and records `citation-hint-v1` via the
  existing `POST /api/tour/step` the instant it becomes visible, not gated behind the user actually
  dismissing it, so "never returns" holds even for someone who ignores it and navigates away.
  `TourProvider.tsx`'s context grew `hasSeenStep`/`recordStepSeen`, generalized out of the joyride
  step-record effect so the hint can reuse the exact same seen-set and `ON CONFLICT DO NOTHING`
  idempotency every tour step already relies on, without running through joyride at all. Caught live
  against a real Docker build (not just tests): the first implementation called `hasSeenStep()` fresh
  on every render, and the hint's own position-tracking effect calls `setPos` once per animation frame
  while visible — so the very next frame after the hint appeared, it re-read the ref its own "record
  seen" effect had just flipped to `true` one render earlier and unmounted itself, all inside one
  frame (<16ms), correctly recorded but never actually seen by anyone. Fixed by snapshotting
  `hasSeenStep(CITATION_HINT_KEY)` once, via a lazy `useState` initializer at mount (`anchorEl` is
  still `null` at that point, before any citation exists), instead of re-deriving it on every render.
- Fixed a bug Task 7 flagged and carried forward: `ask-v1` could be recorded as "seen" even when its
  target (`ask-composer`) never mounted — on an all-empty workspace `AskWorkspace` renders
  `GetStarted` instead of `AskChat`, so the composer doesn't exist, yet `stepIndex` still advanced to
  `ask-v1` and the old effect recorded it regardless, a tick before joyride's own `TARGET_NOT_FOUND`
  ended the tour. The "record seen" effect in `TourProvider.tsx` is now gated on the step's own
  `currentTarget` actually being resolved, not on `currentStepDef` alone — recording a step the user
  was never shown corrupts `nextStepKey`'s resume logic, which trusts every `user_tour_steps` row to
  mean exactly that. Deleting `GetStarted.tsx`'s instruction branch alone did **not** fix this:
  `showGetStarted()`'s condition — GetStarted vs. AskChat — was unchanged, so the composer still
  never mounts on a genuinely empty workspace; this provider-level gate is what actually closes it,
  for every step, not just `ask-v1`.
- Guided tour persistence, auto-start gate and replay entry point. `user_tour_steps(user_id,
  workspace_id, step_key, seen_at)` and `users.tour_dismissed_at` — server-side, never localStorage,
  so a second person signing in on a shared bank-branch workstation gets their own tour instead of
  inheriting the first person's "completed" flag (proved live: two accounts in one browser session,
  each auto-started independently). No stored step cursor anywhere: `web/lib/tour/state.ts` exports
  two pure, no-import functions — `nextStepKey` (the first defined step key not yet in `seen`,
  ignoring any unknown/retired key so a renamed step can never break resume) and `shouldAutoStart`
  (true only when there are zero seen rows, the user hasn't dismissed, the landing path is exactly
  `/dashboard`, and no upload is in flight). `POST /api/tour/step` (auth → CSRF → upsert `ON CONFLICT
  DO NOTHING`) records `{stepKey}` the instant a step is SHOWN, not completed, and rejects any
  `stepKey` outside the known, append-only set with 400 so a typo can't silently pollute the table.
  The provider auto-starts per that gate; otherwise a quiet, dismissible "Take the tour" pill appears
  (never on a deep link — landing on `/dashboard/sources?doc=…` shows the pill, not the tour). A
  permanent **Guide** item in `Rail.tsx`'s bottom cluster, above `egress 0 B`, replays the full tour
  from step 1 on demand without ever clearing `user_tour_steps` — verified live (rows identical before
  and after) — which is what lets a future new step still be offered to a user who "completed" an
  earlier version of the tour, and is the only affordance for the user onboarded months after
  everyone else, who never hits the narrow first-run window at all.
- i18n dictionaries (`web/lib/i18n/{index,en,ru,uz}.ts`) and `users.locale`, per-user (`'en'|'ru'|'uz'`,
  defaulting `'en'`) — the first piece of the guided tour, built before any tour UI so the copy is data
  from the start instead of hardcoded English dug back out later. `Dictionary` type is inferred from
  `en.ts` and checked against `ru.ts`/`uz.ts` at compile time as well as by a vitest key-set walk. The
  Uzbek dictionary is real Uzbek Latin — `ʻ` (U+02BB), never the ASCII apostrophe that already broke
  `engine/app/ask/qtype.py`'s keyword matching; a test enforces it. `getDictionary` is intentionally
  not behind `server-only` in `index.ts` since `isLocale` and the dictionary objects themselves must
  stay importable from tests and client components — the guard belongs on whichever server component
  later reads the user's locale.
- Guided tour spec — `docs/superpowers/specs/2026-07-26-guided-tour-design.md`. Replaces last week's
  static first-run panel, which was rejected for covering the dashboard with instructions instead of
  explaining it in place. Two layers: the real dashboard untouched underneath, a guidance card above
  with Next/Back, and the file upload happening **inside** the card. react-joyride (MIT) in controlled
  mode with a fully custom card; **no dimming scrim**, because a 0.3-0.5 veil drops `--ink-soft` to
  2.99-4.16:1 on `--paper` and fails WCAG 1.4.3 — and because the dashboard staying readable is the
  point. Records why Shepherd.js (relicensed MIT->AGPL at v14.0.1), intro.js (AGPL + paid licence) and
  Onborda (claims MIT, ships no LICENSE file) were rejected, and that every hosted tour SaaS is
  disqualified by air-gap. Tour state is an append-only seen-steps table server-side, never
  localStorage — on a shared branch workstation the second employee would inherit the first's
  "completed" flag and never be onboarded.
- Super-admin panel at `/dashboard/admin` — aggregate usage plus user creation and blocking. Rail
  shows the Admin link only to a super-admin; everyone else 404s on the route.
- Aggregate usage from data already recorded — questions and active users per day, question-type
  mix, documents and folders per workspace, and the `lexical_arm_empty` / `answer_uncited`
  degradation rates the retrieval work introduced. Counts only: a test asserts the response contains
  no question text and no per-user rows, so the aggregate-only promise is structural rather than a
  convention.
- Admin users API: list every account with its workspace, role, recent-activity timestamp and
  blocked status; create a user with a generated temporary password returned exactly once;
  block/unblock. All super-admin gated, 404 to anyone else.
- Blocking a user now revokes their live sessions and is enforced inside `validateSessionToken`,
  the choke point every authenticated request passes through, so a blocked user fails on their next
  request rather than at cookie expiry. Login refuses a blocked account with the same generic error
  as a wrong password, so the panel does not confirm which addresses exist. A super-admin cannot
  block themselves.
- `users.is_super_admin` (seed-only) and `users.blocked_at`; `npm run seed` idempotently ensures
  `SEED_EMAIL` is the platform super-admin — creating the account with the flag set if it's new,
  promoting it in place (without touching password, name, or memberships) if it already exists —
  and prints which state it left the account in, so an already-deployed install can always gain a
  super-admin without hand-written SQL.
- Super-admin panel implementation plan —
  `docs/superpowers/plans/2026-07-25-super-admin-panel.md`. 5 tasks. Blocking is enforced inside
  `validateSessionToken`, the choke point every authenticated request already passes through, so one
  edit covers every surface; Task 4 carries the sentinel test that keeps usage aggregate-only.
- Super-admin panel spec — `docs/superpowers/specs/2026-07-25-super-admin-panel-design.md`. A
  platform super-admin above all workspaces (`users.is_super_admin`, seed-only so the panel cannot
  mint its own privileged accounts), user creation and blocking, and aggregate-only usage built from
  data already recorded — no new instrumentation. Blocking revokes live sessions rather than waiting
  for cookie expiry. Two invariants are enforced by tests rather than convention: no admin endpoint
  may return question text or a per-user activity row, and a super-admin cannot block themselves.
  States two real gaps plainly: there is no password-change flow, and "time spent" is not reported
  because existing data cannot answer it and a proxy would look precise while being wrong.
- First-run experience. The Ask page no longer hands a brand-new user an empty chat box whose first
  reply is "I couldn't find anything in your sources to answer that" — an empty workspace now shows
  what CompanyMind does, the three steps to get there, and a button to add documents. A populated
  workspace instead offers three starter questions drawn from folders the caller can actually see;
  clicking one asks it for real, landing in a live thread rather than just prefilling the input.
  A dismissible progress strip tracks the three steps, each derived from real data rather than a
  stored wizard position, so it resumes correctly and reverts honestly if documents are deleted.
- Onboarding state (`web/lib/onboarding.ts`): a pure `deriveOnboarding()` computing the three steps
  from real facts — a document is indexed, any document is foldered, the user has asked a question —
  rather than a stored wizard step, so it resumes correctly and reverts honestly if documents are
  deleted. Dismissal (`POST /api/onboarding/dismiss`) hides the strip without ever marking
  incomplete work complete. `GET /api/suggestions` proxies the engine's permission-scoped starter
  questions.
- Starter questions (`engine/app/library/suggest.py`, `GET /suggestions`) built from the caller's own
  folders and their stored keywords, ranked by how many documents that caller can actually see, with
  a deterministic template when no chat model is configured. Scoped by the same `resolve_access` rule
  the ask path uses — a suggested question is a disclosure, so a member is never offered one derived
  from a document they cannot open.
- **Organise with AI** button on Sources, shown whenever unfiled documents exist, reporting what it
  did ("Organised 12 documents into 3 folders"). Folders it creates are marked "suggested" until
  renamed or otherwise touched.
- AI organise (`engine/app/library/organize.py`, `POST /folders/organize`): clusters **unfiled**
  documents into named folders, reusing the Atlas pipeline — mean document vectors via pgvector's
  `avg(vector)`, KMeans at a folder-sized k (`clamp(round(√n), 2, 8)`), TF-IDF keywords, and the
  existing labeller with its deterministic keyword fallback — so it needs no new ML, no GPU, and is
  reproducible under the fake providers. A user's own filing is never overwritten, documents with no
  embeddings are skipped rather than dumped into a folder, and folder names de-duplicate against
  existing ones.
- Folder detail pages (`/dashboard/sources/[folderId]`, plus the literal `unfiled`) listing that
  folder's documents with the existing access-group editor, a **Move to…** select per document, and
  folder rename/delete. Deleting a folder moves its documents to Unfiled and says so in the
  confirmation. Deliberately not drag-and-drop: it breaks on touch and by keyboard. The access
  editor now states in one line that folders never change who can see a document.
- Web BFF and API routes for folders (`web/lib/folders.ts`, `/api/folders`, `/api/folders/[id]`,
  `/api/documents/[id]/folder`), all CSRF-guarded on mutation. `GET /api/documents` accepts a
  `folder` filter and every document row now carries `folderId`.
- Engine folder library and endpoints (`engine/app/library/folders.py`): list with per-folder
  document counts and an unfiled count, create/rename/delete, and document assignment. Renaming an
  AI-created folder marks it reviewed. `GET /documents` gained a `folder` filter (a folder id or the
  literal `unfiled`) and now returns `folder_id`. A test asserts that moving a document between
  folders leaves permission-scoped retrieval byte-identical for both a group member and an outsider —
  folders are navigation, and this is what stops them quietly becoming access control.
- `folders` table plus `documents.folder_id` (one folder per document, `NULL` = Unfiled, `ON DELETE
  SET NULL` so deleting a folder never deletes documents) and `users.onboarding_dismissed_at`.
  Folders are navigation only — access control remains entirely in `document_groups` ×
  `group_members`, and no code path reads `folder_id` when computing visibility.
- Onboarding + folders implementation plan —
  `docs/superpowers/plans/2026-07-25-onboarding-and-folders.md`. 10 TDD tasks in three stages:
  folders (schema, engine CRUD, BFF, folder grid, folder detail with Move to…), AI organise, and the
  first-run flow. Task 2 carries the security test that keeps folders from quietly becoming access
  control.
- Onboarding + document-folders spec —
  `docs/superpowers/specs/2026-07-25-onboarding-and-folders-design.md`. Diagnoses the day-one
  failure: a new owner lands on Ask, types a question, and the first thing the product says is the
  refusal sentinel, because the workspace is empty and no surface says so. Adds a first-run flow
  whose progress is **derived from real data** (indexed documents exist / any document is foldered /
  the user has asked a question) rather than a stored wizard step, so it is resumable and cannot
  desync; it adapts to an empty vs a populated workspace, and offers three starter questions built
  from the caller's own folder labels and keywords, permission-scoped so a member is never shown a
  question about a document they cannot open. Adds flat `folders` (one per document, NULL = Unfiled,
  `ON DELETE SET NULL` so deleting a folder never deletes documents) with an AI organise step that
  reuses Atlas's existing KMeans + TF-IDF + label pipeline rather than adding new ML. The
  load-bearing invariant: **folders are navigation, never access control** — enforced by a test that
  moves a document between folders and asserts permission-scoped retrieval is byte-identical.
- Retrieval accuracy attribution (`docs/product/2026-07-25-retrieval-attribution.md`) — the Phase 1
  deliverable, apportioning the accuracy complaint across the eleven candidate causes from the
  re-architecture spec. **One cause is now confirmed by measurement:** `plainto_tsquery` ANDs every
  query term and is used as a hard `WHERE` filter, so **7 of 8 golden questions retrieve zero rows
  from the lexical arm** — in English as well as Russian and Uzbek. The only question that fires is a
  rare exact token (`CKPT_PREFETCH`). Equal-weight RRF then fuses a populated dense list with an empty
  lexical one, so "hybrid retrieval" has silently been dense-only for essentially every
  natural-language question since migration `0006`. The document separates what is measured (fixture
  corpus, fake providers — a mechanism check, not a rate) from what still requires the pilot corpus
  and self-hosted models, gives the exact commands for those runs, and states plainly that
  `ef_search` must not be touched until the ANN probe has run on real data.
- **Retrieval evaluation harness and its CI gate** (`engine/evals/run.py`,
  `.github/workflows/eval.yml`). Seeds a throwaway workspace from a committed synthetic EN/RU/UZ
  fixture corpus through the real ingest pipeline, runs each golden question as the principal it
  specifies, and reports doc-recall@8, quote-recall@8, nDCG@8 and MRR plus the lexical-arm row count
  and degradation count. Gates on three things: **any permission leak fails the build outright**
  (a member principal retrieving an HR-restricted document), a paired-bootstrap regression against
  `engine/evals/baseline.json` fails it, and the whole run happens with deterministic fake providers
  so CI needs no GPU, no credentials and no network. A stale baseline that shares zero question ids
  with the current run (e.g. the golden set's ids were edited without regenerating the baseline) is
  also a hard failure rather than the silent "no change" a naive paired diff would report. Customer
  golden sets and corpora stay outside the repo by `.gitignore`.
- `engine/evals/probe_ann.py` — a label-free ANN-vs-exact recall probe sweeping
  `hnsw.ef_search` × `hnsw.iterative_scan` × synthesized ACL selectivity (100% down to 0.5%), using
  exact search (`enable_indexscan=off`) as ground truth. Run before Phase 2 changes any GUC, so the
  "filtered HNSW loses recall" hypothesis is measured on this corpus rather than assumed. Each
  `ProbeRow` carries `n_gold` (the ground-truth set size) alongside `recall`, and `recall` is `None`
  — never a fabricated `1.0` — when `n_gold == 0`, so a vacuous "nothing survived the filter" row
  can't be misread as a perfect match at the low-selectivity end of the sweep.
- **Retrieval telemetry.** `engine/app/ask/telemetry.py::RetrievalDebug` records per-arm candidate
  counts (dense / lexical / fused / rerank-in / final), per-stage latency, whether reranking actually
  applied, and a `degraded[]` list; `retrieve()` now returns `(results, debug)` and `answer_query`
  persists all of it to new `query_log` columns (`degraded`, `timings_ms`, `candidate_counts`,
  `rerank_applied`, `question_type`). A zero-row lexical arm — the expected symptom of
  `plainto_tsquery` ANDing every term — is itself recorded as `lexical_arm_empty`, which is how the
  Phase 1 attribution table gets its numbers.
- `engine/tests/test_store.py` — orchestration-level coverage for `process_document` that
  `test_prepare.py` couldn't provide (it only exercises the DB-free `prepare_document` in
  isolation). Three tests: shrinks the connection pool to one connection and proves it stays
  available for the pool to hand out *while `prepare_document` runs*, so a future regression that
  re-wraps that call inside the phase-1 `with get_conn()` block trips a `PoolTimeout` and fails
  the test instead of silently starving `/ask`/Telegram/Atlas again; a zero-chunk document ends
  at `status='failed'` with a non-null error rather than `status='indexed'`; and a failure inside
  the prepare phase is recorded in both `documents` and `ingestion_jobs`.
- **The repo's first CI** (`.github/workflows/ci.yml`): the engine job runs against a real
  `pgvector/pgvector:pg16` service with migrations applied, so the ten `skipif(not DATABASE_URL)`
  test files — including the permission-filter test — now actually execute on every push instead of
  silently skipping. The web job runs vitest plus `next build` with no env, guarding the lazy
  DB-client/env design.
- Retrieval & ingestion re-architecture spec —
  `docs/superpowers/specs/2026-07-25-retrieval-rearchitecture-design.md`. Backed by a 24-agent
  research run (12 web-research sweeps, 2 code audits, 3 competing architectures, 6 adversarial
  critiques). Core finding: the blocker is the **type of a citation** — `ParsedDoc(text: str)` plus
  `(page, char_start, char_end)` cannot express a cell range, an audio timespan, or a bbox, which is
  why "any format" and "cite the exact source" are currently mutually exclusive. Replaces the flat
  string with typed `blocks` carrying a modality-polymorphic `locator jsonb`, makes `chunks` a pure
  retrieval unit joined via `chunk_blocks`, and keeps everything in the one Postgres. Documents
  eleven verified accuracy defects (chief among them: `plainto_tsquery` ANDs every term and is used
  as a hard WHERE filter, so the lexical arm usually returns zero rows and "hybrid" silently
  degrades to dense-only; `to_tsvector('english', …)` over Cyrillic is a no-op stemmer), two
  data-destroying bugs (`citations` cascade-delete on re-ingest destroys the evidence for every past
  answer; `embed.py` assumes response ordering), and the absence of any CI or eval harness. Phases
  the work 1–5 (~17.5 engineer-weeks) with OCR, audio and the aggregation lane deferred, and records
  the architectures rejected on evidence (visual/ColPali late interaction, agent loops, a second
  datastore, GraphRAG, RAPTOR, semantic chunking, late chunking, HyDE).
- Phase 1 implementation plan —
  `docs/superpowers/plans/2026-07-25-phase1-measure-and-stop-the-bleeding.md`. 14 TDD tasks: the
  repo's first CI (which makes the ten `skipif(not DATABASE_URL)` test files actually run), the five
  stop-the-bleeding fixes, retrieval telemetry into `query_log`, a deterministic question-type
  classifier, the ANN-vs-exact recall probe that decides whether Phase 2 touches `ef_search` at all,
  a label-stable golden-set format with cluster-robust paired-bootstrap gating, and the attribution
  document Phase 2 is planned from.
- Deterministic question-type classification (`aggregate` / `enumerate` / `comparison` / `lookup`,
  EN + RU + UZ keyword rules) recorded on every logged query. This is the measurement that gates
  whether the structured-aggregation lane gets built at all — the spec requires the aggregate share
  of real traffic to exceed ~15% first.
- `web/scripts/seed-corpus.ts` (`npm run seed:corpus`) — bulk-loads a directory of
  documents plus a `manifest.json` (filename -> access-group names) through the real
  web API: mints a session for an existing seeded user directly in the auth DB
  (self-contained, like `scripts/seed.ts`), creates any missing access groups,
  uploads each file, sets its groups, and triggers an Atlas rebuild. Used to load a
  150-document synthetic demo corpus spanning all departments for testing
  permission-aware retrieval and the Atlas governance lenses end-to-end.
- `web/app/(app)/_components/Wordmark.tsx` — the dashboard sidebar now shows the icon mark
  next to "CompanyMind" (previously text-only), matching the mark already used in the
  marketing nav and the favicon: nested squares, violet inner square on the app's `--brain`
  token / hardcoded `#684BFF` in the standalone SVGs. Duplicated rather than shared-imported
  from `marketing/`, per the web/marketing deployable boundary.
- Golden-set format and retrieval metrics (`engine/evals/goldenset.py`, `engine/evals/metrics.py`).
  Gold is `(filename, verbatim quote)` rather than chunk ids, so labels survive the re-chunking that
  Phases 3–4 deliberately perform. Metrics: doc-recall@k, quote-recall@k, MRR and nDCG@k (via `ranx`),
  plus a paired bootstrap whose resampling unit is the **source document**, because with several
  questions per document naive standard errors can be ~3× too small and real regressions read as noise.
- Typed guided-tour target registry (`web/lib/tour/targets.ts`): `TourTarget`, a five-member const
  union (`'ask-pane' | 'ask-composer' | 'rail-sources' | 'rail-access' | 'organise-button'`), plus a
  `TourTargetProvider`, `useTourTarget(name)` (a memoised callback ref that registers on mount and
  deletes on unmount) and `useTourTargetEl(name)` for the tour shell to read. Naming a target that
  isn't in the union is a `tsc` error at `npm run build`, instead of a CSS selector that silently
  stops matching once someone renames a class. The five refs are wired up: the Ask pane wrapper
  (`AskWorkspace.tsx`), the composer form (`AskChat.tsx`), the Sources and Access rail links
  (`Rail.tsx`, matched by `href` since NAV's length varies with role and hooks can't be called
  inside its `.map()`), and the Organise-with-AI button (`FolderGrid.tsx`, which only renders when
  `unfiledCount > 0` — the callback ref's `null`-on-unmount call is what keeps that safe). No DOM,
  styling, or behaviour changes; `TourTargetProvider` is not yet mounted anywhere (that's the tour
  shell, a later task), so until then registration is a harmless no-op by design.
- Guided tour shell: `react-joyride@3.2.0` (MIT, pinned exact, ~20.3 kB gzipped on its own —
  bundlephobia's 25.6 kB cited in the spec includes its transitive deps) in controlled mode, with a
  fully custom card (`web/app/(app)/_components/tour/TourCard.tsx`) and provider
  (`TourProvider.tsx`), both mounted in `(app)/layout.tsx` so the tour survives route changes.
  `useTour()` exposes `{ start(), active }`; `stepIndex` is set only from joyride's own `onEvent`
  callback, never a `useEffect` watching app state, per joyride's own "don't" about that. `options`
  sets `hideOverlay: true` (no dimming scrim — a 0.3–0.5 veil drops `--ink-soft` to 2.99–4.16:1 on
  `--paper` and fails WCAG 1.4.3), `overlayClickAction: false`, `disableFocusTrap: true` (joyride's
  default focus trap targets whatever DOM node ends up as the floater wrapper regardless of a custom
  `tooltipComponent`, and would fight the file input a later step hosts inside the card), and
  `scrollDuration: 0` under `prefers-reduced-motion` (via `useSyncExternalStore`, not
  `useState`+`useEffect`, on `matchMedia`). `TourCard` uses `role="dialog"` +
  `aria-labelledby`/`aria-describedby`, never joyride's own `tooltipProps`
  (`role="alertdialog"` + `aria-modal="true"`, which would confine a screen reader's virtual cursor
  to the card and hide the exact dashboard element the step points at); `tabIndex={-1}` with focus
  moved to the card on every step (joyride remounts the floater per step index, so a mount effect is
  a per-step focus move); fluid `max-width: min(92vw, 28rem)`, never a fixed width — joyride's
  380px default breaks the 320 CSS px reflow target at 400% zoom, and Russian runs 15–30% longer
  than English on exactly these short strings. Escape ends the tour unconditionally from every step
  (checked via the event's `origin`, ahead of `action`/`type` — joyride's own `dismissKeyAction:
  'close'` only closes the current step, silently advancing on a non-final one instead of exiting;
  WCAG 2.1.2 Level A). The active target gets a `--brain` ring via a `data-tour-active` attribute
  (`globals.css`), set and removed on every step change and on tour end. Two throwaway steps prove
  the wiring end to end (`welcome-v1` → the Ask pane, `access-v1` → the Access rail link); the real
  steps land in `web/lib/tour/steps.ts` next task. Verified against the real Docker app: the card
  renders in the product's visual language, the dashboard behind it stays clickable (a click on
  "+ New chat" while the tour is open lands for real), Escape ends the tour from a non-final step
  with the ring and card both gone, Tab reaches Skip/Next and focus lands on the new card on step
  change, and the card holds to `min(92vw, 28rem)` (294px) with no overflow at a 320px viewport.
  Zero outbound network calls (checked the full request log — only the app's own assets and API
  routes).
- Guided tour steps (`web/lib/tour/steps.ts`): `buildSteps({ role, dict, hasUnfiled, csrf })` returns
  the owner's four-step tour (`welcome-v1`, `upload-v1`, `access-v1`, `ask-v1`; `organise-v1` is a
  later task's seam) or the member's three (`welcome-v1`, `access-member-v1`, `ask-v1`) — no upload
  step for members, ever, since telling someone without upload rights to upload is exactly the
  failure the adaptive per-role design exists to avoid. `TourStep.placement` is typed as joyride's own
  `Step['placement']`, not the `Placement` export alone — `Placement` by itself excludes `'center'`,
  which `welcome-v1` needs; found by reading the installed react-joyride 3.2.0 source directly, since
  its docs site 404s. `ask-v1` renders a static, non-interactive replica of `AskChat.tsx`'s citation
  chip (`[1] hr-policy.pdf · p.4 ↗`, `aria-hidden`, same classes, plain `<span>`s) — a step can never
  target the real button, which doesn't exist until an answer with a citation renders.
- `web/app/(app)/_components/tour/UploadStep.tsx`: a real dropzone + file picker inside the tour card,
  built on `useDocumentUpload(csrf)`, plus a live "N files received · M indexed" line polling
  `GET /api/documents` every 2500ms. **The rule that matters most:** the shared "Next" button enables
  the moment `accepted >= 1` (an HTTP 201), never on indexing completion — ingestion runs for minutes
  on a real corpus, and joyride's `before` hook is capped at 5000ms, so gating advance on indexing
  would time out and strand the user at a spinner in a card they cannot dismiss. A "Skip this" control
  always advances regardless, for someone with no files to hand. The indexed count is a delta against
  a baseline captured at mount (not the workspace's whole history, which could be hundreds of
  pre-existing documents on a replayed tour) and is purely informational — a failed poll shows nothing
  rather than an error, and the interval is cleared on unmount so it never outlives the step.
  `web/lib/tour/step-controls.ts` adds a small context (`TourStepControlsContext`, provided by
  `TourCard.tsx` around `step.content`) so a step's own content can gate and bypass the shared Next
  button — needed because `TourStep.content` is an opaque `ReactNode` with no props channel of its
  own back to the card shell; every other step never calls it, so Next stays enabled by default.
  Verified against the real Docker app end to end: dropped a real file into the card, `Next` enabled
  the moment the server returned 201 (before indexing finished), the status line then tracked indexing
  separately, the document reached `status='indexed'` in Postgres, Escape ended the tour mid-upload
  and the polling interval stopped with it, and a member's tour never showed an upload step at all.
- Guided tour wiring (`web/app/(app)/_components/tour/TourProvider.tsx`) and the conditional
  `organise-v1` step (`web/lib/tour/steps.ts`, spec §4 step 3) — the tour's only step that changes
  route, and the last step-work in the plan. `TourProvider` now builds its real step list via
  `buildSteps({ role, dict, hasUnfiled, csrf })` (replacing Task 4's two-step proof-of-wiring
  placeholder); `hasUnfiled` comes from `GET /api/folders`, checked once when the tour starts and
  held fixed for that run so the step array's length can never drift out from under an in-flight
  `stepIndex`. `organise-v1` is included only when unfiled documents exist, sitting between
  `upload-v1` and `access-v1`, anchored to `FolderGrid.tsx`'s real "Organise with AI" button.
  `TourStep` gained a `heading` field (steps.ts), sourced from the same dict entry as its body, so
  `TourCard`'s `<h2>`/`aria-labelledby` never renders empty — a gap Task 5 deliberately left for this
  task to close.
  Its `before` hook (`router.push('/dashboard/sources')`) is the tour's one forward navigation;
  `access-v1`'s `before` (`router.push('/dashboard')`) is the one return, attached only when
  `organise-v1` ran this tour. **`before` and joyride's `targetWaitTimeout` don't compose the way
  the plan assumed** — verified by reading `react-joyride@3.2.0`'s own shipped source
  (`useLifecycleEffect.ts`; its docs site 404s): a step with a `before` hook gets exactly one
  target-existence check the instant the hook's promise resolves, never joyride's own poll. So
  `organise-v1`'s hook polls the target registry itself (100ms interval, 4000ms budget — under
  joyride's 5000ms `beforeTimeout`, so the wait always settles on its own terms rather than via
  joyride's before-hook timeout, which also fires an `EVENTS.ERROR`). `handleEvent` now treats
  `EVENTS.TARGET_NOT_FOUND` as "skip this step" (advance `stepIndex`, or end the tour if it was
  last) instead of ending the tour outright — joyride's own auto-advance for a missing target only
  runs in *uncontrolled* mode, so a controlled tour doing nothing here would strand the user with no
  card and no ring. Escape still ends the tour unconditionally from every step, including
  `organise-v1` — the user is left on whatever page they're on, never navigated as a parting act.
  Verified against the real Docker app: with unfiled documents present, the step appears after
  navigating to Sources with the ring on the real Organise button; with none, the tour goes straight
  from `upload-v1` to `access-v1` with no gap or stall; Escape mid-`organise-v1` leaves the user on
  `/dashboard/sources`.

### Changed
- Sources' inline upload logic extracted into `web/lib/useDocumentUpload.ts`
  (`useDocumentUpload(csrf)` → `{ upload, busy, error, accepted }`), so the guided tour's upload
  step and the Sources page share one implementation instead of risking drift from the server's
  contract. Pure refactor — same endpoint, same per-file sequential loop (not `Promise.all`; the
  ingest path holds a database connection per request), same error copy. The hook owns `busy`/
  `error`; refreshing the folder list afterwards stays the caller's job since Sources and the tour
  do different things once an upload finishes.
- Sources is now a folder grid instead of one flat list of every document — the flat list was already
  unusable at the 150-document demo corpus. Folder cards show a document count and a "suggested" chip
  for AI folders nobody has touched yet; an Unfiled card appears whenever unfiled documents exist.
  Atlas's `?doc=` deep links still work: they now redirect into whichever folder the document is in.
- **Silent failures are now recorded.** The reranker's bare `except Exception: pass` (which made a
  reranker that never ran indistinguishable from one that worked) now appends a reason —
  `rerank_http_error:422`, `rerank_unparseable:…`, `rerank_short_response:…` — to a `degraded` list;
  `[n]` markers that don't resolve are recorded as `citation_out_of_range`, and an answer with no
  working citation as `answer_uncited`. `CONTEXTUAL_MODE=llm`, documented in settings but never
  implemented (it silently behaved as `header`), now fails fast at startup with a message pointing
  at the phase that implements it.
- Atlas computes per-document mean vectors with pgvector's `avg(vector)` aggregate in Postgres
  instead of streaming every chunk embedding in the workspace into Python (~4 KB per chunk at 1024
  dims, so a 100k-chunk corpus moved ~400 MB over the wire on every graph build).
- `marketing/components/Wordmark.tsx` and `marketing/app/opengraph-image.tsx` switched from
  the previous "walls + 3-node lattice" icon to the same nested-squares mark as the favicon
  and dashboard, so the logo is now identical everywhere it appears — landing page nav, OG
  share image, both apps' favicons, dashboard sidebar — instead of two different marks under
  one name. Also removed the unused, wrong-branded (teal, pre-dates the violet accent switch)
  `web/public/logo-teal.svg`.
- **"Brain Map" renamed to "Atlas"** — the old label put the retired "CompBrain" brand name
  right back in the nav ("never CompBrain — old name", per this file's own rule). Route moved
  `web/app/(app)/dashboard/brain-map/` → `.../atlas/`, component `BrainMap` → `Atlas`
  (`Atlas.tsx`, was `BrainMap.tsx`), nav label and page `<h1>` updated, and every internal
  comment referencing "Brain Map" across `web/` and `engine/` updated to match. No database
  or API-route changes — the engine's `graph_*` tables and `/api/graph*` endpoints were
  already named neutrally and needed no changes.

### Fixed
- `retrieve()` no longer holds a pooled database connection across the rerank HTTP call — the same
  defect class already fixed on ingest, below. Reranking (`LLMReranker`/`CrossEncoderReranker`,
  `timeout=60s`) now runs with no connection held: candidate retrieval/fusion/capping (phase A) and
  neighbor expansion (phase C) each acquire a pooled connection only for as long as they need one,
  and reranking (phase B) runs in between with none held. The shared pool has ten connections, used
  by ask, ingest, the Telegram worker, and Atlas; a slow or degraded rerank backend under concurrent
  asks could otherwise burn through it and produce `PoolTimeout` on unrelated lightweight requests.
  `engine/tests/test_retrieve.py::test_retrieve_does_not_hold_a_connection_during_rerank` shrinks the
  pool to one connection and proves it's free to acquire while `reranker.rerank(...)` is running.
- Ingestion no longer holds a pooled database connection across the embedding HTTP call. Parse →
  chunk → contextualize → embed moved into a DB-free `engine/app/ingest/prepare.py::prepare_document`,
  bracketed by two short transactions; with a ten-connection pool, ten concurrent uploads previously
  drained it and blocked every ask, Telegram poll and Atlas request for the duration.
- A document that parses to zero chunks is now recorded as `status='failed'` with an explanatory
  error, instead of `status='indexed'` with `error=NULL` — the state every scanned PDF landed in,
  which looked like a successful ingest of an empty document.
- Embedding requests now honour the response's `index` instead of assuming positional order, are
  batched at `EMBED_BATCH_SIZE` (default 32, matching TEI's default `--max-client-batch-size`), and
  raise `EmbeddingCountMismatch` rather than silently misaligning when a provider returns the wrong
  number of vectors. Previously every chunk of a document went out in a single request — failing
  outright for any document over roughly 16 pages against a stock self-hosted embedder — and a
  reordered response would have paired every chunk with the wrong vector with no symptom.
- **Re-ingesting a document no longer destroys the evidence for every past answer.**
  `citations.chunk_id` and `citations.document_id` were `ON DELETE cascade` while
  `ingest/store.py` deletes and re-creates every chunk on re-ingest, so re-uploading a revised
  policy — the most routine operation in the product — silently deleted the citation rows of every
  historical answer that cited it, while the `[1]`/`[2]` markers kept rendering in the message text.
  Both FKs are now nullable and `ON DELETE SET NULL`; the frozen `filename`/`page`/`snippet` survive
  and the UI renders such a citation as unlinkable rather than broken.
- Atlas hover/click, root cause: force-graph resolves both through a shadow canvas — every
  node is painted in a unique flat color onto an invisible canvas, and each mouse move reads
  back the single pixel under the cursor (`ctx.getImageData`) to look up which node owns that
  color. Browsers that add noise to canvas pixel reads for anti-fingerprinting purposes —
  Brave's "Block fingerprinting" shield does this by default — corrupt that lookup, so the
  returned color occasionally lands close enough to a neighboring node's to misresolve, and hover
  fails for an unpredictable subset of nodes each reload. This is a browser privacy feature
  colliding with the library's interaction model, not an app bug, and it fully explains the
  earlier "some nodes hover, some don't" reports that survived the previous three-cause fix.
  Replaced force-graph's built-in hit-testing (`enablePointerInteraction={false}`, and removed
  the now-dead `nodePointerAreaPaint`) with our own geometric hit-testing: on every mouse move,
  compare cursor position against each node's actual on-screen position
  (`graph2ScreenCoords`) and pick the nearest one within its hit radius, matching the same
  hit-area/label-footprint geometry the old pixel-based version used. The dot lookup itself
  runs against a `d3-quadtree` spatial index (rebuilt every animation frame from live node
  positions, in graph space so pan/zoom alone never invalidates it) rather than scanning every
  node per mouse move, so it stays O(log n) as the corpus grows well past today's ~150
  documents; only the much smaller label-hit check (bounded by `degreeStats.hubThreshold`,
  capped at 12) remains a linear scan. Pan/drag is tracked
  separately so panning the canvas doesn't fight the cursor with hover changes, and a
  pan-release doesn't get mistaken for a click-to-open. Never touches canvas pixel data, so
  it's immune to farbling in Brave/Tor/any similarly-hardened browser, and also closes the
  "buried under a hub neighbour" risk the previous fix's cause #3 could only flag as
  precautionary — there's no shared paint-order buffer to bury a hit in anymore.
- Atlas department colors: only 4 of 13 departments rendered in color, the other 9 fell back
  to the same warm grey as "Everyone" — the palette was a hardcoded 5-name `DEPT_COLORS` map,
  but a department is just the first non-default access group name, so the set of names is
  open-ended and any new group went grey (91 of 152 documents, once the demo corpus was
  loaded). It also carried a dead `People` key that never matched the real `HR` group. The
  established departments stay pinned as anchors (Sales keeps the brand violet); everything
  else now derives a hue seeded from its own name, assigned across the departments actually
  present with forward probing so two departments can't land on the same hue — the seed alone
  collided (IT/Support, Security/Marketing). "Everyone" stays grey on purpose.
- Atlas hover: nodes underneath the department legend could not be hovered at all. The legend
  floated over the canvas (~12% of it) and, while its wrapper was `pointer-events-none`, every
  row is a clickable filter button that opts back in — and those buttons are full-width, so
  they were effectively the whole box, swallowing hover for any node parked behind them.
  Legend moved out of the canvas into its own toolbar row of chips; the canvas is now
  unobstructed (verified: points that hit-tested to `BUTTON` now hit-test to `CANVAS`).
- Atlas hover: only the node's dot was hoverable, never its filename label. At 150+ documents
  a dot is 2.6–11px across while its caption is the largest thing on screen, so aiming at the
  text — the natural target — hovered nothing. `nodePointerAreaPaint` now also covers the
  label's text box whenever the label is drawn.
- Atlas hover: nodes are now painted largest-degree-first so the smallest paint last. hover is
  resolved through a colour-indexed buffer where each node paints over the previous one, so a
  small dot in the dense core could have its hit area buried by hub neighbours that happened
  to come later in the array.
- Brain Map hover: every hover showed two overlapping tooltips — our own (filename ·
  connections · department) and force-graph's built-in one (which defaults to `node.name`,
  the raw filename) rendering right underneath it. Suppressed the built-in one
  (`nodeLabel={() => ''}`); ours was already the complete version of the same information.
- Brain Map layout: a 0-connection document could drift arbitrarily far from the rest of
  the graph — d3's charge (repulsion) force has no distance cutoff by default, so with no
  link force to hold it and only weak x/y gravity to pull it back, an orphan's equilibrium
  distance from the cluster was unbounded. Capped `charge.distanceMax(260)` so gravity always
  wins past that range, and gave zero-degree nodes stronger gravity (0.55 vs 0.22) so they
  settle near the cluster edge instead of drifting off on their own.
- Brain Map hover: still intermittently missed nodes after the redraw-loop fix below,
  especially right after the graph loads/rebuilds (while the force simulation is settling)
  or right after a pan/zoom. Root cause was in the vendored `force-graph` library, not our
  code: the invisible hit-test ("shadow") canvas that backs hover detection is repainted via
  a hardcoded 800ms throttle, decoupled from the visible canvas's own render loop — so while
  node screen positions are actively changing, the hit-test canvas can lag up to 0.8s behind
  what's on screen, and a cursor sitting exactly on a node samples a stale pixel. Patched the
  throttle down to 50ms via `patch-package` (`web/patches/force-graph+1.51.4.patch`); the
  Dockerfile's `deps` stage now also copies `patches/` before `npm ci` so the patch actually
  lands in the built image. Also gave the department legend `pointer-events-none` on its
  wrapper (buttons opt back in individually) — nodes the layout parks underneath it after
  panning were previously unhoverable for good, since the legend div ate the pointer events.
- Brain Map hover: most nodes wouldn't respond to hover ("only 1–2 nodes work"). The
  force-graph render loop paused once the graph settled, so hover only re-evaluated on the
  occasional redraw and a moving cursor skipped nodes. Keep the loop live
  (`autoPauseRedraw={false}`) and give the pointer hit-area a ~10px screen-space floor so
  every node — including small, low-degree ones — is reliably hoverable at any zoom. The
  hovered node now also shows a violet ring and enlarges slightly, so it's obvious which node
  you're on — especially for hubs, whose many neighbors otherwise stay lit.
- Added the indexes retrieval and ingest were missing: `chunks(document_id, ordinal)` (neighbour
  expansion issued one unindexed scan per result, and re-ingest's DELETE and the documents cascade
  scanned too), `citations(message_id|chunk_id|document_id)`, `document_groups(group_id)`,
  `group_members(workspace_id, user_id)` and `query_log(workspace_id, created_at DESC)`. Dropped
  `chunks_workspace_idx`: selectivity 1.0 on a single-tenant deployment, so the planner never chose
  it while every insert paid for it. `engine/tests/test_indexes.py` asserts via `EXPLAIN` that each
  index is applicable to the query it exists for.

### Added
- Brain Map **interactive focus + category filter**: the legend is now a filter — click a
  department to isolate its nodes (the rest dim, the chip gets a pill, a "Showing X" hint
  appears). Hovering or selecting a node lights it and its connected neighbors while dimming
  everything else, and shows a tooltip ("‹document› · N connections · ‹department›") glued to
  the node. A single click on a node opens it in Sources.
- Chat history backend: per-user, multi-conversation Ask threads. `chats` gained
  `updatedAt`; `web/lib/chat.ts` now exposes `listChats` (with optional title/message
  search), `createChat`, `chatOwned`, `getChatMessages`, `renameChat`, `deleteChat`, all
  scoped to `(workspaceId, userId)` so a user can only ever see/touch their own chats.
  New routes `GET/POST /api/chats` and `GET/PATCH/DELETE /api/chats/[id]`.
  `POST /api/ask` now takes `{question, chatId?}`, verifies ownership of an existing
  chat or starts a new one, and returns `{message, chatId, title}`. Engine gained
  `POST /title` (`engine/app/ask/title.py::generate_title`) for a smart 3-6 word LLM
  chat title on the first turn, with a deterministic truncation fallback (fake
  providers, or on any engine error) so title generation never blocks a turn.
- Chat history frontend: the Ask page is now a Claude.ai-style two-pane workspace.
  `web/app/(app)/dashboard/AskWorkspace.tsx` owns `selectedChatId` and renders a new
  `Conversations.tsx` sidebar (new-chat button, debounced search, newest-first list,
  inline rename, delete with reselect-newest-or-empty) beside the rewritten `AskChat.tsx`
  (now driven by `{csrf, chatId, onFirstMessage}` props instead of a single fixed
  thread). The sidebar collapses under a slide-over toggle on mobile.
- Brain Map **Obsidian-style document graph** — a document-level knowledge map where each
  node is a document colored by its department (access group), connected by embedding
  **similarity edges** (`GET /api/graph/documents`, backed by a kNN over doc vectors with
  `graph_edge_threshold` / `graph_edge_topk` settings). Tuned d3-force layout (charge +
  x/y gravity + collision) fills the canvas and keeps low-degree docs gathered; a
  **search** box dims everything but filename matches; hovering a node focuses it and its
  neighbors; labels fade in by zoom / hover / hub degree; a **department legend** keys the
  colors. Governance lens toggles recolor nodes over the department palette (e.g. Exposure
  turns the two over-shared docs hot-orange). Clicking a node deep-links to its Sources
  group editor. (Requires `d3-force` as a direct web dependency.)
- Brain Map — owner-only permission-aware governance graph (topic clusters → documents)
  with permission-anomaly / over-exposure / orphan / dead-stale lenses, view-as-group
  audit, and deep-link fixes.
- Brain Map owner page (`web/app/(app)/dashboard/brain-map/`): a 2D topic map rendered
  with `react-force-graph-2d` (dynamically imported with `ssr: false` — the renderer
  touches `window`/`document` at import time), nodes pinned at their stored PCA layout
  and sized by document count, a **Rebuild map** action that polls `/api/graph` off the
  freshly-fetched job status (not a stale closure) until the job leaves `running`, an "as
  of &lt;time&gt;" freshness label, and a **View as** group selector reusing the owner-only
  `getOwner()`/`as_group` plumbing. Clicking a topic drills into that topic's documents
  via `GET /api/graph/topic/[id]` (force-simulated, since only topics carry a stored PCA
  layout); a toolbar of **lens toggles** (Anomaly / Exposure / Orphan / Dead-Stale) colors
  the drilled-in document nodes by the selected governance lens — anomaly and dead/stale
  from findings matched by document id, exposure from the document's exposure score,
  orphan from its orphan flag — and filters the Findings sidebar to the same lens. A
  `Findings` sidebar groups permission-anomaly / over-exposure / orphan / dead / stale
  findings by kind with a **Fix** link to `/dashboard/sources?doc=<id>` and a **Dismiss**
  action, both CSRF-guarded.
- Brain Map web API routes: `GET /api/graph`, `GET /api/graph/topic/[id]`,
  `GET /api/graph/findings`, `POST /api/graph/rebuild`, `POST /api/graph/findings/[id]/dismiss`.
  All owner-gated via new `web/lib/auth/require-owner.ts::getOwner()` (reads role from the
  `memberships` table — the graph is an owner-only governance surface; the owner always
  queries the engine as role `'owner'`, `as_group` drives the "view as" filter). Mutating
  routes also require a valid CSRF token.
- Brain Map engine build/read logic (`engine/app/graph/*`), persisted to five new
  Drizzle-defined tables — `graph_build_jobs`, `graph_topics`, `graph_topic_members`,
  `graph_doc_meta`, `graph_findings`. `build_graph` runs a CPU-only, deterministic
  pipeline — mean-embed each document's chunks → KMeans cluster → TF-IDF keywords per
  cluster → LLM label (or a keyword fallback when `use_real_models()` is false) → PCA
  layout — then computes the four governance lenses (permission-anomaly via per-cluster
  consensus Jaccard, over-exposure via an exposure-score threshold, orphan via low
  max-cosine-similarity, dead/stale via never-retrieved or document age) and persists
  everything inside one connection; a
  `graph_build_jobs` row tracks running/done/failed with `started_at`/`finished_at`/
  `error` so the UI can poll. `get_graph`/`get_topic`/`list_findings`/`dismiss_finding`
  are permission-filtered reads via a new `_visible` helper: the owner sees the whole
  workspace, and a simulated `as_group` sees documents tagged with that group **or** the
  workspace's default Everyone group — matching `engine/app/access.py::resolve_access`
  (a real member sees their groups plus Everyone), not the named group alone. Topic
  labeling reuses a new `engine/app/ask/answer.py::get_chat_call()` seam (extracted from
  `_llm_answer`'s Bearer/httpx call, `None` when `use_real_models()` is false) so the
  fake-provider path stays GPU-free.
- Engine connection **pool** (`psycopg-pool`) replaces connect-per-call across ask, ingest, and the bot worker. `/health` now reports `embed_dim` and an `embed_dim_ok` drift check (the DB's `vector(N)` column is the source of truth for embedding width).
- Brand logo — the "layered vault" mark (nested walls + violet `#684BFF` core).
  `public/logo.svg` (exact mark) in both apps, plus a theme-adaptive `app/icon.svg`
  favicon whose walls flip to paper on dark browser chrome so the mark never disappears.
  A teal `#0f8a7e` variant lives at `web/public/logo-teal.svg`.
- `marketing/` as a standalone Next app — the public site is now a separate deployable
  that never ships to a customer datacenter.
- Project `CLAUDE.md` and this `CHANGELOG.md`.
- Re-architecture spec: draw the service boundary on domain (knowledge vs auth), not
  language — `docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.
- Brain Map **document-level graph** (`GET /graph/documents` in the engine, `GET
  /api/graph/documents` in web, `web/lib/graph.ts::getDocumentGraph`): an Obsidian-style
  view with every visible document as a node — `department` (its first non-default
  group, alphabetically, else "Everyone"), `exposure_score`/`is_orphan` from
  `graph_doc_meta`, `degree` — connected by undirected cosine-similarity kNN edges over
  the same mean chunk vectors the topic clustering uses (`graph_edge_topk=5` neighbors,
  `graph_edge_threshold=0.35` minimum cosine, both new `Settings` fields). Reuses
  `store.load_docs`/`service._visible` for permission filtering and a new
  `store.group_names` helper for department resolution.

### Changed
- Brain Map node sizing and hub-label threshold are now **relative to the current dataset**
  instead of fixed constants that needed re-tuning by hand every time the document count
  changed (went stale immediately after adding 72 demo documents — see below). A node's
  radius now maps its degree onto `[MIN_RADIUS, MAX_RADIUS]` normalized against the graph's
  own max degree (the single most-connected doc is always `MAX_RADIUS`, a disconnected one
  always `MIN_RADIUS`), then the whole range scales down as the document count grows past
  `REFERENCE_NODE_COUNT` (36 — the size it was last eyeballed at) so a bigger library doesn't
  render as bigger overlapping dots. The "hub" label threshold works the same way: instead of
  a fixed `degree >= 9`, it picks whatever degree keeps roughly the top 15% of nodes as hubs,
  clamped to an absolute 3–12 so a much larger library never buries the map in bold labels.
- Brain Map node sizing/glow, tuned closer to the 42Wiki reference after a closer look at
  it: nodes are ~25% smaller across the board (`radius(degree) = 2.4 + sqrt(degree)*1.25`,
  was `3.4 + sqrt(degree)*1.7`), and the soft focus-glow now only renders while something is
  actually hovered/searched/filtered — at rest the reference is flat, unglowed dots, and
  drawing a permanent glow on all ~36 nodes (the previous behavior) is what made nearby hubs
  blob into each other. Hub label size trimmed to match (13px/10px, was 15px/11px).
- Brain Map visual language, reshaped after the 42Wiki knowledge-map reference
  (wiki.42.uz/map), kept on our existing warm-paper light theme rather than its dark one.
  Unfocused nodes now recede to a single neutral tone (`MUTED`) instead of a faded version
  of their own department color, so whatever IS focused is the only color on screen — the
  clearest signal of "what's related" the map has had. High-degree hub documents render as
  bold, department-colored floating titles (a wordmark over the cluster they anchor) instead
  of plain node captions; regular labels get a paper-colored outline stroke instead of a
  rectangle halo, so they float over the edge mesh without boxing themselves in. The
  department legend lost its bordered card in favor of a soft radial wash, gained a glow on
  each swatch dot, and a `36 documents · 96 connections · 6 departments` / "Hover to focus ·
  click to open" stats-and-hint line now sits opposite it. Added floating +/−/fit zoom
  controls (top-right) as a discoverable alternative to wheel/pinch, and the search input is
  now a pill instead of a rectangle.
- **Web is now a BFF** (Step 2). `web/lib/{documents,groups,source,telegram}.ts` and the knowledge API routes call engine endpoints instead of Drizzle; the engine owns all knowledge-table access (new `engine/app/library/*`, `access.py`, and /documents, /source, /groups, /telegram endpoints). One Postgres kept by decision (no physical DB split); web keeps the auth tables + chat transcript and still defines the schema.
- **One ask path** for every surface. New engine `ask/service.py::answer_query` does retrieval → answer → audit-log; the web `/ask` endpoint and the Telegram handler both call it. The engine now owns the `query_log` write (web passes the principal `user_id` and no longer logs it itself); Telegram stops re-implementing the pipeline.
- Brand accent switched from teal to **electric violet**. `--brain` → `#684bff`,
  `--brain-text` → `#5636d6` (WCAG-recomputed: 4.49–4.90 UI, 5.57+ AA text). Propagated
  across both apps' `tokens.css`, the OG image, and the swarm palette fallback; Tailwind
  `brain` classes and the runtime swarm pick it up from the token automatically.
- Retrieval is now a **hybrid pipeline**: dense (pgvector) + Postgres full-text (GIN), fused
  with **reciprocal rank fusion**, per-document capped, **reranked** (LLM by default, or a
  self-hosted cross-encoder via `RERANK_BASE_URL`), then **neighbor-expanded** (adjacent
  chunks added to the answer context; citations still resolve to the matched span). Chunks are
  embedded with a **contextual header** (`CONTEXTUAL_MODE`). Both retrievers share one
  permission predicate. Adapted from Cerebras's knowledge-base architecture — Postgres-only,
  no Qdrant.
- Chunking is now **300 words per chunk with 50 words of overlap** (was 120/20). Params
  renamed to `target_words` / `overlap_words` since they count whitespace words, not tokens.
- Default model provider is now **OpenAI's API** — LLM `gpt-5.4-nano-2026-03-17`,
  embeddings `text-embedding-3-small` at 1024 dims (via the `dimensions` param). Added an
  `OPENAI_API_KEY` (Bearer) setting. The deterministic fake providers now gate on
  credentials, so tests and offline dev still fall back to them. On-prem deployments
  override `MODELS_BASE_URL` with a self-hosted endpoint so nothing leaves their network.
- Slimmed `web/` to the product only: new minimal root layout, product-scoped `globals.css`.
- Trimmed the root README to essentials.
- Renamed the design-reference folder `CompBrain Company Website/` → `reference/`.

### Removed
- Marketing code (routes, components, `lib/swarm`, `content`, hooks, SEO shell) from `web/`.
- Unused `web/` deps: `clsx`, `lenis`, `tailwind-merge`.
- Marketing's dynamic `app/icon.tsx` (replaced by the static `icon.svg`).

### Fixed
- Oversized uploads are rejected from the declared `Content-Length` before `req.formData()` buffers
  the whole body into memory, and now answer `413` rather than `400`. The authoritative post-parse
  `file.size` check remains, since `Content-Length` can lie.
- Brain Map: the over-exposure lens now actually produces findings. `build_graph`
  previously computed `exposure_score` only for the map's heat coloring; a new
  `engine/app/graph/lenses.py::over_exposure_findings()` flags docs at/above a new
  `graph_overexposed_threshold` setting (default `0.5`) as `over_exposure` findings, so
  the Findings sidebar's "Over-exposed" group and the map's Exposure lens filter are no
  longer always empty.
- Brain Map: closed a rebuild-poll race where `POST /graph/rebuild` returned before the
  backgrounded `build_graph`'s own `start_job` ran, so the client's first poll could see
  the *previous* job (or null on a first-ever build) and stop polling while the rebuild
  was still running. `graph_rebuild` now starts the job row synchronously and passes its
  id into `build_graph(ws, job_id)`, which reuses it instead of starting a second one.
- Brain Map: the topic map rendered blank on load. Topic nodes are pinned at PCA-scaled
  coordinates (`fx: t.x * 400, fy: t.y * 400`) that the default `react-force-graph-2d`
  camera (centered at the origin, zoom 1) never framed, so the canvas looked empty until
  the user manually scroll-zoomed out. `BrainMap.tsx` now holds a ref to the graph
  instance and calls `zoomToFit(400, 80)` from both `onEngineStop` (covers the
  drill-down's force-simulated doc nodes, which do cool) and a `setTimeout`-guarded
  effect keyed on the current node set + `topic` (covers the pinned topic-overview nodes,
  which never fire `onEngineStop` since they never simulate) — so the camera reframes on
  initial load, after a rebuild, on drill-in, and on returning to the overview. Also added
  always-on node labels (`nodeCanvasObjectMode`/`nodeCanvasObject` drawing `node.name`
  under each node in `--ink`) so the map is readable without hovering.
- Brain Map: the findings sidebar's permission-anomaly explanation printed raw group
  UUIDs (from the engine's `detail.consensus`/`detail.doc_groups`) instead of names.
  `BrainMap.tsx` now builds an id→name `Map` from the `groups` it already loads for the
  "View as" selector and passes it to `Findings.tsx`, which resolves both id arrays to
  comma-joined group names (falling back to "a group" for an unknown id, never a raw
  UUID) in a clearer sentence, e.g. "Shared with Everyone — broader than Finance, which
  the rest of this topic shares."
