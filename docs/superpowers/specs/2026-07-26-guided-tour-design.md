# Guided tour overlay — design

**Date:** 2026-07-26
**Status:** Approved (decisions locked). Awaiting spec review before planning.
**Research:** 8-agent sweep (2026-07-26) across library licensing, onboarding UX evidence, tour IA,
accessibility, overlay mechanics, state/i18n, and enterprise on-prem practice.

**Locked decisions:** react-joyride in controlled mode with a fully custom card · **no dimming
scrim** · 5-step owner tour, 3-step member tour · upload happens **inside** the card · translation
layer built first · the static `GetStarted` panel and `ProgressStrip` are deleted.

## 1. Why this replaces what shipped last week

The first-run flow built previously **replaces** the Ask pane with a static panel listing three
steps. The founder rejected it: *"it shows in one static part it wrote down the instruction but i do
not want it."* What is wanted is two layers — the real dashboard underneath, unchanged, and a
guidance layer above it with cards, a Next button, and the file upload happening in the card rather
than by sending the user somewhere else.

That is a coach-mark tour. The previous design explicitly listed coach-mark overlays as a non-goal;
that call was wrong for this product's intent and is reversed here.

## 2. Library: react-joyride 3.2.0

MIT (`Copyright (c) 2015, Gil Barbara`), `peerDependencies` react `16.8 - 19`, 25.6 kB gzipped,
last published 2026-07-09, zero open accessibility issues, no runtime network calls.

Chosen because `content` is typed `ReactNode` and `tooltipComponent` replaces the whole card — the
only mainstream option where a **live upload widget can live inside a step**, which is the
founder's non-negotiable. `target` also accepts a React ref, so a renamed target is a TypeScript
error at build time rather than a silently skipped step in production.

**Rejected, with reasons that matter:**

| Option | Why not |
|---|---|
| **Shepherd.js** | Relicensed MIT → **AGPL-3.0 at v14.0.1** (2024-10-10). Its LICENSE demands payment for "internal tools, dashboards, or admin panels in a revenue-generating company. Even if the tool is not customer-facing." GitHub reports SPDX `NOASSERTION`, so scanners stay silent. Pinning to 13.0.3 to dodge it is itself an audit finding. |
| **intro.js** | AGPL-3.0 plus a required commercial licence. AGPL §13 reaches software a bank runs as an internal service. |
| **Onborda** | `package.json` says MIT but the repo has **no LICENSE file** and the npm tarball ships none — MIT's copyright-notice clause is unsatisfiable. Also 19 months stale. |
| **@reactour/tour** | MIT and small, but no release in ~14 months, 82 open issues, wildcard internal deps (`"@reactour/mask":"*"`) that break reproducible air-gapped builds, and **zero focus management** in the shipped bundle. |
| **nextstepjs** | MIT, good route ergonomics, but requires `motion >= 11` — a whole new dependency category for something needed once. |
| **driver.js** | The honest runner-up: MIT, 8.2 kB, zero deps. Rejected because content is HTML strings (XSS sink once a filename is interpolated), its popover has no `tabindex` so step text may never be announced, and WCAG issues #434/#495 have been open since 2023. Switch target if transitive-dep count ever becomes a procurement blocker. |
| **Every hosted tour SaaS** | Appcues, Pendo, Userpilot, Userflow, Chameleon, Intercom, WalkMe, Whatfix — their product *is* a remote script. Incompatible with air-gap. Stated once, not revisited. |

**Joyride defaults that must be overridden on day one**, because they are wrong for this use:
`tooltipProps` carries `role="alertdialog"` + `aria-modal="true"`, which confines a screen reader's
virtual cursor to the card — hiding the exact element the step points at. `overlayClickAction`
defaults to `'close'`, so one stray click kills first-run. `width: 380` breaks 320 CSS px reflow at
400% zoom. No tour library ships a `prefers-reduced-motion` guard.

## 3. No dimming scrim

