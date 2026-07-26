# Guided Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-time user sees the real dashboard with a guidance card layered above it — overview, then upload happening *inside* the card, then the parts of the product explained in place.

**Architecture:** react-joyride 3.2.0 in **controlled mode** with a fully custom `tooltipComponent`, **no dimming scrim**, targets registered as typed React refs. Tour progress is an append-only seen-steps table server-side; what to show is a set difference, never a stored cursor. Copy lives in a keyed dictionary from the first line, not inline JSX.

**Tech Stack:** Next.js 16 App Router · React 19 · react-joyride 3.2.0 (MIT) · Drizzle · vitest.

**Spec:** `docs/superpowers/specs/2026-07-26-guided-tour-design.md`

## Global Constraints

- **No dimming scrim, ever.** `disableOverlay: true`. The dashboard stays visible and clickable. A 0.3–0.5 veil drops `--ink-soft` to 2.99–4.16:1 on `--paper` — a WCAG 1.4.3 failure.
- **Never spread joyride's `tooltipProps`** — they carry `role="alertdialog"` + `aria-modal="true"`, which confines a screen reader to the card and hides the element the step points at. Use `role="dialog"`, `aria-labelledby`, `aria-describedby`, **no `aria-modal`**, no focus trap.
- **Escape ends the tour from every step**, no confirmation. Trapping Tab without an exit is a WCAG 2.1.2 **Level A** failure.
- `overlayClickAction: false` set explicitly. Default `'close'` means one stray click kills first-run.
- **No fixed card width.** Fluid `max-width`; must reflow at 320 CSS px (400% zoom). Russian runs 15–30% longer than English.
- **Never drive `stepIndex` from a `useEffect`** watching app state — joyride's docs say "Don't"; external updates not from `onEvent` desynchronise its lifecycle.
- **Step keys are append-only.** Never rename, never reuse. Reworking a step's meaning mints a new key.
- **Server-side state only, never localStorage** — shared workstations would leak one user's completion to the next.
- **Zero outbound network calls.** No CDN, no telemetry, no remote fonts.
- `next build` must run with **no env and no database**; keep `web/lib/db/client.ts` and `web/lib/env.ts` lazy.
- `server-only` throws under vitest/tsx; web tests live in `web/lib/**/*.test.ts`.
- Every mutating route: auth → `verifyCsrf(req)` → work.
- Log every change in `CHANGELOG.md` under `[Unreleased]`, same commit.
- Brand is CompanyMind; infra IDs named `compbrain` stay unchanged.
- Web commands from `web/`. Host DSN: `postgres://compbrain:devpass@localhost:5432/compbrain`.

---

## File Structure

**Created:** `web/lib/i18n/{index,en,ru,uz}.ts` · `web/lib/i18n/i18n.test.ts` · `web/lib/useDocumentUpload.ts` · `web/lib/tour/targets.ts` · `web/lib/tour/steps.ts` · `web/lib/tour/steps.test.ts` · `web/lib/tour/state.ts` · `web/lib/tour/state.test.ts` · `web/app/(app)/_components/tour/TourProvider.tsx` · `.../TourCard.tsx` · `.../UploadStep.tsx` · `.../CitationHint.tsx` · `web/app/api/tour/step/route.ts`

**Modified:** `web/lib/db/schema.ts` · `web/app/(app)/layout.tsx` · `web/app/(app)/_components/Rail.tsx` · `web/app/(app)/dashboard/AskWorkspace.tsx` · `web/app/(app)/dashboard/AskChat.tsx` · `web/app/(app)/dashboard/Sources.tsx` · `web/app/(app)/dashboard/sources/FolderGrid.tsx` · `web/app/globals.css` · `CHANGELOG.md`

**Deleted:** `web/app/(app)/dashboard/ProgressStrip.tsx` · the `workspaceEmpty` branch of `GetStarted.tsx`

---

### Task 1: i18n skeleton and tour copy as data

Do this first. Writing the tour inline in English hardens a monolingual pattern into the newest feature.

**Files:** Create `web/lib/i18n/{index,en,ru,uz}.ts`, `web/lib/i18n/i18n.test.ts`; modify `web/lib/db/schema.ts`, `CHANGELOG.md`

