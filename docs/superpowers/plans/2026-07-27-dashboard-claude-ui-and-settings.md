# Dashboard shell, chat pane and Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CompanyMind's authenticated product a claude.ai-shaped shell — one sidebar, URL-addressable chats, a composer that owns its controls, answers as plain text — plus a real light/dark theme and the Settings surface the product has never had.

**Architecture:** Three moves, in order. (1) Every Tailwind colour already resolves through `var(--token)`, so adding a dark value to each token in `styles/tokens.css` themes the whole app with no `dark:` variants anywhere. (2) Chat selection moves from React state into the route (`/dashboard/c/[chatId]`), which is what lets a single layout-level sidebar replace today's two. (3) Settings is an intercepted parallel route, so it overlays the app and Escape returns you to your thread.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v3 · Drizzle ORM · Postgres · vitest (node environment)

**Spec:** `docs/superpowers/specs/2026-07-27-dashboard-claude-ui-and-settings-design.md`

## Global Constraints

- **Scope is `web/` only.** No change to `engine/`, `access.py`, retrieval, the Telegram path, or `marketing/`.
- **Brand is CompanyMind**, never "CompBrain". Infra ids like the Postgres user/db `compbrain` stay as they are.
- **Tests live in `lib/`.** `vitest.config.ts` sets `include: ['lib/**/*.test.ts']` and `environment: 'node'` — there is no DOM. A test placed anywhere else does not run. Route tests import from `@/app/api/...` but the file itself lives in `lib/`.
- **Every mutating API route** calls `verifyCsrf(req)` and returns `403 { error: 'bad csrf' }` on failure, matching every existing route.
- **The workspace and the user come from the session, never the request.** No route may read an id out of a body or query string to decide what to touch.
- **Owner-gated routes use `getOwner()`** and return `403`, not `404`.
- **Every new user-facing string goes into all three dictionaries** — `lib/i18n/en.ts`, `ru.ts`, `uz.ts` — in the same commit. `lib/i18n/i18n.test.ts` enforces key parity and will fail otherwise. Uzbek uses U+02BB (ʻ), never an ASCII apostrophe; that test enforces it too.
- **Tour targets must keep working.** `lib/tour/targets.ts` defines a closed union — `'ask-pane' | 'ask-composer' | 'rail-sources' | 'rail-access' | 'organise-button'`. Do not rename or remove members; move the `useTourTarget` refs to the new components.
- **`EMBED_DIM` is untouched.** Nothing in this plan goes near it.
- **Log every notable change in `CHANGELOG.md`** under `[Unreleased]`, grouped Added / Changed / Fixed / Removed, in the same commit as the change.
- Run `npm test` from `web/` and keep it green at every commit. Run `npm run build` before the final commit of each stage.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `lib/theme.ts` | `Theme`/`Motion` types, guards, cookie names. Importable from client and server. |
| `lib/theme.test.ts` | Guards reject unknown values. |
| `lib/tokens-contrast.test.ts` | Parses `styles/tokens.css`, recomputes every WCAG ratio in both themes. |
| `lib/me.ts` | `cleanProfilePatch` (pure validation) + `updateProfile` (the write). |
| `lib/me.test.ts` | Validation rejects unknown locale/theme/motion, trims name. |
| `lib/me-routes.test.ts` | `/api/me` gating, CSRF, forged-id rejection. |
| `lib/sessions.ts` | `describeUserAgent`, `listUserSessions`, `revokeAllSessions`. |
| `lib/sessions.test.ts` | User-agent description; scoping. |
| `lib/settings-routes.test.ts` | `/api/workspace` owner gate, `/api/chats` DELETE scoping. |
| `app/api/me/route.ts` | `PATCH` — name, locale, theme, motion. |
| `app/api/me/sessions/route.ts` | `GET` list, `DELETE` sign out everywhere. |
| `app/api/workspace/route.ts` | `PATCH` rename, `getOwner()`-gated. |
| `app/(app)/_components/Sidebar.tsx` | The single sidebar: nav, recents, user pill. |
| `app/(app)/_components/SidebarNav.tsx` | Nav entries + tour refs. |
| `app/(app)/_components/Recents.tsx` | Chat list, search, rename, delete. |
| `app/(app)/_components/UserMenu.tsx` | The bottom pill and its menu. |
| `app/(app)/dashboard/c/[chatId]/page.tsx` | An open thread. |
| `app/(app)/dashboard/Composer.tsx` | Auto-growing composer card. |
| `app/(app)/dashboard/Message.tsx` | One turn — user bubble or assistant prose + citations. |
| `app/(app)/dashboard/Thinking.tsx` | Staged waiting indicator. |
| `app/(app)/dashboard/layout.tsx` | Renders `{children}{settings}` for the parallel slot. |
| `app/(app)/dashboard/@settings/default.tsx` | `null`. |
| `app/(app)/dashboard/@settings/(.)settings/[section]/page.tsx` | Settings as a modal. |
| `app/(app)/dashboard/settings/[section]/page.tsx` | Settings as a full page. |
| `app/(app)/dashboard/settings/SettingsShell.tsx` | Sub-nav + section dispatch. |
| `app/(app)/dashboard/settings/SettingsRow.tsx` | The row primitive. |
| `app/(app)/dashboard/settings/sections/*.tsx` | General, Account, Workspace, Data. |

**Modified**

| File | Change |
|---|---|
| `styles/tokens.css` | Every token becomes a `light-dark()` pair with a fallback. |
| `app/globals.css` | `[data-motion='reduced']` beside the media query; `.rail-link` becomes `.nav-link`. |
| `app/layout.tsx` | Reads the theme cookie, stamps `data-theme`/`data-motion`, dual `themeColor`. |
| `lib/db/schema.ts` | `users.theme`, `users.motion`. |
| `lib/auth/session-store.ts` | `Session` gains `sessionId`. |
| `lib/chat.ts` | `deleteAllChats`. |
| `app/api/chats/route.ts` | `DELETE` — delete all of the caller's chats. |
| `app/(app)/layout.tsx` | Mounts `Sidebar` instead of `Rail`. |
| `app/(app)/dashboard/page.tsx` | New-chat surface. |
| `app/(app)/dashboard/AskWorkspace.tsx` | URL-driven; no second sidebar. |
| `app/(app)/dashboard/AskChat.tsx` | Restyled; composer and message extracted. |
| `app/(app)/dashboard/atlas/Atlas.tsx` | Canvas colours read from CSS vars. |
| `lib/i18n/{en,ru,uz}.ts` | New copy. |

**Deleted**

`app/(app)/_components/Rail.tsx` · `app/(app)/dashboard/Conversations.tsx` · `app/(app)/dashboard/GetStarted.tsx` (its copy moves into the empty state)

---

## Stage 1 — Theme

### Task 1: Dark palette in tokens.css, enforced by a contrast test

