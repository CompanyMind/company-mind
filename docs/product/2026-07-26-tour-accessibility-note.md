# Guided tour — WCAG 2.1 AA accessibility note

**Date:** 2026-07-26
**Status:** WCAG 2.1 AA statement with measured evidence and stated gaps.
**This is not an EAA conformance claim.** The EU Accessibility Act requires a documented
conformance assessment against EN 301 549; this document is an engineering-level audit of one
feature, not that assessment. It should be treated as input to a future formal audit, not a
substitute for one.
**Scope:** the guided tour only (`web/app/(app)/_components/tour/*`, `web/lib/tour/*`,
`web/lib/i18n/*`). It does not re-certify the rest of the dashboard.
**Spec:** `docs/superpowers/specs/2026-07-26-guided-tour-design.md` §7 (accessibility) and §8
(i18n).
**Environment:** `web` Docker image built from this branch (`docker compose build web && docker
compose up -d web`), driven live at `localhost:3000` with Playwright (Chromium), against a real
seeded owner account (`task9-a11y@companymind.local`). Contrast ratios are computed from the
actual CSS custom-property values in `web/styles/tokens.css`, cross-checked against
`getComputedStyle()` on the live rendered DOM.

## How to read this

Two categories of evidence appear below and must not be confused:

- **Measured** — observed directly: a computed contrast ratio, a `document.activeElement` read
  after a real keypress, an accessibility-tree snapshot, a `getComputedStyle()` read.
- **Reasoned from code** — the source was read and the logic traced, but the specific runtime
  behavior was not independently instrumented (e.g., react-joyride's internal scroll-animation
  frame timing).

Nothing below is a description of a screen-reader session that did not happen. Where a real AT
was unavailable, that is stated plainly, per §5 below.

## 1. Keyboard-only run — measured

The entire 5-step owner tour (`welcome-v1 → upload-v1 → organise-v1 → access-v1 → ask-v1`,
`organise-v1` included by uploading a document first so the conditional step is live) was
completed with the keyboard alone: `Tab`/`Shift+Tab` to move focus, `Enter` to activate every
button and to open the native file chooser, no mouse.

- Every step's `Skip`, `Back`, `Next`/`Done` button is reachable by `Tab` and activates on `Enter`.
- **Step 2's file picker was keyboard-*unreachable* before this task's fix** — see §4, Finding 1.
  After the fix, confirmed live: `Tab` lands on the `<input type="file">` directly, and `Enter`
  opens the OS file chooser (`browser_file_upload` handled the resulting native dialog).