**Interfaces:**
- Produces: `type Locale = 'en'|'ru'|'uz'`; `isLocale(x: string): x is Locale`; `getDictionary(locale: Locale): Dictionary`; `users.locale text` defaulting `'en'`.
- `Dictionary` has a `tour` object keyed by step key (`welcome`, `upload`, `organise`, `access`, `accessMember`, `ask`, `citationHint`), each `{ heading: string; body: string }`, plus `tour.ui` for `next`/`back`/`skip`/`done`/`stepOf`/`takeTour`/`guide`.

- [ ] **Step 1: Write the failing test**

`web/lib/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ru } from './ru'
import { uz } from './uz'
import { isLocale } from './index'

const dicts = { en, ru, uz }

describe('dictionaries', () => {
  it('every locale has the same keys as en', () => {
    const walk = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v ? walk(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
      )
    const base = walk(en).sort()
    for (const [name, d] of Object.entries(dicts)) {
      expect(walk(d as Record<string, unknown>).sort(), `${name} key set`).toEqual(base)
    }
  })

  // Real Uzbek Latin uses U+02BB / U+02BC, not an ASCII apostrophe. The same bug
  // already exists in engine/app/ask/qtype.py and silently breaks keyword matching.
  it('the uz dictionary never uses an ASCII apostrophe', () => {
    const offenders = JSON.stringify(uz).match(/[\w]'[\w]/g) ?? []
    expect(offenders, `use U+02BB (ʻ) instead: ${offenders.join(', ')}`).toEqual([])
  })

  it('isLocale accepts exactly the three supported locales', () => {
    expect(['en', 'ru', 'uz'].every(isLocale)).toBe(true)
    expect(isLocale('de')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `cd web && npx vitest run lib/i18n` → cannot resolve `./en`.

- [ ] **Step 3: Implement the dictionaries**

`index.ts` exports `Locale`, `isLocale`, `getDictionary`, and the `Dictionary` type inferred from `en`. `en.ts` carries the copy from the spec §4 verbatim. `ru.ts` and `uz.ts` mirror the key structure with translations; where a translation is not yet available, use the English string rather than an empty one — a missing card is worse than an untranslated one. Uzbek uses `ʻ` (U+02BB).

- [ ] **Step 4: Add `users.locale`**

In `web/lib/db/schema.ts`, inside `users`:

```ts
  // 'en' | 'ru' | 'uz'. Per-user rather than per-workspace: a bank's Russian-speaking
  // analyst and its English-speaking admin share one workspace.
  locale: text('locale').notNull().default('en'),