`disableOverlay: true`. The dashboard stays fully visible and clickable; the active target gets an
ink + violet ring drawn from a `data-tour-active` attribute.

This is both what was asked for and the only choice without a contrast failure: a 0.3–0.5 black veil
drops `--ink-soft` body text to **2.99–4.16:1** on `--paper`, failing WCAG 1.4.3. Clicking a real
control mid-tour advances the tour rather than being blocked — the one controlled experiment on this
(Andersen et al., CHI 2012, 45,000+ users across three products) found blocking coach marks helped
in **zero** of them.

## 4. The tour

### Owner — 5 steps, one conditional, one route change

Every anchor is durable chrome. No step points at a folder card, chat thread, document row or Atlas node.

1. **`welcome-v1`** — anchors the Ask pane. *"This is your company's memory."* Explains the loop and
   that nothing leaves the server. Buttons: `Show me around` / `Not now`.
2. **`upload-v1`** — anchors the **Sources** rail link. **A real dropzone and file picker render
   inside the card**, driven by a `useDocumentUpload(csrf)` hook extracted from `Sources.tsx`, with a
   live "3 files received · 1 indexed" line polling `/api/documents`. **Advance on HTTP 201, never on
   indexing completion** — ingestion can run for minutes and joyride's `before` hook is capped at
   5000 ms, so gating on it would time out and strand the user at a spinner.
3. **`organise-v1`** *(conditional — only when unfiled documents exist)* — `before` navigates to
   `/dashboard/sources`; anchors the real **Organise with AI** button. That button only renders when
   `unfiledCount > 0`, so a fixed step list would point at nothing.
4. **`access-v1`** — returns to `/dashboard`; anchors the **Access** rail link. *"People only get
   answers from what they may read."* **This sentence must also live permanently on the Access page** —
   the access model must never exist only inside a tour card.
5. **`ask-v1`** — anchors the composer, and renders a **static replica** of a citation chip
   (`[1] hr-policy.pdf · p.4 ↗`). A replica because real citation buttons do not exist until an
   answer arrives.

### Member — 3 steps