**Files:**
- Modify: `web/styles/tokens.css`
- Test: `web/lib/tokens-contrast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `[data-theme]` contract on `<html>`; every existing Tailwind colour class now resolves per theme with no further change.

- [ ] **Step 1: Write the failing test**

Create `web/lib/tokens-contrast.test.ts`:

```ts
/**
 * The contrast law in styles/tokens.css, recomputed rather than trusted.
 *
 * The file has always documented WCAG ratios in a comment. A comment cannot
 * fail, so the dark palette — chosen in one sitting, edited forever after —
 * would drift the moment someone nudged a hex "to look right". This test
 * parses the real stylesheet and recalculates every ratio the law claims.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

/** Every `--name: light-dark(#light, #dark);` declaration in the file. */
function parseTokens(): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {}
  const re = /--([a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g
  for (const m of css.matchAll(re)) out[m[1]] = { light: m[2], dark: m[3] }
  return out
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const T = parseTokens()
const SURFACES = ['paper', 'paper-raised', 'paper-sunk'] as const
const MODES = ['light', 'dark'] as const

describe('tokens.css', () => {
  it('declares every themed token as a light-dark() pair', () => {
    const required = [
      'paper', 'paper-raised', 'paper-sunk',
      'ink', 'ink-soft', 'line', 'line-control',
      'brain', 'query', 'sovereign',
      'brain-text', 'query-text', 'sovereign-text',
    ]
    expect(Object.keys(T).sort()).toEqual([...required].sort())
  })

  it('every token also has a plain fallback declaration before its pair', () => {
    // An engine without light-dark() must keep the light theme, not lose the
    // token entirely — which would leave text and its background the same.
    for (const name of Object.keys(T)) {
      const fallback = new RegExp(`--${name}:\\s*#[0-9a-fA-F]{6};\\s*\\n\\s*--${name}:\\s*light-dark`)
      expect(fallback.test(css), `--${name} has no fallback declaration`).toBe(true)
    }
  })

  it('--ink clears AAA (7:1) on all three surfaces, in both themes', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(ratio(T.ink[mode], T[s][mode]), `--ink on --${s} (${mode})`).toBeGreaterThanOrEqual(7)
  })

  it('--ink-soft clears AA (4.5:1) on all three surfaces, in both themes', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(ratio(T['ink-soft'][mode], T[s][mode]), `--ink-soft on --${s} (${mode})`)
          .toBeGreaterThanOrEqual(4.5)
  })

  it('the *-text accents clear AA (4.5:1) on all three surfaces, in both themes', () => {
    for (const accent of ['brain-text', 'query-text', 'sovereign-text'])
      for (const mode of MODES)
        for (const s of SURFACES)
          expect(ratio(T[accent][mode], T[s][mode]), `--${accent} on --${s} (${mode})`)
            .toBeGreaterThanOrEqual(4.5)
  })

  it('--line-control clears the 3:1 SC 1.4.11 floor for a control boundary', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(ratio(T['line-control'][mode], T[s][mode]), `--line-control on --${s} (${mode})`)
          .toBeGreaterThanOrEqual(3)
  })

  it('the graphic accents clear the 3:1 non-text floor', () => {
    // --query FAILS this on light paper by design and is documented as
    // GRAPHICS ONLY there; the floor is asserted for dark, where the palette
    // was chosen fresh and has no such legacy.
    for (const accent of ['brain', 'sovereign'])
      for (const mode of MODES)
        for (const s of SURFACES)
          expect(ratio(T[accent][mode], T[s][mode]), `--${accent} on --${s} (${mode})`)
            .toBeGreaterThanOrEqual(3)
    for (const s of SURFACES)
      expect(ratio(T.query.dark, T[s].dark), `--query on --${s} (dark)`).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npx vitest run lib/tokens-contrast.test.ts
```

Expected: FAIL — `parseTokens()` returns `{}` because `tokens.css` has no `light-dark()` declarations yet, so the first test's `Object.keys(T)` is empty.

- [ ] **Step 3: Rewrite the token block**

Replace the `:root { ... }` block in `web/styles/tokens.css` (keep the file's existing header comment, and update its contrast-law paragraph to say the ratios are now verified by `lib/tokens-contrast.test.ts`) with:

```css
/* Theme resolution. `color-scheme` is what light-dark() reads, and it is set
   from server-rendered HTML (app/layout.tsx stamps data-theme from a cookie),
   so the correct palette is in effect on the very first paint — no inline
   script, no flash. `:root` alone means "follow the OS". */
:root {
  color-scheme: light dark;
}
[data-theme='light'] {
  color-scheme: light;
}
[data-theme='dark'] {
  color-scheme: dark;
}

:root {
  /* Each token is declared TWICE on purpose. The first is the fallback an
     engine without light-dark() keeps (light theme, degraded but correct);
     the second is the real declaration. Never delete the first. */

  /* ---- Paper: the world ---- */
  --paper: #f3eee3;
  --paper: light-dark(#f3eee3, #1a1917);
  --paper-raised: #fbf8f1;
  --paper-raised: light-dark(#fbf8f1, #232220);
  --paper-sunk: #e8e1d2;
  --paper-sunk: light-dark(#e8e1d2, #131211);

  /* ---- Ink: everything that must be read ---- */
  --ink: #1c1b18;
  --ink: light-dark(#1c1b18, #f4f0e6);
  --ink-soft: #635e54;
  --ink-soft: light-dark(#635e54, #a8a094);
  --line: #d8d0be;
  --line: light-dark(#d8d0be, #322f2a);
  --line-control: #857960;
  --line-control: light-dark(#857960, #7d7466);

  /* ---- Accent inks: graphics only ---- */
  --brain: #684bff;
  --brain: light-dark(#684bff, #9b86ff);
  --query: #e07b39;
  --query: light-dark(#e07b39, #e8904a);
  --sovereign: #d8315b;
  --sovereign: light-dark(#d8315b, #f0577f);

  /* ---- Accent inks, text-safe. On light these are DARKENED until they pass
     AA; on dark the same rule runs in reverse and they are LIGHTENED. ---- */
  --brain-text: #5636d6;
  --brain-text: light-dark(#5636d6, #b3a3ff);
  --query-text: #9a4a18;
  --query-text: light-dark(#9a4a18, #f2ab72);
  --sovereign-text: #b02348;
  --sovereign-text: light-dark(#b02348, #f5849f);

  /* ---- Shadows. A soft warm shadow is invisible on dark paper, so dark
     leans on a hairline ring instead of a glow. ---- */
  --shadow-artifact: 0 1px 2px rgba(60, 48, 30, 0.08), 0 2px 6px rgba(60, 48, 30, 0.06);
  --shadow-card: 0 1px 2px rgba(60, 48, 30, 0.05), 0 4px 16px rgba(60, 48, 30, 0.07);
  --shadow-lift: 0 2px 4px rgba(60, 48, 30, 0.06), 0 12px 32px rgba(60, 48, 30, 0.1);

  /* ---- Motion ---- */
  --ease-out-paper: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-paper: cubic-bezier(0.65, 0, 0.35, 1);

  /* ---- Layout ---- */
  --gutter: clamp(1.25rem, 5vw, 5rem);
  --measure: 62ch;
  --nav-h: 4.5rem;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --shadow-artifact: 0 0 0 1px rgba(255, 255, 255, 0.05);
    --shadow-card: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.4);
    --shadow-lift: 0 0 0 1px rgba(255, 255, 255, 0.07), 0 12px 32px rgba(0, 0, 0, 0.5);
  }
}
[data-theme='dark'] {
  --shadow-artifact: 0 0 0 1px rgba(255, 255, 255, 0.05);
  --shadow-card: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lift: 0 0 0 1px rgba(255, 255, 255, 0.07), 0 12px 32px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npx vitest run lib/tokens-contrast.test.ts
```

Expected: PASS, all seven cases. If a ratio assertion fails, adjust that hex and re-run — **do not weaken the threshold.** The numbers in the file were computed against these thresholds and are expected to clear them.

- [ ] **Step 5: Run the whole suite**

```bash
cd web && npm test
```

Expected: PASS. Nothing else reads this file.

- [ ] **Step 6: Commit**

```bash
git add web/styles/tokens.css web/lib/tokens-contrast.test.ts
git commit -m "feat(web): dark palette as light-dark() pairs, with the contrast law under test"
```

---

### Task 2: theme and motion columns on users

**Files:**
- Create: `web/lib/theme.ts`, `web/lib/theme.test.ts`
- Modify: `web/lib/db/schema.ts`

**Interfaces:**
- Produces: `type Theme = 'system' | 'light' | 'dark'`, `type Motion = 'system' | 'reduced'`, `isTheme(x: unknown): x is Theme`, `isMotion(x: unknown): x is Motion`, `THEME_COOKIE = 'cm_theme'`, `MOTION_COOKIE = 'cm_motion'`. Consumed by Tasks 3, 4 and 12.

- [ ] **Step 1: Write the failing test**

Create `web/lib/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isTheme, isMotion, THEME_COOKIE, MOTION_COOKIE } from './theme'

describe('theme guards', () => {
  it('accepts exactly the three themes', () => {
    expect(['system', 'light', 'dark'].every(isTheme)).toBe(true)
  })

  it('rejects anything else, including near-misses and non-strings', () => {
    for (const bad of ['Dark', 'DARK', 'auto', '', 'light ', null, undefined, 0, {}])
      expect(isTheme(bad), String(bad)).toBe(false)
  })

  it('accepts exactly the two motion settings', () => {
    expect(['system', 'reduced'].every(isMotion)).toBe(true)
    for (const bad of ['none', 'off', 'Reduced', null, 1]) expect(isMotion(bad), String(bad)).toBe(false)
  })

  it('names cookies without colliding with the session cookie', () => {
    expect(THEME_COOKIE).toBe('cm_theme')
    expect(MOTION_COOKIE).toBe('cm_motion')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npx vitest run lib/theme.test.ts
```

Expected: FAIL — `Cannot find module './theme'`.

- [ ] **Step 3: Write the module**

Create `web/lib/theme.ts`:

```ts
/**
 * Appearance preferences. Deliberately NOT `import 'server-only'`: the root
 * layout reads these on the server and the Settings controls write them from
 * the client, so both halves need the same guards. Same reasoning as
 * lib/i18n/index.ts.
 *
 * 'system' is stored as a real value rather than as null. The distinction
 * matters: "follow the OS" is a choice a user makes, and a null would be
 * indistinguishable from "never asked", which is what a future default change
 * would need to know.
 */
export type Theme = 'system' | 'light' | 'dark'
export type Motion = 'system' | 'reduced'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']
export const MOTIONS: readonly Motion[] = ['system', 'reduced']

export const THEME_COOKIE = 'cm_theme'
export const MOTION_COOKIE = 'cm_motion'

/** One year. These are preferences, not credentials — losing one is a papercut,
 *  not a security event, and a short TTL would make the theme flip on people. */
export const PREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isTheme(x: unknown): x is Theme {
  return typeof x === 'string' && (THEMES as readonly string[]).includes(x)
}

export function isMotion(x: unknown): x is Motion {
  return typeof x === 'string' && (MOTIONS as readonly string[]).includes(x)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npx vitest run lib/theme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the columns**

In `web/lib/db/schema.ts`, inside `export const users = pgTable('users', {...})`, immediately after the `locale` column:

```ts
  // Appearance, per user for the same reason locale is per user: one firm, many
  // people, one shared workspace row. 'system' means "follow the OS" and is a
  // real stored choice, not an absence — see lib/theme.ts.
  theme: text('theme').notNull().default('system'),
  motion: text('motion').notNull().default('system'),
```

- [ ] **Step 6: Generate the migration**

```bash
cd web && npm run db:generate
```

Expected: a new file under the drizzle migrations directory adding both columns. **Read it** and confirm it is two `ALTER TABLE users ADD COLUMN ... NOT NULL DEFAULT 'system'` statements and nothing else. Do not hand-edit it.

- [ ] **Step 7: Apply it**

```bash
cd web && npm run db:migrate
```

Expected: applied cleanly. (`DATABASE_URL` must be set; the compose stack's `db` service is already running.)

- [ ] **Step 8: Run the suite and commit**

```bash
cd web && npm test
git add web/lib/theme.ts web/lib/theme.test.ts web/lib/db/schema.ts web/drizzle
git commit -m "feat(web): store theme and motion preferences on users"
```

---

### Task 3: PATCH /api/me

**Files:**
- Create: `web/lib/me.ts`, `web/lib/me.test.ts`, `web/lib/me-routes.test.ts`, `web/app/api/me/route.ts`

**Interfaces:**
- Consumes: `isTheme`, `isMotion`, `THEME_COOKIE`, `MOTION_COOKIE`, `PREF_COOKIE_MAX_AGE` (Task 2); `isLocale` from `@/lib/i18n`.
- Produces: `cleanProfilePatch(input: unknown): CleanProfile | null` and `updateProfile(userId: string, patch: CleanProfile): Promise<void>`, where `CleanProfile = { name?: string | null; locale?: Locale; theme?: Theme; motion?: Motion }`. `PATCH /api/me` consumed by Task 12.

- [ ] **Step 1: Write the failing validation test**

Create `web/lib/me.test.ts`:

```ts
/**
 * Validation is a pure function, separate from the write, because vitest runs
 * in a `node` environment with no database — and because the interesting
 * failures here are all about what a hostile body can smuggle in, which is
 * exactly what a pure function can be exhaustively tested for.
 */
import { describe, it, expect } from 'vitest'
import { cleanProfilePatch } from './me'

describe('cleanProfilePatch', () => {
  it('passes through a valid patch', () => {
    expect(cleanProfilePatch({ name: 'Dovud', locale: 'uz', theme: 'dark', motion: 'reduced' }))
      .toEqual({ name: 'Dovud', locale: 'uz', theme: 'dark', motion: 'reduced' })
  })

  it('accepts a partial patch and omits what was not sent', () => {
    expect(cleanProfilePatch({ theme: 'light' })).toEqual({ theme: 'light' })
  })

  it('trims the name and stores a blank one as null', () => {
    expect(cleanProfilePatch({ name: '  Dovud  ' })).toEqual({ name: 'Dovud' })
    expect(cleanProfilePatch({ name: '   ' })).toEqual({ name: null })
    expect(cleanProfilePatch({ name: null })).toEqual({ name: null })
  })

  it('rejects an over-long name rather than silently truncating it', () => {
    expect(cleanProfilePatch({ name: 'x'.repeat(81) })).toBeNull()
  })

  it('rejects an unknown locale, theme or motion', () => {
    expect(cleanProfilePatch({ locale: 'de' })).toBeNull()
    expect(cleanProfilePatch({ theme: 'midnight' })).toBeNull()
    expect(cleanProfilePatch({ motion: 'off' })).toBeNull()
  })

  it('ignores fields it does not own — an id in the body is not a target', () => {
    // The route resolves the user from the session. A patch that appears to
    // name someone else must not carry that name any further.
    expect(cleanProfilePatch({ id: 'someone-else', userId: 'someone-else', theme: 'dark' }))
      .toEqual({ theme: 'dark' })
  })

  it('rejects a non-object body', () => {
    for (const bad of [null, undefined, 'dark', 42, []]) expect(cleanProfilePatch(bad)).toBeNull()
  })

  it('rejects an empty patch — a PATCH that changes nothing is a client bug', () => {
    expect(cleanProfilePatch({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npx vitest run lib/me.test.ts
```

Expected: FAIL — `Cannot find module './me'`.

- [ ] **Step 3: Write the module**

Create `web/lib/me.ts`:

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { isLocale, type Locale } from '@/lib/i18n'
import { isMotion, isTheme, type Motion, type Theme } from '@/lib/theme'

export type CleanProfile = {
  name?: string | null
  locale?: Locale
  theme?: Theme
  motion?: Motion
}

const MAX_NAME = 80

/**
 * Validate a PATCH /api/me body into exactly the fields a user may change
 * about themselves. Returns null when anything is invalid — the route turns
 * that into a 400 rather than partially applying a bad patch.
 *
 * Fields are read by name, never spread, so an id, role, email or
 * isSuperAdmin smuggled into the body simply does not survive this function.
 */
export function cleanProfilePatch(input: unknown): CleanProfile | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const body = input as Record<string, unknown>
  const out: CleanProfile = {}

  if ('name' in body) {
    const raw = body.name
    if (raw !== null && typeof raw !== 'string') return null
    const trimmed = (raw ?? '').trim()
    if (trimmed.length > MAX_NAME) return null
    out.name = trimmed === '' ? null : trimmed
  }
  if ('locale' in body) {
    if (!isLocale(String(body.locale))) return null
    out.locale = body.locale as Locale
  }
  if ('theme' in body) {
    if (!isTheme(body.theme)) return null
    out.theme = body.theme
  }
  if ('motion' in body) {
    if (!isMotion(body.motion)) return null
    out.motion = body.motion
  }

  return Object.keys(out).length === 0 ? null : out
}

export async function updateProfile(userId: string, patch: CleanProfile): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, userId))
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npx vitest run lib/me.test.ts
```

Expected: PASS, eight cases.

- [ ] **Step 5: Write the failing route test**

Create `web/lib/me-routes.test.ts`:

```ts
/**
 * /api/me changes only the caller's own row.
 *
 * The forged-id case is the one that matters: lib/me.test.ts proves the
 * validator drops an id from the body, and this proves the ROUTE never had a
 * way to use one in the first place — it passes the session's user id and
 * nothing else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { updateProfile } from '@/lib/me'
import { PATCH } from '@/app/api/me/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/me', async (orig) => ({
  ...(await orig<typeof import('@/lib/me')>()),
  updateProfile: vi.fn(),
}))

const SESSION = {
  user: { id: 'user-a', locale: 'en' },
  workspace: { id: 'firm-a' },
  role: 'member',
} as unknown as Awaited<ReturnType<typeof getCurrentUser>>

const patch = (body: unknown) =>
  new Request('http://test/api/me', { method: 'PATCH', body: JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
  vi.mocked(getCurrentUser).mockResolvedValue(SESSION)
})

describe('PATCH /api/me', () => {
  it('401s when signed out, without writing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await PATCH(patch({ theme: 'dark' }))).status).toBe(401)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('403s without a valid CSRF token, without writing', async () => {
    vi.mocked(verifyCsrf).mockResolvedValue(false)
    expect((await PATCH(patch({ theme: 'dark' }))).status).toBe(403)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('400s on an invalid value, without writing', async () => {
    expect((await PATCH(patch({ locale: 'de' }))).status).toBe(400)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('writes only to the session user, ignoring an id in the body', async () => {
    const res = await PATCH(patch({ id: 'victim', userId: 'victim', theme: 'dark' }))
    expect(res.status).toBe(200)
    expect(updateProfile).toHaveBeenCalledWith('user-a', { theme: 'dark' })
  })

  it('mirrors theme and motion into cookies so the server render matches', async () => {
    const res = await PATCH(patch({ theme: 'dark', motion: 'reduced' }))
    const cookies = res.headers.getSetCookie().join(' ')
    expect(cookies).toContain('cm_theme=dark')
    expect(cookies).toContain('cm_motion=reduced')
  })

  it('does not touch the theme cookie when the patch does not mention theme', async () => {
    const res = await PATCH(patch({ name: 'Dovud' }))
    expect(res.headers.getSetCookie().join(' ')).not.toContain('cm_theme')
  })
})
```

- [ ] **Step 6: Run it and watch it fail**

```bash
cd web && npx vitest run lib/me-routes.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/me/route'`.

- [ ] **Step 7: Write the route**

Create `web/app/api/me/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { cleanProfilePatch, updateProfile } from '@/lib/me'
import { MOTION_COOKIE, PREF_COOKIE_MAX_AGE, THEME_COOKIE } from '@/lib/theme'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const patch = cleanProfilePatch(await req.json().catch(() => null))
  if (!patch) return NextResponse.json({ error: 'invalid patch' }, { status: 400 })

  // The user id comes from the session. There is no code path here that reads
  // one from the request — see lib/me-routes.test.ts.
  await updateProfile(auth.user.id, patch)

  const res = NextResponse.json({ ok: true })
  // Mirrored so app/layout.tsx can stamp data-theme server-side on the very
  // first paint. Not HttpOnly — these are preferences, not credentials, and
  // nothing authorizes on them.
  const opts = { path: '/', sameSite: 'lax' as const, maxAge: PREF_COOKIE_MAX_AGE }
  if (patch.theme) res.cookies.set(THEME_COOKIE, patch.theme, opts)
  if (patch.motion) res.cookies.set(MOTION_COOKIE, patch.motion, opts)
  return res
}
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd web && npx vitest run lib/me.test.ts lib/me-routes.test.ts
```

Expected: PASS.

- [ ] **Step 9: Full suite and commit**

```bash
cd web && npm test
git add web/lib/me.ts web/lib/me.test.ts web/lib/me-routes.test.ts web/app/api/me
git commit -m "feat(web): PATCH /api/me for name, locale, theme and motion"
```

---

### Task 4: Apply the theme on the server

**Files:**
- Modify: `web/app/layout.tsx`, `web/app/globals.css`

**Interfaces:**
- Consumes: `THEME_COOKIE`, `MOTION_COOKIE`, `isTheme`, `isMotion` (Task 2).
- Produces: `data-theme` and `data-motion` on `<html>`, read by `tokens.css` (Task 1) and `globals.css`.

- [ ] **Step 1: Stamp the attributes**

In `web/app/layout.tsx`, add the imports and make the component async:

```tsx
import { cookies } from 'next/headers'
import { isMotion, isTheme, MOTION_COOKIE, THEME_COOKIE } from '@/lib/theme'
```

Replace `export const viewport` and `RootLayout` with:

```tsx
export const viewport: Viewport = {
  // Both, so the browser chrome matches the palette actually in effect.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3EEE3' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1917' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read from a cookie rather than the session: this layout also wraps /login,
  // where there is no session yet, and a signed-out visitor's chosen theme
  // should still hold. The durable store is users.theme; the cookie is the
  // mirror that makes a server render possible. Reading cookies() opts these
  // routes into dynamic rendering — every authenticated route already is.
  const jar = await cookies()
  const themeCookie = jar.get(THEME_COOKIE)?.value
  const motionCookie = jar.get(MOTION_COOKIE)?.value
  const theme = isTheme(themeCookie) ? themeCookie : 'system'
  const motion = isMotion(motionCookie) ? motionCookie : 'system'
  return (
    <html
      lang="en"
      data-theme={theme}
      data-motion={motion}
      className={`${display.variable} ${mono.variable} ${body.variable}`}
    >
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Honour the motion preference in CSS**

In `web/app/globals.css`, replace the trailing `@media (prefers-reduced-motion: reduce)` block with:

```css
/* Two triggers, one rule: the OS preference, and an explicit in-product choice
   for someone whose OS setting they cannot change (a shared or locked-down
   machine — common in exactly the regulated firms this ships to). */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

[data-motion='reduced'] *,
[data-motion='reduced'] *::before,
[data-motion='reduced'] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

- [ ] **Step 3: Verify the build**

```bash
cd web && npm run build
```

Expected: succeeds. `web/lib/db/client.ts` is a lazy Proxy and `lib/env.ts` is getter-based precisely so a build needs no database or env — that must still hold.

- [ ] **Step 4: Verify both themes in the browser**

```bash
docker compose up -d --build web
```

Open `http://localhost:3000/login`. In devtools, set `<html data-theme="dark">` by hand and confirm the page inverts: warm near-black paper, off-white text, the card border still visible, the Sign in button still legible. Set `data-theme="light"` and confirm it returns to cream. Then delete the attribute and confirm it follows the OS setting.

- [ ] **Step 5: Commit**

```bash
git add web/app/layout.tsx web/app/globals.css
git commit -m "feat(web): resolve theme and motion from cookies on the server"
```

- [ ] **Step 6: Changelog**

Add to `CHANGELOG.md` under `[Unreleased]` → `Added`:

```markdown
- Light/dark theming across the app. Every design token in `web/styles/tokens.css`
  is now a `light-dark()` pair verified by `web/lib/tokens-contrast.test.ts`, and
  the theme is resolved server-side from a cookie so there is no flash. A
  reduced-motion preference rides the same path.
```

```bash
git add CHANGELOG.md && git commit -m "docs: changelog for theming"
```

---

## Stage 2 — Shell

### Task 5: Chat selection moves into the URL

**Files:**
- Create: `web/app/(app)/dashboard/c/[chatId]/page.tsx`
- Modify: `web/app/(app)/dashboard/AskWorkspace.tsx`, `web/app/(app)/dashboard/AskChat.tsx`, `web/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Produces: routes `/dashboard` (new chat) and `/dashboard/c/[chatId]` (thread). `AskChat` takes `chatId: string | null` from route params rather than parent state. Consumed by Task 6's `Recents`.

- [ ] **Step 1: Add the thread route**

Create `web/app/(app)/dashboard/c/[chatId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { chatOwned } from '@/lib/chat'
import { getDictionary, isLocale } from '@/lib/i18n'
import { AskWorkspace } from '../../AskWorkspace'

export const runtime = 'nodejs'

export default async function ThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) notFound()
  const { chatId } = await params
  // The id in the URL is NOT an authorization input. chatOwned scopes to
  // (workspaceId, userId) from the session, so someone else's chat id is a 404
  // here exactly as it is in /api/chats/[id].
  if (!(await chatOwned(chatId, auth.workspace.id, auth.user.id))) notFound()
  const csrf = await issueCsrf()
  const dict = getDictionary(isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <AskWorkspace
      csrf={csrf}
      chatId={chatId}
      onboarding={null}
      initialSuggestions={[]}
      canManage={auth.role === 'owner'}
      dict={dict}
    />
  )
}
```

Check `chatOwned`'s exact signature in `web/lib/chat.ts:63` before writing this and match it; if it returns a row rather than a boolean, adapt the guard to `=== null`.

- [ ] **Step 2: Make AskWorkspace URL-driven**

In `web/app/(app)/dashboard/AskWorkspace.tsx`: add a `chatId: string | null` prop; delete `selectedChatId`, `reloadSignal`, `mobileOpen`, `handleSelect` and the `<Conversations>` block along with its wrapper div and the mobile scrim; keep `pending` and `askPaneRef`. `handleFirstMessage` becomes:

```tsx
const router = useRouter()
const handleFirstMessage = useCallback(
  (newChatId: string) => {
    // replace, not push: the empty /dashboard state is not a place worth
    // going back to, and pushing it would make Back re-open a blank composer
    // above a thread that already exists.
    router.replace(`/dashboard/c/${newChatId}`)
  },
  [router],
)
```

The returned tree collapses to the pane alone:

```tsx
return (
  <div ref={askPaneRef} className="flex h-dvh min-w-0 flex-col">
    {onboarding && showGetStarted(onboarding, initialSuggestions, chatId, pending) ? (
      <GetStarted ... />
    ) : (
      <AskChat csrf={csrf} chatId={chatId} onFirstMessage={handleFirstMessage} ... />
    )}
  </div>
)
```

`showGetStarted`'s third parameter is now `chatId`; its logic and its doc comment are unchanged — that comment explains why the suggestion-count guard exists and it still applies.

- [ ] **Step 3: Pass the null chatId from the index page**

In `web/app/(app)/dashboard/page.tsx`, add `chatId={null}` to both `<AskWorkspace>` call sites.

- [ ] **Step 4: Refresh the sidebar's list after the first message**

`AskChat`'s `onFirstMessage` now navigates, and the sidebar is a server-rendered sibling that will not know about the new thread. In `AskChat.send`, after a successful first response, call `router.refresh()` alongside `onFirstMessage` so the layout re-renders with the new thread in Recents.

- [ ] **Step 5: Verify**

```bash
cd web && npm run build && npm test
```

Expected: both pass. Then in the browser: open `/dashboard`, ask a question, confirm the URL becomes `/dashboard/c/<uuid>`, reload the page and confirm the thread is still there, press Back and confirm you land on the empty composer.

- [ ] **Step 6: Commit**

```bash
git add "web/app/(app)/dashboard"
git commit -m "feat(web): address chat threads by URL at /dashboard/c/[chatId]"
```

---

### Task 6: One sidebar

**Files:**
- Create: `web/app/(app)/_components/Sidebar.tsx`, `SidebarNav.tsx`, `Recents.tsx`
- Modify: `web/app/(app)/layout.tsx`, `web/app/globals.css`
- Delete: `web/app/(app)/_components/Rail.tsx`, `web/app/(app)/dashboard/Conversations.tsx`

**Interfaces:**
- Consumes: `/dashboard/c/[chatId]` (Task 5); `GET /api/chats?q=`, `PATCH|DELETE /api/chats/[id]` (existing).
- Produces: `<Sidebar>` taking `{ workspace, userName, userEmail, isOwner, isSuperAdmin, locale, deploymentMode, csrf }`. Consumed by Task 7's `UserMenu`.

- [ ] **Step 1: Rename the nav-link component class**

In `web/app/globals.css`, rename `.rail-link` to `.nav-link` and update its comment to describe the sidebar rather than the rail. Keep the `data-active` spine — it is the one piece of the old rail's visual language worth carrying over.

- [ ] **Step 2: Extract the nav**

Create `web/app/(app)/_components/SidebarNav.tsx` as a client component holding the `NAV` array and the `useTourTarget` refs **exactly as they exist in `Rail.tsx:39-71` today** — same conditional entries, same `tourRefByHref` mapping keyed on `href`, same `data-active={path === n.href}`. The only changes: it renders `.nav-link`, and each entry gains an icon (inline SVG, 16px, `currentColor` — no icon dependency is added).

Its `NAV` array is unchanged from `Rail.tsx`:

```tsx
const NAV = [
  { href: '/dashboard', label: 'Ask' },
  { href: '/dashboard/sources', label: 'Sources' },
  { href: '/dashboard/access', label: 'Access' },
  ...(isOwner ? [{ href: '/dashboard/people', label: 'People' }] : []),
  ...(isOwner ? [{ href: '/dashboard/integrations', label: 'Integrations' }] : []),
  ...(isOwner ? [{ href: '/dashboard/atlas', label: 'Atlas' }] : []),
  ...(isSuperAdmin && deploymentMode === 'hosted' ? [{ href: '/platform', label: 'Platform' }] : []),
]
```

One change to `data-active`: `/dashboard` must not stay highlighted while a thread is open under `/dashboard/c/...`, and it must not lose its highlight either — a thread *is* the Ask surface. Use:

```tsx
const isActive = (href: string) =>
  href === '/dashboard' ? path === '/dashboard' || path.startsWith('/dashboard/c/') : path === href
```

- [ ] **Step 3: Move the chat list**

Create `web/app/(app)/_components/Recents.tsx` by moving `Conversations.tsx` wholesale and changing three things:

1. Each row is a `<Link href={`/dashboard/c/${c.id}`}>` instead of a button calling `onSelectChat`. Active state comes from `usePathname()`, not a prop.
2. The `+ New chat` button becomes `<Link href="/dashboard">`.
3. Delete: after a successful `DELETE`, if the deleted chat is the one open, `router.push('/dashboard')`. The `reloadSignal` prop and its effect are gone; keep the debounced search effect exactly as it is.

Everything else — `relativeTime`, double-click-to-rename with Enter/Escape/blur, the `suppressBlur` ref, the delete confirm — moves across unchanged. The rename and delete handlers keep using `csrf`.

Replace the row's `window.confirm('Delete this conversation?')` with the same confirm — it is a browser dialog and the codebase already uses them here and in `PeoplePanel`; this plan does not introduce a modal system for it.

- [ ] **Step 4: Compose the sidebar**

Create `web/app/(app)/_components/Sidebar.tsx` — a client component laying out, top to bottom:

- Header row: `<Wordmark>`, a search toggle button, and a collapse toggle. Collapsed state in `useState` seeded from `localStorage.getItem('cm.sidebar')` inside a `useEffect` (never during render — server and client must agree on the first paint), written back on every change.
- `<Link href="/dashboard">+ New chat</Link>` styled as the primary action.
- `<SidebarNav>`.
- A `Recents` heading and `<Recents>`, which fills the remaining height and scrolls.
- `<UserMenu>` pinned to the bottom (Task 7; for this task render a placeholder that contains the existing sign-out form so nothing is lost between commits).

Shell classes: `flex h-dvh w-[17rem] shrink-0 flex-col border-r border-line bg-paper-sunk`. Collapsed: `w-14`, and every label gets `sr-only` while icons stay.

Mobile (`max-md`): fixed off-canvas drawer, `-translate-x-full` when closed, with a scrim — the same mechanics `AskWorkspace` used for its second sidebar, moved here. A slim top bar with a hamburger renders above `<main>` in the layout.

- [ ] **Step 5: Wire it into the layout**

In `web/app/(app)/layout.tsx`, swap the `Rail` import and element for `Sidebar`, passing the same props plus `userEmail={auth.user.email}` and `csrf={csrf}` (both already resolved in that function).

- [ ] **Step 6: Delete the old components**

```bash
git rm "web/app/(app)/_components/Rail.tsx" "web/app/(app)/dashboard/Conversations.tsx"
```

- [ ] **Step 7: Verify**

```bash
cd web && npm run build && npm test
```

Expected: both pass. `lib/tour/targets.test.ts` and `lib/tour/steps.test.ts` are the ones to watch — they prove the `rail-sources`/`rail-access` anchors are still registered.

In the browser: confirm there is exactly one sidebar on `/dashboard`; that Recents links open threads; that rename and delete still work; that Sources/Access/People/Integrations/Atlas all still navigate; that the tour's Guide entry still highlights Sources and Access.

- [ ] **Step 8: Commit**

```bash
git add -A "web/app/(app)" web/app/globals.css
git commit -m "feat(web): merge the rail and the chat list into one sidebar"
```

---

### Task 7: The user pill and its menu

**Files:**
- Create: `web/app/(app)/_components/UserMenu.tsx`
- Modify: `web/app/(app)/_components/Sidebar.tsx`

**Interfaces:**
- Consumes: `useTour()` from `./tour/TourProvider` for the replay action.
- Produces: the Settings entry linking to `/dashboard/settings/general`, which Task 11 makes real.

- [ ] **Step 1: Build the menu**

Create `web/app/(app)/_components/UserMenu.tsx`, a client component. The trigger is a full-width button: a round avatar showing the first letter of the name (or of the email), the name, the workspace as a second line, and a chevron. The popover opens **upward** — it is at the bottom of the viewport.

Contents, in order:

1. The email, as a non-interactive header.
2. **Settings** — `<Link href="/dashboard/settings/general">`, with `⌘,` shown as a hint.
3. **Language** — a submenu of English / Русский / Oʻzbekcha; picking one `PATCH`es `/api/me` with `{ locale }` and then calls `router.refresh()`.
4. **Replay the guided tour** — `onClick={() => start({ fromBeginning: true })}`, carrying over `Rail.tsx:91-97` including the reasoning in its comment: Guide is a deliberate full walkthrough, never a resume, and it never clears `user_tour_steps`.
5. A divider, then the egress line — the heartbeat dot and `egress 0 B`, then the mode-dependent claim, both moved verbatim from `Rail.tsx:98-113`. **The two claims must stay exactly as they are**: on-prem says "Nothing leaves your infrastructure", hosted says "Nothing leaves this server. Never used for training." A hosted deployment must never make the on-prem claim.
6. **Sign out** — the existing `<form action="/logout" method="post">`.

Close on outside click, on Escape, and on route change.

- [ ] **Step 2: Add the keyboard shortcut**

In `UserMenu`, a `useEffect` binding `keydown`: `(e.metaKey || e.ctrlKey) && e.key === ','` → `e.preventDefault()` and `router.push('/dashboard/settings/general')`. Skip when the event target is an input, textarea or `contenteditable`.

- [ ] **Step 3: Replace the placeholder**

Swap the Task 6 placeholder in `Sidebar.tsx` for `<UserMenu>`.

- [ ] **Step 4: Verify**

```bash
cd web && npm run build && npm test
```

In the browser: open the menu; switch language to Oʻzbekcha and confirm the tour copy and empty states change; switch back; confirm Replay the guided tour starts at step one; confirm Sign out works; confirm `⌘,` navigates (it will 404 until Task 11 — that is expected and noted here so it is not mistaken for a bug).

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/_components"
git commit -m "feat(web): user pill menu with language, tour replay and the egress claim"
```

- [ ] **Step 6: Changelog**

Under `[Unreleased]` → `Changed`:

```markdown
- The dashboard now has one sidebar instead of two. Navigation, chat history and
  the account menu share it; chat threads are addressable at
  `/dashboard/c/[chatId]`, so they survive a reload and can be linked to.
```

---

## Stage 3 — Chat pane

### Task 8: The composer

**Files:**
- Create: `web/app/(app)/dashboard/Composer.tsx`
- Modify: `web/app/(app)/dashboard/AskChat.tsx`

**Interfaces:**
- Consumes: `useDocumentUpload` from `@/lib/useDocumentUpload`; the `ask-composer` tour target.
- Produces: `<Composer value onChange onSubmit busy canManage placeholder />`. Consumed by Task 10's empty state.

- [ ] **Step 1: Build it**

Create `web/app/(app)/dashboard/Composer.tsx`, a client component:

- A `<form>` carrying the `ask-composer` tour ref (moved off `AskChat`'s form so the anchor lands on the visible card), styled `rounded-2xl border border-line-control bg-paper-raised shadow-artifact focus-within:border-brain`.
- A `<textarea rows={1}>` that auto-grows: on every change, `el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, MAX) + 'px'` with `MAX = 8 * lineHeight`, and `overflow-y: auto` past it.
- `onKeyDown`: `Enter` without Shift → `e.preventDefault()` and submit; `Shift+Enter` inserts a newline. Do nothing while `e.nativeEvent.isComposing` — an IME candidate window uses Enter to accept, and swallowing it would make the composer unusable for anyone typing in a language that needs one.
- A control row inside the card: on the left, an upload `<label>` rendered **only when `canManage`** — `POST /api/documents` is `getOwner()`-gated, so a member would only ever get a 403. Its `<input type="file" className="sr-only">` is `sr-only` and never `hidden`: `display:none` removes it from the tab order and a keyboard-only user could never reach it (WCAG 2.1 SC 2.1.1). Copy the `accept=".pdf,.docx,.txt,.md"` list from `Sources.tsx:66`.
- On the right, a circular submit button, disabled while `busy` or the trimmed value is empty.

- [ ] **Step 2: Use it**

In `AskChat.tsx`, replace the `<form>` at lines 265-279 with `<Composer>`. `handleSubmit` is unchanged. Move the `composerRef` into `Composer`.

- [ ] **Step 3: Verify**

```bash
cd web && npm run build && npm test
```

In the browser: type a multi-line question with Shift+Enter and confirm the box grows and then scrolls; confirm Enter sends; confirm the send button is disabled while empty; sign in as a member and confirm the upload button is absent; as an owner, upload a file from the composer and confirm it appears in Sources.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/dashboard/Composer.tsx" "web/app/(app)/dashboard/AskChat.tsx"
git commit -m "feat(web): composer card with an auto-growing input and owner-only upload"
```

---

### Task 9: Message rendering

**Files:**
- Create: `web/app/(app)/dashboard/Message.tsx`
- Modify: `web/app/(app)/dashboard/AskChat.tsx`

**Interfaces:**
- Consumes: the `Msg`/`Cite` types currently declared at `AskChat.tsx:8-15` — move them into `Message.tsx` and re-export, so both files share one definition.
- Produces: `<Message msg openMarker onToggleCite citationAnchorRef />`.

- [ ] **Step 1: Extract and restyle**

Create `web/app/(app)/dashboard/Message.tsx` holding `Cite`, `Msg`, `AnswerBody` and a `Message` component.

- **User turn:** `<div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-md bg-paper-sunk px-4 py-2.5 text-body text-ink whitespace-pre-wrap">`. `whitespace-pre-wrap` is new and necessary — the composer can now produce newlines, and without it a multi-line question renders as one run-on line.
- **Assistant turn:** no wrapper card, no `bg-paper-raised`, no `shadow-artifact`, no padding box. Just the prose.
- `AnswerBody` moves across **unchanged** — the `[n]` split, the guard that only renders a chip when a matching citation exists, the `-translate-y-0.5` chip styling.
- The citations footer, the `↗` link to `/s/[chunkId]`, the non-linkable fallback with its explanatory `title`, and the expanded snippet `<figure>` all move across unchanged in behaviour and are restyled flat: the footer keeps its top hairline, the snippet keeps its `border-l-2 border-brain`.
- The `citationAnchorRef` callback that `AskChat` passes for the first cited answer's first chip **must keep landing on the same button** — `CitationHint` positions itself against it.

- [ ] **Step 2: Add the action row**

Under each assistant turn, a row visible on hover or focus-within (`opacity-0 group-hover:opacity-100 focus-within:opacity-100`):

- **Copy** — `navigator.clipboard.writeText(msg.content)`, swapping the label to "Copied" for 2s.
- **Sources** — toggles all citations open/closed for that message.
- **Retry** — calls a `onRetry(msg)` prop that re-sends the preceding user message.

Never `opacity-0` alone for the container: keep it in the tab order and let `focus-within` reveal it, or a keyboard user cannot reach Copy at all.

- [ ] **Step 3: Use it**

In `AskChat.tsx`, replace the `msgs.map(...)` body at lines 181-256 with `<Message>`. `open`, `setOpen` and `firstCitedMessageId` stay in `AskChat`.

- [ ] **Step 4: Verify**

```bash
cd web && npm run build && npm test
```

In the browser: ask a question against seeded documents; confirm inline `[n]` chips still open the snippet; confirm the footer chips and `↗` still open `/s/[chunkId]` in a new tab; confirm the citation hint still appears anchored to the first chip; confirm Copy, Sources and Retry work; confirm a multi-line question keeps its line breaks.

- [ ] **Step 5: Commit**

```bash
git add "web/app/(app)/dashboard"
git commit -m "feat(web): answers as plain prose with a hover action row"
```

---

### Task 10: Empty state and the staged waiting indicator

**Files:**
- Create: `web/app/(app)/dashboard/Thinking.tsx`
- Modify: `web/app/(app)/dashboard/AskChat.tsx`, `AskWorkspace.tsx`, `lib/i18n/{en,ru,uz}.ts`
- Delete: `web/app/(app)/dashboard/GetStarted.tsx`

**Interfaces:**
- Consumes: `<Composer>` (Task 8); `dict.emptyStates.askNoDocuments` (existing); new `dict.chat.*` keys.
- Produces: `dict.chat.greeting.{morning,afternoon,evening}`, `dict.chat.thinking.{searching,reading,writing}`, `dict.chat.footer`.

- [ ] **Step 1: Add the copy to all three dictionaries**

In `lib/i18n/en.ts`, add a `chat` block beside `emptyStates`:

```ts
  chat: {
    greeting: {
      morning: 'Good morning, {name}',
      afternoon: 'Good afternoon, {name}',
      evening: 'Good evening, {name}',
      anonymous: 'What would you like to know?',
    },
    // The three real stages of the pipeline, in order. None of them states a
    // count: the request is one-shot, so the client does not know how many
    // documents were read until the answer lands, and inventing a number in a
    // product whose whole claim is traceability would be indefensible.
    thinking: {
      searching: 'Searching your sources…',
      reading: 'Reading the matches…',
      writing: 'Writing the answer…',
    },
    footer: 'Every answer cites its source. Nothing leaves this server.',
    placeholder: 'Ask your company’s knowledge…',
  },
```

Add the same keys, translated, to `ru.ts` and `uz.ts`. Uzbek must use U+02BB (ʻ) for apostrophes — `i18n.test.ts` fails otherwise.

- [ ] **Step 2: Build the staged indicator**

Create `web/app/(app)/dashboard/Thinking.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

/**
 * The three stages the ask pipeline actually runs, advanced on elapsed time
 * because the request is one-shot and reports no progress. The labels describe
 * real work in the real order — retrieve, then rerank/read, then generate —
 * and deliberately state no quantities, which would have to be invented.
 *
 * The last stage never advances: if the answer is slow, "Writing the answer"
 * stays true until it arrives.
 */
const STAGES = ['searching', 'reading', 'writing'] as const
const AT_MS = [0, 1200, 3500]

export function Thinking({ dict }: { dict: Dictionary['chat']['thinking'] }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const timers = AT_MS.slice(1).map((ms, i) => setTimeout(() => setStage(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <p aria-live="polite" className="text-body-sm text-ink-soft motion-safe:animate-pulse">
      {dict[STAGES[stage]]}
    </p>
  )
}
```

- [ ] **Step 3: Use it**

In `AskChat.tsx`, replace the `busy && <p>Searching your sources…</p>` block at lines 257-261 with `{busy && <Thinking dict={citationHint ? ... : ...} />}` — pass the new `dict.chat.thinking` slice down from `AskWorkspace` as its own prop, following the existing pattern where each child receives only the slice it needs.

- [ ] **Step 4: Fold GetStarted into the empty state**

In `AskChat.tsx`, replace the `msgs.length === 0` placeholder at lines 176-180 with a centred block: the greeting (`{name}` interpolated; pick morning/afternoon/evening from the **client's** local hour in a `useEffect`, so the server's timezone never shows someone "Good morning" at 9pm — render the neutral `anonymous` string until it resolves), the composer directly beneath, then suggestion chips, then `dict.chat.footer`.

Delete the `<h1>Ask</h1>` header at `AskChat.tsx:168-173`.

Move `GetStarted`'s two branches into this surface:

- `workspaceEmpty && canManage` → `emptyStates.askNoDocuments.body` and an "Add documents" link to `/dashboard/sources`.
- `workspaceEmpty && !canManage` → `emptyStates.askNoDocuments.memberBody`. **Keep this distinction.** For a member "empty" means "nothing in your access groups", not "the workspace is empty", and the owner copy would be an instruction they have no permission to follow.
- Otherwise → the greeting plus suggestion chips.

`showGetStarted`'s suggestion-count guard moves with it: a workspace with indexed but unfiled documents must land on the composer, never on a panel with nothing clickable in it. Keep that comment.

```bash
git rm "web/app/(app)/dashboard/GetStarted.tsx"
```

- [ ] **Step 5: Verify**

```bash
cd web && npm run build && npm test
```

`i18n.test.ts` is the one to watch — it fails if any locale is missing a key or uses an ASCII apostrophe in Uzbek.

In the browser: with documents present, confirm the greeting, composer and suggestions render and a suggestion sends immediately; with an empty workspace as owner, confirm the upload prompt; as a member with no groups, confirm the member copy; confirm the staged indicator advances while an answer is generating.

- [ ] **Step 6: Commit**

```bash
git add -A "web/app/(app)/dashboard" web/lib/i18n
git commit -m "feat(web): claude.ai-style empty state and honest staged waiting indicator"
```

- [ ] **Step 7: Changelog**

Under `[Unreleased]` → `Changed`:

```markdown
- The Ask pane is a conversation rather than a form: no page header, answers as
  plain prose instead of cards, a composer card with an auto-growing input
  (Enter sends, Shift+Enter newlines) and owner-only upload, and a waiting
  indicator that names the pipeline's real stages.
```

---

## Stage 4 — Settings

### Task 11: The Settings shell

**Files:**
- Create: `web/app/(app)/dashboard/layout.tsx`, `@settings/default.tsx`, `@settings/(.)settings/[section]/page.tsx`, `settings/[section]/page.tsx`, `settings/SettingsShell.tsx`, `settings/SettingsRow.tsx`

**Interfaces:**
- Produces: `<SettingsRow label description>{control}</SettingsRow>`; `SECTIONS = ['general','account','workspace','data']`. Consumed by Tasks 12-15.

- [ ] **Step 1: Add the parallel slot**

Create `web/app/(app)/dashboard/layout.tsx`:

```tsx
export default function DashboardLayout({
  children,
  settings,
}: {
  children: React.ReactNode
  settings: React.ReactNode
}) {
  return (
    <>
      {children}
      {settings}
    </>
  )
}
```

Create `web/app/(app)/dashboard/@settings/default.tsx` returning `null`. Without it, every route under `/dashboard` 404s on hard navigation — Next needs a default for an unmatched slot.

- [ ] **Step 2: Build the row primitive**

Create `web/app/(app)/dashboard/settings/SettingsRow.tsx`:

```tsx
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-body text-ink">{label}</p>
        {description && <p className="mt-0.5 text-body-sm text-ink-soft">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
```

Also export a `SettingsSection` heading component used above each group.

- [ ] **Step 3: Build the shell**

Create `web/app/(app)/dashboard/settings/SettingsShell.tsx`, a client component taking `{ section, isOwner, asModal, ...data }`. It renders the left sub-nav (General · Account · Workspace *(owner only)* · Data) as `<Link>`s to `/dashboard/settings/<section>`, and dispatches to the section component on the right. Unknown section → General.

When `asModal`, wrap in a fixed overlay: a scrim closing on click, a `role="dialog" aria-modal="true"` panel, a close button, and a `keydown` handler where Escape calls `router.back()`. Trap focus within the panel and restore it to the trigger on close.

- [ ] **Step 4: Both entry points**

`settings/[section]/page.tsx` — a server component resolving `getCurrentUser()`, `issueCsrf()`, the role and the user's current values, rendering `<SettingsShell asModal={false}>`.

`@settings/(.)settings/[section]/page.tsx` — the same, with `asModal`. Extract the data-loading into a shared `loadSettingsData()` so the two pages cannot drift.

- [ ] **Step 5: Verify the interception**

```bash
cd web && npm run build
```

In the browser: from an open thread, press `⌘,` — Settings must appear **as a modal over the thread**, and Escape must return you to that thread with its scroll position intact. Then reload the page on `/dashboard/settings/general` — it must render as a full page.

If the modal does not appear on client navigation, fall back to the mechanism the spec names: drive the same `<SettingsShell>` from a `?settings=<section>` search param, rendered from `dashboard/layout.tsx` via `useSearchParams`. Same components, same URL-addressability, no interception. Take the fallback rather than spending time fighting the router.

- [ ] **Step 6: Commit**

```bash
git add "web/app/(app)/dashboard/layout.tsx" "web/app/(app)/dashboard/@settings" "web/app/(app)/dashboard/settings"
git commit -m "feat(web): settings shell as an intercepted modal route"
```

---

### Task 12: General

**Files:**
- Create: `web/app/(app)/dashboard/settings/sections/General.tsx`
- Modify: `lib/i18n/{en,ru,uz}.ts`

**Interfaces:**
- Consumes: `PATCH /api/me` (Task 3); `SettingsRow` (Task 11); `useTour().start`.

- [ ] **Step 1: Build the section**

Rows, in order:

| Row | Control | Behaviour |
|---|---|---|
| Name | text input | `PATCH /api/me { name }` on blur when changed |
| Email | plain text | read-only — email is the account identity and changing it is a different, larger job |
| Language | `<select>` en/ru/uz | `PATCH { locale }` then `router.refresh()` |
| Appearance | 3-way segmented System/Light/Dark | `PATCH { theme }`, and **set `document.documentElement.dataset.theme` immediately** so the change is instant rather than waiting for a round trip |
| Motion | 2-way segmented System/Reduced | `PATCH { motion }`, same immediate `dataset.motion` write |
| Guided tour | button | `start({ fromBeginning: true })` and close the modal |

Every control autosaves. Show a transient "Saved" only on failure→success transitions; a failed `PATCH` shows an inline error and reverts the control to its previous value — a control that shows a state the server rejected is lying.

- [ ] **Step 2: Copy in all three dictionaries**

Add a `settings` block to `en.ts` covering every label and description above, and translate it into `ru.ts` and `uz.ts`.

- [ ] **Step 3: Verify**

```bash
cd web && npm run build && npm test
```

In the browser: switch Appearance to Dark and confirm the whole app inverts instantly, including Sources, Access and the Settings modal itself; reload and confirm it persists; sign out and back in and confirm it persists (it is stored on the user, not only in the cookie); switch Language to Русский and confirm the app's copy changes; set Motion to Reduced and confirm the heartbeat dot and fade-ins stop.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/dashboard/settings" web/lib/i18n
git commit -m "feat(web): Settings → General with language, appearance and motion"
```

---

### Task 13: Account

**Files:**
- Create: `web/lib/sessions.ts`, `web/lib/sessions.test.ts`, `web/app/api/me/sessions/route.ts`, `settings/sections/Account.tsx`
- Modify: `web/lib/auth/session-store.ts`

**Interfaces:**
- Produces: `describeUserAgent(ua: string | null): string`, `listUserSessions(userId: string, currentSessionId: string): Promise<SessionRow[]>` where `SessionRow = { id: string; device: string; ip: string | null; createdAt: Date; current: boolean }`, `revokeAllSessions(userId: string): Promise<number>`. `Session` gains `sessionId: string`.

- [ ] **Step 1: Write the failing test**

Create `web/lib/sessions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { describeUserAgent } from './sessions'

describe('describeUserAgent', () => {
  it('names the browser and the OS', () => {
    expect(describeUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    )).toBe('Chrome on macOS')
  })

  it('does not mistake Edge or Opera for Chrome — both put Chrome in their UA', () => {
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36 Edg/131.0'))
      .toBe('Edge on Windows')
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36 OPR/117.0'))
      .toBe('Opera on Windows')
  })

  it('does not mistake Chrome for Safari — Chrome puts Safari in its UA too', () => {
    expect(describeUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1',
    )).toBe('Safari on iOS')
  })

  it('falls back rather than showing a raw user-agent string to a user', () => {
    expect(describeUserAgent(null)).toBe('Unknown device')
    expect(describeUserAgent('curl/8.4.0')).toBe('Unknown device')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npx vitest run lib/sessions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `web/lib/sessions.ts`:

```ts
import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions } from '@/lib/db/schema'

export type SessionRow = {
  id: string
  device: string
  ip: string | null
  createdAt: Date
  current: boolean
}

/**
 * A readable device name from a user-agent string. Order matters twice over:
 * Edge and Opera both put "Chrome/" in their UA, and Chrome puts "Safari/" in
 * its own — so the specific tests must run before the general ones or every
 * browser on earth reports as Chrome, or as Safari.
 *
 * No dependency and no geolocation lookup: this list is shown on an air-gapped
 * on-prem install, and calling an IP-geolocation service to prettify it would
 * be a live contradiction of the product's central claim.
 */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? 'Unknown device'
}

export async function listUserSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionRow[]> {
  const rows = await db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
    orderBy: [desc(sessions.createdAt)],
  })
  return rows.map((r) => ({
    id: r.id,
    device: describeUserAgent(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt,
    current: r.id === currentSessionId,
  }))
}

/** Sign out everywhere, INCLUDING the caller — which is what the label says.
 *  The route clears the session cookie so the caller is not left holding a
 *  token whose row no longer exists. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const deleted = await db.delete(sessions).where(eq(sessions.userId, userId)).returning({
    id: sessions.id,
  })
  return deleted.length
}
```

Note the iOS check runs before macOS: an iPhone UA contains "like Mac OS X".

- [ ] **Step 4: Run it to verify it passes**

```bash
cd web && npx vitest run lib/sessions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Carry the session id**

In `web/lib/auth/session-store.ts`, add `sessionId: string` to the `Session` type and return `sessionId: row.id` from `validateSessionToken`. Adding a field breaks no existing caller.

- [ ] **Step 6: The route**

Create `web/app/api/me/sessions/route.ts` with `GET` (returns `listUserSessions(auth.user.id, auth.sessionId)`) and `DELETE` (verifies CSRF, calls `revokeAllSessions(auth.user.id)`, then deletes the session cookie on the response). Both `getCurrentUser()`-gated. Both scope to `auth.user.id` — never a body value.

- [ ] **Step 7: The section**

Build `Account.tsx`: an inline change-password form (three fields, posting to the same server action `app/change-password/actions.ts` exposes, or a small `POST /api/me/password` wrapping `lib/auth/change-password.ts` — reuse the lib, never reimplement the argon2id work); the sessions table (Device · IP · Signed in, current row marked "This device"); and a "Sign out of all devices" button that `DELETE`s and then navigates to `/login`.

Do **not** remove `app/change-password/page.tsx`. It is the redirect target for `mustChangePassword` and lives outside `(app)` precisely so it cannot redirect to itself.

- [ ] **Step 8: Verify**

```bash
cd web && npm run build && npm test
```

In the browser: confirm the sessions list shows your current browser marked as this device; sign in from a second browser and confirm two rows; change your password and confirm you stay signed in here but the other session dies; use Sign out of all devices and confirm you land on `/login`.

- [ ] **Step 9: Commit**

```bash
git add web/lib/sessions.ts web/lib/sessions.test.ts web/lib/auth/session-store.ts web/app/api/me "web/app/(app)/dashboard/settings"
git commit -m "feat(web): Settings → Account with password, active sessions and global sign-out"
```

---

### Task 14: Workspace

**Files:**
- Create: `web/app/api/workspace/route.ts`, `settings/sections/Workspace.tsx`, `web/lib/settings-routes.test.ts`

**Interfaces:**
- Consumes: `getOwner()`.
- Produces: `PATCH /api/workspace { name }`.

- [ ] **Step 1: Write the failing test**

Create `web/lib/settings-routes.test.ts`:

```ts
/**
 * Renaming a workspace is an owner action. It is deliberately NOT in
 * control-plane-gates.test.ts: that table's contract is "routes that change WHO
 * SEES WHAT", and a name changes nothing about access. Widening it to mean
 * "owner-ish routes" would blunt the one test whose meaning is currently exact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { renameWorkspace } from '@/lib/platform/firms'
import { PATCH } from '@/app/api/workspace/route'

vi.mock('@/lib/auth/require-owner', () => ({ getOwner: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/platform/firms', () => ({ renameWorkspace: vi.fn() }))

const patch = (body: unknown) =>
  new Request('http://test/api/workspace', { method: 'PATCH', body: JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
})

describe('PATCH /api/workspace', () => {
  it('403s for a member, and the write does not land', async () => {
    vi.mocked(getOwner).mockResolvedValue(null)
    expect((await PATCH(patch({ name: 'Hijacked' }))).status).toBe(403)
    expect(renameWorkspace).not.toHaveBeenCalled()
  })

  it('renames the session workspace, ignoring an id forged into the body', async () => {
    vi.mocked(getOwner).mockResolvedValue({ userId: 'owner-a', workspaceId: 'firm-a' })
    const res = await PATCH(patch({ id: 'firm-b', workspaceId: 'firm-b', name: 'Acme Bank' }))
    expect(res.status).toBe(200)
    expect(renameWorkspace).toHaveBeenCalledWith('firm-a', 'Acme Bank')
  })

  it('400s on a blank name, without writing', async () => {
    vi.mocked(getOwner).mockResolvedValue({ userId: 'owner-a', workspaceId: 'firm-a' })
    expect((await PATCH(patch({ name: '   ' }))).status).toBe(400)
    expect(renameWorkspace).not.toHaveBeenCalled()
  })
})
```

Before writing the route, **read `web/lib/platform/firms.ts`** — if it already exports a rename helper, use its real name here and in the route; if not, add `renameWorkspace(workspaceId: string, name: string)` to it beside the existing firm helpers.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npx vitest run lib/settings-routes.test.ts
```

Expected: FAIL — route module not found.

- [ ] **Step 3: The route and the section**

Write `app/api/workspace/route.ts` following the shape of `app/api/people/route.ts`: `getOwner()` → 403, `verifyCsrf` → 403, trim the name → 400 if blank or over 120 characters, then `renameWorkspace(owner.workspaceId, name)`.

Build `Workspace.tsx`: the name field; a read-only row showing `DEPLOYMENT_MODE` and the matching egress claim (**the same two strings as the sidebar** — on-prem "Nothing leaves your infrastructure", hosted "Nothing leaves this server. Never used for training."); and three rows linking to `/dashboard/people`, `/dashboard/access` and `/dashboard/integrations`. The whole section renders only for an owner — `SettingsShell` already hides its sub-nav entry.

- [ ] **Step 4: Verify and commit**

```bash
cd web && npx vitest run lib/settings-routes.test.ts && npm test && npm run build
git add web/app/api/workspace web/lib/settings-routes.test.ts web/lib/platform/firms.ts "web/app/(app)/dashboard/settings"
git commit -m "feat(web): Settings → Workspace with rename and the egress claim"
```

---

### Task 15: Data

**Files:**
- Create: `settings/sections/Data.tsx`
- Modify: `web/lib/chat.ts`, `web/app/api/chats/route.ts`, `web/lib/settings-routes.test.ts`

**Interfaces:**
- Produces: `deleteAllChats(workspaceId: string, userId: string): Promise<number>`; `DELETE /api/chats`.

- [ ] **Step 1: Add the failing route test**

Append to `web/lib/settings-routes.test.ts` a `describe('DELETE /api/chats')` block asserting: 401 when signed out with no delete; 403 without CSRF with no delete; and that a successful call passes **the session's** workspace and user id, ignoring any ids in the body. Mock `@/lib/chat`.

- [ ] **Step 2: The lib function**

In `web/lib/chat.ts`, beside `deleteChat`:

```ts
/** Every chat this user owns in this workspace. Scoped to BOTH ids for the
 *  same reason every other read here is: a chat belongs to exactly one
 *  (workspaceId, userId) pair, and "delete my history" must never be able to
 *  mean anyone else's. Messages and citations cascade. */
export async function deleteAllChats(workspaceId: string, userId: string): Promise<number> {
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)))
    .returning({ id: chats.id })
  return deleted.length
}
```

Confirm the `messages` and `citations` foreign keys are `onDelete: 'cascade'` in `schema.ts`. If they are not, delete children explicitly inside a transaction rather than leaving orphans.

- [ ] **Step 3: The route**

Add `DELETE` to `app/api/chats/route.ts` following the file's existing shape, calling `deleteAllChats(auth.workspace.id, auth.user.id)`.

- [ ] **Step 4: The section**

`Data.tsx`: a prose block stating what is stored (documents, chunks and embeddings; questions and answers with their citations; sessions) and where (this server's Postgres, never leaving it); then a destructive "Delete all my conversations" row — a confirm naming the exact count, then the `DELETE`, then `router.push('/dashboard')` and `router.refresh()` so the sidebar empties.

- [ ] **Step 5: Verify and commit**

```bash
cd web && npm test && npm run build
git add web/lib/chat.ts web/app/api/chats/route.ts web/lib/settings-routes.test.ts "web/app/(app)/dashboard/settings"
git commit -m "feat(web): Settings → Data with conversation deletion"
```

- [ ] **Step 6: Changelog**

Under `[Unreleased]` → `Added`:

```markdown
- Settings, opened from the sidebar's account menu (⌘,) as a modal over the app:
  General (name, **language** — the `users.locale` column has had no UI until
  now — appearance, motion, tour replay), Account (change password, active
  sessions, sign out everywhere), Workspace (owner-only rename and the egress
  claim) and Data (what is stored, delete my conversations).
```

---

## Stage 5 — Finish

### Task 16: Atlas reads its colours from the theme

**Files:**
- Modify: `web/app/(app)/dashboard/atlas/Atlas.tsx`, `web/styles/tokens.css`

- [ ] **Step 1: Add the graph tokens**

In `tokens.css`, add a graph block using the same `light-dark()` pattern with fallbacks: `--graph-everyone`, `--graph-engineering`, `--graph-finance`, `--graph-legal`, `--graph-sales`, `--graph-anomaly`, `--graph-orphan`, `--graph-muted`, `--graph-faded`, `--graph-halo`. Light values are the hexes already in `Atlas.tsx:53-108`; `--graph-sales` keeps `#684bff` and `--graph-halo` keeps `#F3EEE3`. Dark values lift each hue for the dark ground and `--graph-halo` becomes the dark paper.

These are graph tokens, not text tokens, so `lib/tokens-contrast.test.ts`'s required-key list must be extended to expect them — otherwise its first assertion fails. Add them to that list and exempt them from the text-contrast assertions, with a comment saying why (canvas marks, never text).

- [ ] **Step 2: Read them at runtime**

In `Atlas.tsx`, replace the module-level colour constants with a `useTheme`-style hook that reads them once per theme change:

```tsx
const readGraphPalette = () => {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string) => s.getPropertyValue(n).trim()
  return { everyone: v('--graph-everyone'), /* …one per token… */ }
}
```

Hold it in state, seed it in a `useEffect` on mount, and refresh it when `data-theme` changes — a `MutationObserver` on `document.documentElement` watching `attributes: ['data-theme']`, plus a `matchMedia('(prefers-color-scheme: dark)')` listener for the `system` case. Repaint the canvas when it changes.

Graph layout, clustering, lens logic and the force simulation are untouched.

- [ ] **Step 3: Verify and commit**

```bash
cd web && npm test && npm run build
```

In the browser as an owner: open Atlas in light, switch to dark in Settings without reloading, and confirm the graph repaints legibly — nodes visible against dark paper, labels readable, lens highlights still distinguishable.

```bash
git add "web/app/(app)/dashboard/atlas/Atlas.tsx" web/styles/tokens.css web/lib/tokens-contrast.test.ts
git commit -m "fix(web): Atlas paints from theme tokens instead of hardcoded cream-ground hexes"
```

---

### Task 17: Sweep and finish

**Files:** any remaining

- [ ] **Step 1: Hunt the hardcoded colours**

```bash
cd web && grep -rn "#[0-9a-fA-F]\{6\}" app lib --include="*.tsx" --include="*.ts" | grep -v tokens.css
```

Every hit is either a theme token reference or a bug that will look wrong in one of the two themes. Fix each or justify it in a comment.

- [ ] **Step 2: Walk every surface in both themes**

Sources · a folder · Access · People · Integrations · Atlas · the source viewer `/s/[chunkId]` · `/platform` and `/platform/usage` · `/login` · `/change-password` · the guided tour, start to finish. Check contrast, borders and focus rings in light and dark. `/platform` keeps its own layout by design; it only needs to look right, not to gain the chat sidebar.

- [ ] **Step 3: Full verification**

```bash
cd web && npm test && npm run build && npx eslint
```

All three must pass with no new warnings.

- [ ] **Step 4: Review the diff against the spec**

Re-read `docs/superpowers/specs/2026-07-27-dashboard-claude-ui-and-settings-design.md` §9 and confirm nothing out of scope was touched — no `engine/` change, no `marketing/` change, `/change-password` still present, no workspace switcher, no cross-firm user management.

```bash
git diff main --stat
```

- [ ] **Step 5: Final changelog and commit**

Fill in anything missed under `[Unreleased]`, including `Removed`:

```markdown
### Removed
- `Rail.tsx`, `Conversations.tsx` and `GetStarted.tsx` — replaced by the single
  sidebar and the new empty state.
```

```bash
git add -A && git commit -m "docs: complete the changelog for the dashboard redesign"
```

---

## Self-Review

**Spec coverage.** §3.1 sidebar → Task 6; §3.1 user pill → Task 7; §3.2 tour anchors → Task 6 step 2 and its verification; §3.3 chat URLs → Task 5; §4.1 tokens → Task 1; §4.2 applying the theme → Tasks 2-4; §4.3 Atlas → Task 16; §5.1-5.2 layout and empty state → Task 10; §5.3 messages → Task 9; §5.4 waiting state → Task 10; §5.5 composer → Task 8; §6.1 shell → Task 11; §6.2 row grammar → Task 11 step 2; §6.3 sections → Tasks 12-15; §6.4 API and schema → Tasks 2, 3, 13, 14, 15; §6.5 authorization → Tasks 3, 14; §7 verification → the tests in Tasks 1, 2, 3, 13, 14, 15 plus Task 17.

**Type consistency.** `Theme`/`Motion` and their guards are defined in Task 2 and used under the same names in Tasks 3, 4 and 12. `CleanProfile` is defined in Task 3 and used in its route. `SessionRow`, `describeUserAgent`, `listUserSessions`, `revokeAllSessions` are defined in Task 13 and used only there. `deleteAllChats` is defined and used in Task 15. `SettingsRow` is defined in Task 11 and used in Tasks 12-15. `Cite`/`Msg` move once, in Task 9, and `AskChat` imports them from there.

**Known deferrals, each with a named resolution rather than a TBD:** the exact `chatOwned` return shape (Task 5 step 1 says to read it and adapt); whether `lib/platform/firms.ts` already has a rename helper (Task 14 step 1 says to read it and either use or add); and route interception behaviour, which Task 11 step 5 resolves by build with an explicit fallback mechanism.