```

Generate and apply the migration.

- [ ] **Step 5: Verify and commit** — `npm test && npm run build`; commit `feat: i18n dictionaries and per-user locale`.

---

### Task 2: Extract the upload hook

The tour's upload step and the Sources page must share one implementation.

**Files:** Create `web/lib/useDocumentUpload.ts`; modify `web/app/(app)/dashboard/Sources.tsx`, `CHANGELOG.md`

**Interfaces:**
- Produces: `useDocumentUpload(csrf: string): { upload(files: FileList | File[]): Promise<number>; busy: boolean; error: string | null; accepted: number }` — `upload` resolves with the count of files the server accepted (HTTP 201), and `accepted` accumulates across calls.

- [ ] **Step 1: Lift the logic**

Move `Sources.tsx`'s inline `onFiles` into the hook verbatim — same endpoint, same `x-csrf-token` header, same per-file loop, same error text. The hook owns `busy` and `error`; the caller owns what to do afterwards.

- [ ] **Step 2: Rewire `Sources.tsx` to consume it.** Behaviour must be byte-identical.

- [ ] **Step 3: Verify by hand** — upload a file through Sources and confirm it still reaches `status='indexed'`. Report what you observed.

- [ ] **Step 4: `npm test && npm run build`; commit** `refactor: extract useDocumentUpload so the tour and Sources share one path`.

---

### Task 3: Typed target registry

**Files:** Create `web/lib/tour/targets.ts`; modify `AskWorkspace.tsx`, `AskChat.tsx`, `Rail.tsx`, `FolderGrid.tsx`, `CHANGELOG.md`

**Interfaces:**
- Produces: `type TourTarget = 'ask-pane' | 'ask-composer' | 'rail-sources' | 'rail-access' | 'organise-button'`; a `TourTargetContext`; `useTourTarget(name: TourTarget): (el: HTMLElement | null) => void` returning a callback ref; `useTourTargetEl(name): HTMLElement | null`.

- [ ] **Step 1: Implement the registry** — a context holding `Map<TourTarget, HTMLElement>`, a callback-ref hook that registers on mount and deletes on unmount. Registration must be idempotent across re-renders.

- [ ] **Step 2: Attach the five refs** — the Ask pane wrapper in `AskWorkspace.tsx`, the composer `<form>` in `AskChat.tsx`, the Sources and Access `<Link>`s in `Rail.tsx`, the Organise-with-AI `<button>` in `FolderGrid.tsx`. Attaching a ref must not change any existing behaviour or styling.

- [ ] **Step 3: Write the guard test** — `web/lib/tour/steps.test.ts` asserts every step definition's `target` is a member of the `TourTarget` union, so a renamed target is a build error rather than a silently skipped step.

- [ ] **Step 4: `npm test && npm run build`; commit** `feat: typed tour target registry`.

---

### Task 4: Tour shell — joyride controlled, custom card

**Files:** Create `web/app/(app)/_components/tour/TourProvider.tsx`, `.../TourCard.tsx`; modify `web/app/globals.css`, `web/app/(app)/layout.tsx`, `package.json`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the target registry (Task 3), dictionaries (Task 1).
- Produces: `<TourProvider locale role csrf seenSteps tourDismissed>` mounted in `(app)/layout.tsx` so it survives route changes; `useTour()` exposing `{ start(), active }`.

- [ ] **Step 1: Install** — `cd web && npm i react-joyride@3.2.0 --save-exact`. Confirm the installed LICENSE is MIT and record the gzipped size in your report.

- [ ] **Step 2: Build `TourCard.tsx`** — the custom `tooltipComponent`, in the product's language: `bg-paper-raised`, `border-line`, a 2px `--brain` left border, `shadow-lift`, a `font-mono text-[0.6875rem] uppercase tracking-[0.08em]` "Step n of m" caption, a `font-display` heading, `text-body` prose, and a wrapping button row.

  **Accessibility, non-negotiable:** `role="dialog"`, `aria-labelledby` pointing at the heading id, `aria-describedby` at the body id, `tabIndex={-1}` on the container with focus moved to it on each step change, **no `aria-modal`**, **no focus trap**, no `aria-live`. Do **not** spread `tooltipProps`. Fluid `max-width` (e.g. `min(92vw, 28rem)`), never a fixed 380px.

- [ ] **Step 3: Build `TourProvider.tsx`** — joyride in controlled mode. Required options:

```tsx
  disableOverlay          // no scrim; dashboard stays visible and clickable
  disableScrolling={false}
  spotlightClicks         // clicks reach the real UI
  disableCloseOnEsc={false}
  // NOT set: styles.options.width — it breaks 320px reflow