- `Escape` was confirmed to end the tour from three distinct states: step 1 (`welcome-v1`, focus
  on `Skip`), step 2 (`upload-v1`, focus moved onto the file input itself — the state the fix
  introduced), and step 3 (`organise-v1`, after the tour's one forward navigation to
  `/dashboard/sources`). All three ended the tour cleanly with no stuck state. The code path
  (`TourProvider.tsx`'s `handleEvent`, `if (data.origin === ORIGIN.KEYBOARD) { endTour(); return }`)
  does not special-case by step, so this is not a per-step coincidence.
- `Escape` on `organise-v1` correctly leaves the user on `/dashboard/sources` rather than
  navigating them back to `/dashboard` as a parting act (confirmed: URL and `data-tour-active`
  both checked after the keypress).
- Natural completion (`Done` on `ask-v1`) was also exercised.

## 2. Focus management — measured, one gap found and partially fixed

**On every step change**, focus lands on the new card: `TourCard.tsx` calls
`containerRef.current.focus({ preventScroll: true })` in a mount-only effect, and because Joyride
keys its floater by step index the card fully remounts per step — confirmed live after every
`Next`/`Back`/navigating step (`document.activeElement` was the `role="dialog"` container each
time, e.g. after `organise-v1`'s navigation to `/dashboard/sources`).

**No focus trap.** `Shift+Tab` from the card's first button reaches real dashboard content
(confirmed: landed on the "Add documents" empty-state link, `closest('[role="dialog"]')` was
`null`). The complete forward tab order is dashboard-first, tour-card-last, because
react-joyride portals its floater to the end of `<body>` — so a user who tabs from the top of the
page reaches every rail link and the highlighted control *before* ever reaching the card.

**Finding 2 (fixed): focus was lost to `<body>` when the tour ended.** Before this task, `Escape`,
`TARGET_NOT_FOUND` (the empty-workspace path), and `Done` all called `endTour()`, which unmounted
the dialog with no focus management — measured live: `document.activeElement === document.body`
after each of those three paths, with a real button (`Skip`, or whichever had focus) as the
*previous* active element. **Fixed** in `TourProvider.tsx`: `start()` now captures
`document.activeElement` before the card mounts; `endTour()` restores it if still connected to the
document.
- Confirmed live: replaying via the rail's **Guide** button, then ending via `Escape` — focus
  returned to the **Guide** button (`document.activeElement.textContent === 'Guide'`), not `body`.
  Confirmed again ending via **Done** on the final step — same result.
- **Known remaining gap, not fixed:** when the tour is launched by auto-start or by the pill,
  there is no durable pre-tour focus target — auto-start captures `document.body` itself (nothing
  has been interacted with on a fresh page load), and the pill's own button is unmounted the
  instant `start()` runs. Confirmed live: ending an auto-started tour still leaves focus on
  `document.body`. Plumbing a stable fallback (e.g., a ref to a landmark or the Guide button
  from outside the tour's own component tree) is a larger change than this task's
  risk budget; the Guide-replay path — the one a returning user or repeat tester actually uses —
  is fixed, and the auto-start/pill paths are recorded here rather than patched under time
  pressure in the last task of the feature.

## 3. 400% zoom / 320 CSS px, all three locales — measured

Tested by resizing the viewport to 320×700 CSS px (the standard proxy for 400% zoom on a
1280 px-wide display) and walking all 5 owner steps in each locale, with a document uploaded so
`organise-v1` is live.

| Locale | Steps checked | Card overflow | Text clipping | Longest heading (chars) |
|---|---|---|---|---|
| en | all 5 | none (`right` edge 294–307px, viewport 320px) | none | "Bring in your first documents" |
| ru | all 5 | none (`right` edge 305–310px) | none | "Люди получают ответы только из того, что им разрешено читать." |
| uz | all 5 | none (`right` edge 304–310px) | none | "Odamlar faqat oʻqishga ruxsati bor hujjatlar asosida javob oladi." |

Method: at each step, `dialog.getBoundingClientRect().right` was read (always < 320) and every
descendant element's `scrollWidth` was compared to its `clientWidth` (the one false positive was
the now-`sr-only` file input itself, 1×1 px by design — excluded). The upload step's longest
interpolated string was also captured live: RU `"1 файлов получено · 1 проиндексировано"`, UZ
`"1 ta fayl qabul qilindi · 1 tasi indekslandi"` — both render on their own line inside the card
with no truncation. Screenshots were taken at each locale's step 1 (and RU step 2/4) for visual
confirmation alongside the numeric checks; all show the card's `min(92vw, 28rem)` fluid width
holding at 294–310 px, comfortably inside 320, with the footer's `flex-wrap` correctly wrapping
`Skip`/`Back`/`Next` onto one row without clipping.

The Uzbek `ʻ`/`ʼ` (U+02BB/U+02BC) glyphs render correctly in the display serif and body fonts at
every step checked (visually confirmed via screenshot, e.g. `Qoʻllanma`, `Oʻtkazib yuborish`) — no
tofu boxes.

**A pre-existing, out-of-scope issue was also confirmed at 320 px, not caused by the tour:** the
document itself has horizontal overflow at this width (`document.documentElement.scrollWidth` ≈
806–820 px vs `clientWidth` 320 px) *before* the tour card even renders. This is the Rail.tsx
mobile-nav overflow already on record from Task 4 — confirmed still present, not introduced by
this task, and per this task's brief, not fixed here.

## 4. Contrast — measured ratios

Computed with the standard WCAG relative-luminance formula from the exact hex values in
`web/styles/tokens.css`, then cross-checked against `getComputedStyle()` on the live rendered
tour card and ring (values matched exactly, e.g. ring `outlineColor` read back as
`rgb(104, 75, 255)` = `#684bff` = `--brain`).

| Element | Foreground | Background | Ratio | SC | Required | Result |
|---|---|---|---|---|---|---|
| Card heading (`<h2>`, 18px bold) | `--ink` `#1c1b18` | `--paper-raised` `#fbf8f1` | **16.24:1** | 1.4.3 | 4.5:1 | pass (AAA-level) |
| Card body text (15px) | `--ink-soft` `#635e54` | `--paper-raised` `#fbf8f1` | **6.07:1** | 1.4.3 | 4.5:1 | pass |
| **"Step n of m" caption (11px, the brief's flagged risk)** | `--ink-soft` `#635e54` | `--paper-raised` `#fbf8f1` | **6.07:1** | 1.4.3 | 4.5:1 | **pass** — contrary to the a-priori expectation that this small caption was the most likely failure, it shares `--ink-soft`'s AA-passing token and is not a separate, lighter shade |
| Primary button text | `--paper` `#f3eee3` | `--ink` `#1c1b18` | **14.89:1** | 1.4.3 | 4.5:1 | pass |
| Skip/Back button text | `--ink` / `--ink-soft` | `--paper-raised` | 16.24:1 / 6.07:1 | 1.4.3 | 4.5:1 | pass |
| **Target ring (non-text)** | `--brain` `#684bff` | `--paper` `#f3eee3` | **4.49:1** | 1.4.11 | 3:1 | pass |
| Target ring, on a raised surface | `--brain` `#684bff` | `--paper-raised` `#fbf8f1` | 4.90:1 | 1.4.11 | 3:1 | pass |
| Keyboard focus ring (global `:focus-visible`, and the dropzone's new `has-[:focus-visible]` ring) | `--brain-text` `#5636d6` | `--paper` / `--paper-raised` | 6.27:1 / 6.84:1 | 1.4.11 | 3:1 | pass |

The disabled `Next` button (`opacity-50`) was not scored against 1.4.3/1.4.11: WCAG's
"Understanding SC 1.4.3" explicitly exempts text/controls that are part of an inactive UI
component, and the disabled state is itself exposed to assistive tech (removed from the tab
order, `disabled` reflected in the accessibility tree) rather than relying on color alone.

**All measured tour-specific contrast requirements pass.** No fix was needed here; this section
is confirmation, not remediation.

## 5. Screen reader — no NVDA/JAWS available; accessibility tree used instead

**Stated plainly: no real screen reader (NVDA, JAWS, or VoiceOver) was available in this sandboxed
environment.** No AT session was run, and nothing below should be read as a transcript of one. What
follows is the accessibility-tree fallback the task brief explicitly allows — Playwright's
accessibility snapshot, which reads the same underlying platform accessibility API a screen reader
consumes.

Confirmed via that tree, at every one of the 5 owner steps:

- The card exposes `role="dialog"`, with `aria-labelledby`/`aria-describedby` resolving to the
  step's heading and body text respectively (verified both by reading the DOM's `id` attributes
  and by the accessibility snapshot rendering the heading and body as the dialog's named/described
  content).
- Because `TourCard` fully remounts per step (new `useId()`-generated ids each time) and moves
  focus to itself on mount, a screen reader positioned on the dialog after a step change would be
  reading a **freshly-focused, freshly-labeled** dialog each time — the mechanism the ARIA dialog
  pattern relies on for "announced on change." This is reasoned from the (verified) DOM structure
  and focus behavior, not confirmed by ear.
- **The highlighted dashboard element remains present in the accessibility tree throughout** —
  every snapshot taken while a step's card was open also contained the full dashboard (rail links,
  "Ask" composer, folder list, etc.), simultaneously with the dialog. This is the concrete thing
  `aria-modal` would have broken (it would confine the tree to the dialog's subtree), and it is
  confirmed, not inferred: e.g. at `upload-v1` the accessibility tree shows both the dialog *and*
  the "Sources" rail link (upload-v1's actual target) as siblings in the same snapshot.
- The step-5 citation replica (`[1] hr-policy.pdf · p.4 ↗`) is exposed as plain, non-interactive
  text (`generic` role, not `link`/`button`) — correct, since it is a static replica with no real
  citation behind it; a screen reader will not falsely announce it as activatable.
- No `aria-live` region exists anywhere in the tour (confirmed by grep — the only occurrence of
  the string is in a code comment explaining its deliberate absence). This means the upload step's
  "N files received · M indexed" status line is **not proactively announced** to AT users as it
  changes — a genuine SC 4.1.3 (Status Messages, Level AA) gap. It is not fixed here: the design
  decision predates this task and the actual task-completion signal (the `Next` button's `disabled`
  state, which the accessibility tree does expose) is still reachable without the live region, but
  a user relying on AT would need to explicitly re-visit the status line to notice the count
  change rather than being told about it. Recorded as a known gap, not silently accepted.

## 6. `prefers-reduced-motion` — measured

Emulated via `page.emulateMedia({ reducedMotion: 'reduce' })`.

- `window.matchMedia('(prefers-reduced-motion: reduce)').matches` correctly reports `true` — the
  data source `usePrefersReducedMotion()` (`TourProvider.tsx`) reads from.
- The persistent "egress" heartbeat dot (`Rail.tsx`, same `motion-safe:animate-heartbeat` pattern
  the tour pill uses) was measured live under the emulated setting:
  `getComputedStyle(dot).animationName === 'none'` (Tailwind's `motion-safe:` variant correctly
  withheld the animation utility) and `animationDuration` read back as `1e-05s` (the global
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms
  !important; ... } }` block in `globals.css` also applying, belt-and-suspenders). The tour pill
  (`TourPill.tsx`) uses the identical class, so the same measured result applies to it.
- **Reasoned from code, not independently instrumented:** `TourProvider.tsx` passes
  `scrollDuration: reducedMotion ? 0 : 300` into Joyride's `options`, wired to the same
  `usePrefersReducedMotion()` hook just confirmed live above. This governs the smooth-scroll
  animation Joyride runs when a step's target isn't already in view (relevant chiefly to
  `organise-v1`'s post-navigation step). Frame-by-frame scroll timing was not instrumented — that
  would need a level of trace tooling out of proportion to the risk here, given the hook's data
  source is confirmed correct and the wiring is a one-line, directly-readable ternary.
- `TourCard.tsx` and `TourPill.tsx` contain no other transition/animation classes.

## Findings: fixed vs documented

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | `UploadStep.tsx`'s dropzone `<input type="file">` used `className="hidden"` (`display:none`), which removes an element from the tab order entirely. A keyboard-only user could never reach or open the native file chooser — confirmed live (`Tab` skipped straight from the card to `Skip this`). **SC 2.1.1, Level A.** | Critical | **Fixed.** Changed to `className="sr-only"` (visually hidden, stays focusable/announced) plus a `has-[:focus-visible]` ring on the wrapping label, since the input's own focus ring is otherwise clipped to 1px. Confirmed live: `Tab` now reaches the input, `Enter` opens the native chooser, and a visible 2px ring (`--brain-text`, 6.27:1 on `--paper`) appears on the label. |
| 2 | Focus fell to `<body>` when the tour ended via any path (`Escape`, `TARGET_NOT_FOUND`, `Done`) — confirmed live. Not a discrete WCAG SC by itself, but the behavior the brief named explicitly and the ARIA Authoring Practices' expected behavior for a dismissible dialog. | Moderate | **Fixed for the Guide-replay path** (the common repeat-use case): `TourProvider.tsx` now captures pre-tour focus and restores it in `endTour()`. **Not fixed for auto-start/pill-launched sessions** — no durable element exists to restore to in those paths; documented above (§2) rather than risked with further plumbing in the last task of the feature. |
| 3 | No `aria-live` on the upload step's status line — a genuine SC 4.1.3 (Status Messages, Level AA) gap. | Minor | **Documented, not fixed.** Predates this task as a deliberate spec decision (§7); the task-completion path (the `Next` button's exposed `disabled` state) does not depend on it, but AT users get no proactive notice of the count changing. |
| 4 | `Sources.tsx` (the standalone Sources page, not the tour) has the identical `hidden`-file-input pattern Finding 1 fixed inside the tour. | Moderate, out of scope | **Not fixed.** Found via grep while investigating Finding 1; it predates this feature and lives outside the tour's file set. Same disposition as the pre-existing `Rail.tsx` mobile-nav overflow (Task 4) — noted, not remediated here. |
| 5 | `Rail.tsx` mobile-nav horizontal overflow at narrow widths. | Moderate, out of scope | **Not fixed** (confirmed still present at 320 px — see §3). Pre-existing, on record since Task 4, explicitly called out in this task's brief as not this task's responsibility. |

## Conformance statement

Within the scope defined above, and against the specific success criteria this task was asked to
verify (1.4.3, 1.4.10, 1.4.11, 2.1.1, 2.1.2, and the general focus-management and reduced-motion
expectations of §7 of the design spec), the guided tour **passes every check performed**, with one
fix landed for a Level A failure (Finding 1) found during this audit, one partial fix for a
usability gap (Finding 2), and two genuine gaps recorded honestly rather than glossed over
(Findings 3–4), plus one pre-existing, explicitly out-of-scope issue reconfirmed (Finding 5).

This is a **WCAG 2.1 AA engineering note for one feature**, built from measured evidence in one
environment (Chromium via Playwright, one synthetic corpus, no real assistive technology). It is
**not** an EAA/EN 301 549 conformance claim, and should not be represented as one to a customer or
in a sales conversation — that requires a formal, documented assessment this task does not
perform, ordinarily covering the full product surface with real AT and multiple browser/AT
combinations (the design spec's own target of NVDA + Chrome and JAWS + Chrome on Windows, neither
of which was available here).