`welcome-v1`, `access-member-v1` (*"You'll only ever see answers built from documents your groups can
open."*), `ask-v1`. No upload, no organise. `memberships.role` already exists.

### Deliberately not tour steps

- **Citations** → a single just-in-time coach mark the first time an answer with ≥1 citation renders,
  recorded as `citation-hint-v1`. Taught at the moment it happens, not narrated 90 seconds earlier.
- **Atlas** → owner-only, empty until a corpus exists, and `react-force-graph-2d` paints to one
  `<canvas>` so no selector can ever resolve a node. Gets a real empty state instead.
- **Telegram** → a configuration task done once, weeks later. Belongs on its own page.
- **The static panel** → `GetStarted.tsx`'s `workspaceEmpty` branch and `ProgressStrip.tsx` are
  **deleted**. The starter-suggestions branch stays; that is a useful empty state, not a tutorial.

## 5. Interaction rules

- Explicit `Next` / `Back` buttons plus a `Step 2 of 4` mono caption. Steps 2 and 3 also advance on
  the real action.
- **Escape always ends the tour**, from every step, no confirmation. A tour that traps Tab without an
  exit is a WCAG 2.1.2 **Level A** failure (EN 301 549 clause 9.2.1.2).
- `overlayClickAction: false` explicitly, so re-enabling an overlay later cannot reintroduce the
  one-stray-click-kills-onboarding bug.
- **Auto-start only when** there are no `user_tour_steps` rows, `tourDismissedAt` is null, the landing
  path is exactly `/dashboard`, and no upload is in flight. Otherwise degrade to a quiet
  *"Take the tour"* pill. Never auto-start an existing user after a deploy that adds steps.
- **No stored step cursor.** Resume = the first step whose key is not in `user_tour_steps`.
- **Replay** via a permanent **Guide** item in the rail's bottom cluster — the only element present on
  every dashboard route. Replay does not clear rows. This also serves the bank's fifth employee, who
  is onboarded in month four and never sees a first-run flow.
- Never drive `stepIndex` from a `useEffect` watching app state — joyride's docs say "Don't", because
  external updates not originating from `onEvent` desynchronise its lifecycle.

## 6. State

```sql
user_tour_steps (user_id, workspace_id, step_key, seen_at, PRIMARY KEY(user_id, workspace_id, step_key))
users.tour_dismissed_at  timestamptz
users.locale             text          -- 'en' | 'ru' | 'uz'
```

**Server-side, never localStorage.** localStorage is per-origin, not per-user: on a shared
bank-branch or hospital-ward workstation the second employee inherits the first's "completed" flag
and is never onboarded, and a corporate clear-browsing-data policy silently resets everyone.

**Step keys are append-only strings, never renamed or reused** — GitLab's `user_callouts`
discipline, whose enum has permanent gaps where callouts were retired. What to show is a set
difference: `defined_steps_for_role − seen_steps`. A user who completed the old tour and meets a new
step is offered exactly that step behind a pill, not the whole tour again. Reworking what a step
*means* mints a new key; a copy-edit reuses it.

Status is derived, never stored, matching `lib/onboarding.ts`'s existing philosophy. `deriveOnboarding`
stays as-is and feeds the auto-start gate and step 3's condition — the two answer different questions
and must not be merged.

**Aggregates only, owner-visible only:** completion rate, drop-off histogram by step, breakdown by
locale. Never a per-named-employee table, never dwell times. GDPR Art. 5(1)(c) data minimisation and
Art. 88(2) workplace-monitoring safeguards; a per-employee record of how long someone spent reading
instructions is what a works council challenges. **Zero egress** — rows stay in the customer's
Postgres and are never aggregated back. A workspace-level `tour_enabled` switch lets a customer
disable the layer on change-control grounds.

## 7. Accessibility

`role="dialog"` + `aria-labelledby` + `aria-describedby`, **no `aria-modal`**, `tabIndex={-1}` on the
card with focus moved there per step, **no focus trap** (the upload step contains a file input and a
trap would fight it), no `aria-live`. Escape from every step. Ring contrast checked against
`--paper`. `prefers-reduced-motion` honoured. Verified at 400% zoom (320 CSS px) in all three
locales, and with NVDA + Chrome and JAWS + Chrome on Windows.

Target: a WCAG 2.1 AA conformance note. **Do not claim EAA conformance** without a documented
assessment.

## 8. Internationalisation

Built first, deliberately: writing the tour inline in English hardens a monolingual pattern into the
newest feature and every string has to be dug back out later.

`web/lib/i18n/{index,en,ru,uz}.ts`, `type Locale = 'en'|'ru'|'uz'`, dictionary behind `server-only`,
tour copy keyed by `step_key`. Cards use fluid `max-width`, never a fixed 380 px — **Russian runs
15–30% longer than English** and expands worst on short strings. A vitest rejects U+0027 in the
Uzbek dictionary (real Uzbek Latin uses U+02BB/U+02BC — the same bug already present in
`engine/app/ask/qtype.py`). Verify the display serif covers those glyphs before commissioning
translations.

## 9. Kill criterion, agreed in advance

If fewer than ~40% of first-run owners reach step 5, or the first-upload rate does not move, cut to
steps 1–2 and move everything else into empty states. Every published tour benchmark is cloud
self-serve SaaS; there is no data on air-gapped enterprise onboarding, and the widely-quoted vendor
figures contradict each other. This instance's own numbers are the only trustworthy ones, and they
cost one table.

## 10. Success criteria

1. The dashboard is never replaced by instructions; it stays visible and clickable throughout.
2. A new owner can upload documents **without leaving the guidance card**.
3. Escape ends the tour from every step; the whole flow is keyboard-only completable.
4. A returning user resumes at the first unseen step, on any device.
5. A second user on a shared workstation gets their own tour.
6. No step targets a node that may not exist; no step breaks on an empty workspace.
7. Zero outbound network calls added.