```

  plus `overlayClickAction: false`, `dismissKeyAction: 'close'`. Drive `stepIndex` **only** from the `callback`/`onEvent` handler — never from a `useEffect` on app state. Respect `prefers-reduced-motion` by disabling joyride's scroll animation when it matches.

- [ ] **Step 4: The ring** — in `globals.css`, style `[data-tour-active]` with a 2px `--brain` outline and a soft `--brain` glow, `outline-offset: 3px`. The provider sets and removes that attribute on the active target. Verify the outline's contrast against `--paper`.

- [ ] **Step 5: Mount in `(app)/layout.tsx`** — the provider must live in the app-shell layout so it persists across route changes. Pass the locale, role, csrf, and the user's seen steps from the server component.

- [ ] **Step 6: `npm test && npm run build`; commit** `feat: tour shell with a custom card and no scrim`.

---

### Task 5: Steps 1, 2, 4, 5 and role filtering

**Files:** Create `web/lib/tour/steps.ts`, `web/app/(app)/_components/tour/UploadStep.tsx`; modify `CHANGELOG.md`

**Interfaces:**
- Produces: `buildSteps(opts: { role: 'owner'|'member'; dict: Dictionary; hasUnfiled: boolean }): TourStep[]` where `TourStep = { key: string; target: TourTarget; placement?: Placement; content: ReactNode }`.

- [ ] **Step 1: Define the steps** — owner gets `welcome-v1`, `upload-v1`, `access-v1`, `ask-v1` (step 3 arrives in Task 6); member gets `welcome-v1`, `access-member-v1`, `ask-v1`. Copy comes from the dictionary, never inline.

- [ ] **Step 2: Build `UploadStep.tsx`** — a real dropzone plus file picker inside the card, using `useDocumentUpload`. Below it, a live status line polling `/api/documents` every 2500 ms: "*N files received · M indexed*".

  **The critical rule: `Next` enables the moment ≥1 file returns HTTP 201 — never on indexing completion.** Ingestion runs for minutes; gating on it would strand the user at a spinner. Indexing progress is informational and non-blocking; the user may advance or leave while it runs.

- [ ] **Step 3: The citation replica in `ask-v1`** — render a static, non-interactive replica of a citation chip using the same classes as the real one in `AskChat.tsx` (`[1] hr-policy.pdf · p.4 ↗`). Do not target a real citation button; it does not exist until an answer arrives.

- [ ] **Step 4: Test** — extend `steps.test.ts`: an owner with unfiled documents gets 4 steps in this release, a member gets 3, and a member's step list never contains `upload-v1`.

- [ ] **Step 5: `npm test && npm run build`; commit** `feat: tour steps with in-card upload`.

---

### Task 6: The conditional Organise step

Ship this last of the step work. If it wobbles, cut it to a one-time hint on the Sources page and lose nothing else.

**Files:** Modify `web/lib/tour/steps.ts`, `TourProvider.tsx`, `CHANGELOG.md`

- [ ] **Step 1: Include `organise-v1` only when `hasUnfiled`** — the Organise button only renders when `unfiledCount > 0`.
- [ ] **Step 2: Navigate in `before`** — `router.push('/dashboard/sources')`, return a ~300 ms promise, let `targetWaitTimeout` (1000 ms) absorb the mount. Step 4's `before` returns to `/dashboard`.
- [ ] **Step 3: Handle `EVENTS.TARGET_NOT_FOUND`** by skipping the step rather than stalling.
- [ ] **Step 4: Verify by hand** — with unfiled documents the step appears and navigates; with none, the tour goes 2 → 4 with no gap. Report both.
- [ ] **Step 5: `npm test && npm run build`; commit** `feat: conditional organise step`.

---

### Task 7: Persistence, auto-start, replay

**Files:** Create `web/lib/tour/state.ts`, `web/lib/tour/state.test.ts`, `web/app/api/tour/step/route.ts`; modify `web/lib/db/schema.ts`, `Rail.tsx`, `(app)/layout.tsx`, `CHANGELOG.md`

**Interfaces:**
- Produces: table `user_tour_steps(user_id, workspace_id, step_key, seen_at, PK(user_id, workspace_id, step_key))`; `users.tour_dismissed_at`; `nextStepKey(defined: string[], seen: string[]): string | null`; `shouldAutoStart(f: { seenCount: number; dismissed: boolean; path: string; uploadInFlight: boolean }): boolean`; `POST /api/tour/step`.

- [ ] **Step 1: Write the failing tests** — `state.test.ts` covers: `nextStepKey` returns the first unseen key in order; returns `null` when all seen; **ignores unknown keys in `seen`** (a retired step must not break resume); and `shouldAutoStart` is true only when `seenCount === 0 && !dismissed && path === '/dashboard' && !uploadInFlight`, with one test per false case.

- [ ] **Step 2: Implement** — both functions pure, no imports, so vitest can reach them.

- [ ] **Step 3: Schema + migration** for the table and column.

- [ ] **Step 4: `POST /api/tour/step`** — body `{stepKey: string}` or `{dismissed: true}`; auth → CSRF → upsert `ON CONFLICT DO NOTHING`. Reject a `stepKey` not in the known set with 400, so a typo cannot silently pollute the table.

- [ ] **Step 5: Auto-start and replay** — the provider auto-starts per `shouldAutoStart`, otherwise renders a quiet "Take the tour" pill. Add a permanent **Guide** item to `Rail.tsx`'s bottom cluster, above `egress 0 B`, which replays the tour transiently **without clearing rows**.

- [ ] **Step 6: `npm test && npm run build`; commit** `feat: tour persistence, auto-start gate and replay`.

---

### Task 8: The non-tour half — empty states, JIT citation hint, deletions

This is the guidance that survives a user who hits Escape in four seconds, and it is where the durable teaching lives.

**Files:** Create `web/app/(app)/_components/tour/CitationHint.tsx`; modify `GetStarted.tsx`, `AskChat.tsx`, `FolderGrid.tsx`, the Access page, the Atlas page, `CHANGELOG.md`; **delete** `ProgressStrip.tsx`

- [ ] **Step 1: Delete the rejected UI** — remove `ProgressStrip.tsx` entirely and delete `GetStarted.tsx`'s `workspaceEmpty` instruction branch. **Keep** the starter-suggestions branch; that is a useful empty state, not a tutorial. Remove every now-dead import and prop.

- [ ] **Step 2: Real empty states** — Ask pane with no documents: one line plus an **Add documents** button, not a numbered list. Sources: an Upload button inside `FolderGrid`'s existing empty message. **Access: permanent prose on group intersection and owner bypass** — the spec requires this sentence to exist outside the tour card. Atlas: what it is and that it needs documents.

- [ ] **Step 3: The JIT citation hint** — `CitationHint.tsx` renders one non-modal hint anchored to the first `[n]` button, the first time ever (per user) an answer with ≥1 citation renders. Dismisses on click or Escape, records `citation-hint-v1`, never returns.

- [ ] **Step 4: Verify by hand** — an empty workspace shows the empty states, not instructions; the citation hint fires once and never again. Report what you observed.

- [ ] **Step 5: `npm test && npm run build`; commit** `feat: empty states and just-in-time citation hint; remove the static first-run panel`.

---

### Task 9: Accessibility and localisation pass

**Files:** Modify whatever the pass finds; create `docs/product/2026-07-26-tour-accessibility-note.md`; modify `CHANGELOG.md`

- [ ] **Step 1: Keyboard-only run** of the entire flow, including step 2's file picker. Escape from every step. Confirm focus lands on the card container on each step change and returns sensibly on exit.
- [ ] **Step 2: 400% zoom (320 CSS px)** in all three locales — cards must reflow, not clip or scroll horizontally.
- [ ] **Step 3: Contrast** — the ring against `--paper`; card text against `--paper-raised`. Record measured ratios.
- [ ] **Step 4: `prefers-reduced-motion`** honoured.
- [ ] **Step 5: Screen reader** — NVDA + Chrome at minimum. Confirm the step heading and body are announced on each change and that the highlighted dashboard element is still reachable (this is what `aria-modal` would have broken).
- [ ] **Step 6: Write the conformance note** — a WCAG 2.1 AA statement with measured evidence and known gaps. **Do not claim EAA conformance.**
- [ ] **Step 7: Commit** `docs: tour accessibility conformance note`.

---

## Done criteria

1. The dashboard is never replaced by instructions and stays clickable throughout the tour.
2. A new owner uploads documents without leaving the guidance card, and `Next` enables on HTTP 201 rather than on indexing.
3. Escape ends the tour from every step; the whole flow completes keyboard-only.
4. A returning user resumes at the first unseen step; a second user on the same browser gets their own tour.
5. No step targets a node that may not exist, and the tour is coherent on an empty workspace.
6. `ProgressStrip.tsx` is gone and `GetStarted.tsx` no longer replaces the Ask pane with instructions.
7. `npm run build` still succeeds with no env and no database, and no outbound call is added.
