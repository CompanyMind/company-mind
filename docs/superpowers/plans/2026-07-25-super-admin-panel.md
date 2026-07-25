# Super-Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A platform super-admin can create users, block them (killing live sessions immediately), and see aggregate usage — without touching the database.

**Architecture:** `is_super_admin` and `blocked_at` are properties of the *user*, not workspace memberships. Blocking is enforced at `validateSessionToken`, the single choke point every authenticated request already passes through, so one edit covers every surface. Usage figures come from data already recorded — `query_log` and `documents` on the engine side, `users`/`sessions` on the auth side — merged in the BFF, and are **aggregate-only** by test.

**Tech Stack:** Next.js 16 · Drizzle · argon2id (`@node-rs/argon2`) · FastAPI + psycopg3 · vitest · pytest.

**Spec:** `docs/superpowers/specs/2026-07-25-super-admin-panel-design.md`

## Global Constraints

- **Aggregate only.** No endpoint under the admin surface may return question text or a per-user activity row. Enforced by a test in Task 4, not by convention.
- **The first super-admin is seed-only.** The panel creates ordinary users; it never sets `is_super_admin`.
- **Blocking must revoke live sessions**, not merely set a flag — a blocked user must fail on their *next request*, not at cookie expiry.
- **A super-admin cannot block themselves.**
- Auth is sovereign and hand-rolled: argon2id via `web/lib/auth/password.ts`, session tokens stored as sha256 hashes, never plaintext. Do not introduce a third-party auth library.
- Admin routes return **404**, not 403, when the caller is not a super-admin — the panel's existence is not disclosed.
- The engine owns `query_log`, `documents`, `folders`; web owns `users`, `sessions`, `memberships`, `workspaces`. Web must not query knowledge tables directly.
- `next build` must run with **no env and no database**; keep `web/lib/db/client.ts` and `web/lib/env.ts` lazy.
- `server-only` throws under vitest/tsx; web tests live in `web/lib/**/*.test.ts`.
- **psycopg3**: on a pooled connection use `with conn.transaction()`, never `with conn:`.
- Every mutating web route: `getCurrentUser()`/`getSuperAdmin()` first, then `verifyCsrf(req)`, then work.
- Log every change in `CHANGELOG.md` under `[Unreleased]`, same commit.
- Brand is CompanyMind; infra IDs named `compbrain` stay unchanged.
- Engine commands from `engine/`; web from `web/`. Host DSN: `postgres://compbrain:devpass@localhost:5432/compbrain`.

---

## File Structure

**Created:** `web/lib/auth/require-super-admin.ts` · `web/lib/auth/admin-users.ts` · `web/lib/auth/admin-users.test.ts` · `web/lib/usage.ts` · `web/app/api/admin/users/route.ts` · `web/app/api/admin/users/[id]/block/route.ts` · `web/app/api/admin/usage/route.ts` · `web/app/(app)/dashboard/admin/page.tsx` · `web/app/(app)/dashboard/admin/AdminPanel.tsx` · `engine/app/library/usage.py` · `engine/tests/test_usage.py`

**Modified:** `web/lib/db/schema.ts` · `web/lib/auth/session-store.ts` · `web/scripts/seed.ts` · `web/app/login/actions.ts` · `web/app/(app)/_components/Rail.tsx` · `web/app/(app)/layout.tsx` · `engine/app/main.py` · `CHANGELOG.md`

---

### Task 1: Schema and the seeded super-admin

**Files:** Modify `web/lib/db/schema.ts`, `web/scripts/seed.ts`; create a migration; modify `CHANGELOG.md`

**Interfaces:**
- Produces: `users.is_super_admin boolean not null default false`; `users.blocked_at timestamptz`; `npm run seed` marks the first seeded account as super-admin.

- [ ] **Step 1: Add the columns**

In `web/lib/db/schema.ts`, inside `users`, after `onboardingDismissedAt`:

```ts
  // Platform-level, above workspaces — NOT a membership role. Seed-only on
  // purpose: a panel that can mint its own super-admins has no floor.
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  // Set by the admin panel. Blocking also deletes the user's sessions, so this
  // flag is a durable record, not the enforcement mechanism on its own.
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd web && npm run db:generate
DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain npm run db:migrate
```

Confirm the generated SQL adds both columns and nothing else.

- [ ] **Step 3: Mark the seeded owner as super-admin**

Read `web/scripts/seed.ts` first. Where it inserts (or upserts) the owner account, set `isSuperAdmin: true` for that one account only. Print a line on completion naming which email is the platform super-admin, so whoever runs the seed knows.

- [ ] **Step 4: Verify**

```bash
cd web && npm test && npm run build
DATABASE_URL=… npm run seed
```
Then confirm exactly one super-admin exists:
```bash
docker compose exec -T db psql -U compbrain -d compbrain -tAc \
  "SELECT email, is_super_admin, blocked_at FROM users ORDER BY email;"
```

- [ ] **Step 5: CHANGELOG + commit**

`### Added`: "`users.is_super_admin` (seed-only) and `users.blocked_at`; `npm run seed` marks the seeded owner as the platform super-admin and prints which account it is."

```bash
git add web/lib/db/schema.ts web/lib/db/migrations web/scripts/seed.ts CHANGELOG.md
git commit -m "feat: add super-admin and blocked-at user columns"
```

---

### Task 2: Blocking enforcement and the super-admin gate

This is the security core of the feature. Everything else is CRUD on top of it.

**Files:** Create `web/lib/auth/require-super-admin.ts`, `web/lib/auth/admin-users.ts`, `web/lib/auth/admin-users.test.ts`; modify `web/lib/auth/session-store.ts`, `web/app/login/actions.ts`; modify `CHANGELOG.md`

**Interfaces:**
- Produces:
  - `getSuperAdmin(): Promise<{ userId: string } | null>` in `require-super-admin.ts`
  - `blockUser(actorId: string, targetId: string): Promise<'ok' | 'self' | 'notfound'>` and `unblockUser(targetId: string): Promise<boolean>` in `admin-users.ts`
  - `validateSessionToken` returns `null` for a blocked user
  - login refuses a blocked user

- [ ] **Step 1: Write the failing test**

Create `web/lib/auth/admin-users.test.ts`. It is a pure unit test of the self-block guard — the session behaviour is covered by the DB-gated engine-side check in Step 5:

```ts
import { describe, expect, it } from 'vitest'
import { wouldBlockSelf } from './admin-users'

describe('wouldBlockSelf', () => {
  // Blocking yourself is a one-way door out of the only panel that can
  // unblock you. It must be refused before any write happens.
  it('refuses when actor and target are the same user', () => {
    expect(wouldBlockSelf('u1', 'u1')).toBe(true)
  })

  it('allows blocking a different user', () => {
    expect(wouldBlockSelf('u1', 'u2')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/auth/admin-users.test.ts`
Expected: FAIL — cannot resolve `./admin-users`.

- [ ] **Step 3: Enforce blocking at the session choke point**

In `web/lib/auth/session-store.ts::validateSessionToken`, after the user is loaded and before the membership lookup:

```ts
  // Blocking is enforced HERE because every authenticated request already
  // funnels through this function — getCurrentUser, the ask route, the source
  // viewer, every API route. Checking anywhere else would leave a surface open.
  // The session rows are deleted at block time too; this is the belt to that
  // braces, and it also covers a session minted in a race with the block.
  if (user.blockedAt) return null
```

- [ ] **Step 4: Refuse a blocked user at login**

Read `web/app/login/actions.ts`. After the password verification succeeds and before `createSession`, reject a blocked account with the **same generic error message** the wrong-password path uses — a distinct "you are blocked" message tells an attacker the address is real.

- [ ] **Step 5: Implement `admin-users.ts`**

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users } from '@/lib/db/schema'

/** Pure guard, unit-tested: blocking yourself locks you out of the only
 *  surface that could unblock you. */
export function wouldBlockSelf(actorId: string, targetId: string): boolean {
  return actorId === targetId
}

export async function blockUser(
  actorId: string,
  targetId: string,
): Promise<'ok' | 'self' | 'notfound'> {
  if (wouldBlockSelf(actorId, targetId)) return 'self'
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) })
  if (!target) return 'notfound'
  await db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, targetId))
  // Setting the flag alone is theatre — an existing cookie would keep working
  // until it expired. Deleting the sessions is what makes blocking immediate.
  await db.delete(sessions).where(eq(sessions.userId, targetId))
  return 'ok'
}

export async function unblockUser(targetId: string): Promise<boolean> {
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) })
  if (!target) return false
  await db.update(users).set({ blockedAt: null }).where(eq(users.id, targetId))
  return true
}
```

- [ ] **Step 6: Implement `require-super-admin.ts`**

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

// Platform-level, above workspaces — resolved from the users table, never from
// anything client-supplied. Callers 404 rather than 403 on null, so the panel's
// existence is not disclosed to a non-admin.
export async function getSuperAdmin(): Promise<{ userId: string } | null> {
  const auth = await getCurrentUser()
  if (!auth) return null
  const row = await db.query.users.findFirst({
    where: eq(users.id, auth.user.id),
    columns: { isSuperAdmin: true },
  })
  if (!row?.isSuperAdmin) return null
  return { userId: auth.user.id }
}
```

- [ ] **Step 7: Prove blocking is immediate**

This is the assertion the feature turns on. Add to `web/lib/auth/__tests__/session.test.ts` if it has DB access, otherwise create `engine/tests/test_blocking.py` as a DB-gated test that: inserts a user + workspace + membership + a session row; asserts a `SELECT` through the same query shape `validateSessionToken` uses returns the user; sets `blocked_at` and deletes the sessions as `blockUser` does; asserts the session row is gone.

Then verify by hand and record the output in your report:
```bash
docker compose exec -T db psql -U compbrain -d compbrain -tAc \
  "SELECT count(*) FROM sessions WHERE user_id = '<blocked-user-id>';"
```
Expected: `0`.

- [ ] **Step 8: Verify and commit**

```bash
cd web && npm test && npm run build
```

`### Added`: "Blocking a user now revokes their live sessions and is enforced inside `validateSessionToken`, the choke point every authenticated request passes through, so a blocked user fails on their next request rather than at cookie expiry. Login refuses a blocked account with the same generic error as a wrong password, so the panel does not confirm which addresses exist. A super-admin cannot block themselves."

```bash
git add web/lib/auth web/app/login/actions.ts CHANGELOG.md
git commit -m "feat: enforce user blocking at the session choke point"
```

---

### Task 3: Admin users API

**Files:** Create `web/app/api/admin/users/route.ts`, `web/app/api/admin/users/[id]/block/route.ts`; modify `web/lib/auth/admin-users.ts`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `getSuperAdmin`, `blockUser`, `unblockUser` (Task 2); `hashPassword` from `web/lib/auth/password.ts`.
- Produces: `listAdminUsers()` and `createUser(...)` in `admin-users.ts`; `GET`/`POST /api/admin/users`; `POST /api/admin/users/[id]/block`.

- [ ] **Step 1: Add the list and create helpers**

Append to `web/lib/auth/admin-users.ts`:

```ts
import { and, desc, eq, max } from 'drizzle-orm'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'

export type AdminUserRow = {
  id: string
  email: string
  name: string | null
  workspace: string | null
  role: string | null
  createdAt: Date
  lastLoginAt: Date | null
  blocked: boolean
  isSuperAdmin: boolean
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
      isSuperAdmin: users.isSuperAdmin,
      workspace: workspaces.name,
      role: memberships.role,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .orderBy(users.email)

  // Last login = the newest session row for that user. Sessions are deleted on
  // block and on expiry, so this is "recently active", not "ever logged in" —
  // labelled accordingly in the UI rather than overstated.
  const latest = await db
    .select({ userId: sessions.userId, last: max(sessions.createdAt) })
    .from(sessions)
    .groupBy(sessions.userId)
  const lastById = new Map(latest.map((r) => [r.userId, r.last]))

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    workspace: r.workspace,
    role: r.role,
    createdAt: r.createdAt,
    lastLoginAt: lastById.get(r.id) ?? null,
    blocked: r.blockedAt !== null,
    isSuperAdmin: r.isSuperAdmin,
  }))
}

export function generateTempPassword(): string {
  // 18 URL-safe chars from crypto randomness. Shown once to the admin and
  // handed over out of band; there is no in-product change-password flow yet.
  return Buffer.from(crypto.getRandomValues(new Uint8Array(14))).toString('base64url')
}

export async function createUser(opts: {
  email: string
  name: string | null
  workspaceId: string
  role: 'owner' | 'member'
}): Promise<{ id: string; tempPassword: string } | 'duplicate'> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, opts.email) })
  if (existing) return 'duplicate'
  const tempPassword = generateTempPassword()
  const [row] = await db
    .insert(users)
    .values({
      email: opts.email,
      name: opts.name,
      passwordHash: await hashPassword(tempPassword),
      // Never set from the panel — the platform super-admin is seed-only.
      isSuperAdmin: false,
    })
    .returning({ id: users.id })
  await db.insert(memberships).values({
    userId: row.id,
    workspaceId: opts.workspaceId,
    role: opts.role,
  })
  return { id: row.id, tempPassword }
}
```

Check `web/lib/auth/password.ts` for the real export name before writing the import; if it is not `hashPassword`, use whatever it exports.

- [ ] **Step 2: Add the routes**

`web/app/api/admin/users/route.ts` — `GET` lists (super-admin only, 404 otherwise); `POST` creates. `POST` validates a non-empty email containing `@`, a known `workspaceId`, and a role of `owner` or `member`; returns `{ user, tempPassword }` with the password **only in this response**. Both handlers: `getSuperAdmin()` → 404 when null; `POST` also `verifyCsrf(req)` → 403.

`web/app/api/admin/users/[id]/block/route.ts` — `POST` with `{ blocked: boolean }`; `getSuperAdmin()` → 404, `verifyCsrf` → 403, then `blockUser(admin.userId, id)` or `unblockUser(id)`. Map `'self'` → 400 with "you cannot block your own account", `'notfound'` → 404.

- [ ] **Step 3: Verify and commit**

```bash
cd web && npm test && npm run build
```

`### Added`: "Admin users API: list every account with its workspace, role, recent-activity timestamp and blocked status; create a user with a generated temporary password returned exactly once; block/unblock. All super-admin gated, 404 to anyone else."

```bash
git add web/lib/auth/admin-users.ts web/app/api/admin CHANGELOG.md
git commit -m "feat: admin users API — list, create, block"
```

---

### Task 4: Aggregate usage, and the test that keeps it aggregate

**Files:** Create `engine/app/library/usage.py`, `engine/tests/test_usage.py`, `web/lib/usage.ts`, `web/app/api/admin/usage/route.ts`; modify `engine/app/main.py`, `CHANGELOG.md`

**Interfaces:**
- Produces: `usage_summary(conn, days: int = 30) -> dict` in the engine; `GET /usage/summary?days=` (engine); `getUsageSummary(days)` in `web/lib/usage.ts`; `GET /api/admin/usage` (web).

- [ ] **Step 1: Write the failing tests**

Create `engine/tests/test_usage.py` with two tests:

1. `test_usage_summary_counts_questions_and_active_users` — seed a workspace, two users, and several `query_log` rows across two days with different `question_type` values; assert the returned per-workspace totals, the per-day series, the question-type mix, and that `active_users` is a **count** matching the number of distinct users.
2. **`test_usage_summary_never_returns_question_text_or_per_user_rows`** — seed a `query_log` row whose `question` is a distinctive sentinel string (for example `"SENTINEL-SECRET-QUESTION"`), call `usage_summary`, serialize the whole result with `json.dumps`, and assert the sentinel does **not** appear anywhere in it, and that no key in the structure is a user id. This is the aggregate-only guarantee; without it the promise erodes the first time someone adds a drill-down.

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && DATABASE_URL=… uv run pytest tests/test_usage.py -v`
Expected: FAIL — `No module named 'app.library.usage'`.

- [ ] **Step 3: Implement `engine/app/library/usage.py`**

Returns, for a trailing `days` window, a dict shaped:

```python
{
  "days": 30,
  "workspaces": [
    {"workspace_id": ..., "name": ..., "questions": int, "active_users": int,
     "documents_indexed": int, "folders": int,
     "question_types": {"lookup": int, "comparison": int, "aggregate": int, "enumerate": int},
     "lexical_arm_empty": int, "answer_uncited": int}
  ],
  "totals": { ...the same counters summed... },
  "per_day": [{"date": "YYYY-MM-DD", "questions": int, "active_users": int}]
}
```

Every value is a count. `active_users` is `count(DISTINCT user_id)`. **The `question` column is never selected** — that is what makes the sentinel test pass structurally rather than by luck. Degradation counts come from `count(*) FILTER (WHERE 'lexical_arm_empty' = ANY(degraded))`, matching the reason strings Phase 1 introduced.

- [ ] **Step 4: Add the engine endpoint**

```python
@app.get("/usage/summary", dependencies=[Depends(require_secret)])
def usage_summary_endpoint(days: int = 30):
    with get_conn() as conn:
        return usage.usage_summary(conn, days)
```

- [ ] **Step 5: Add the web BFF and route**

`web/lib/usage.ts` calls the engine with the internal secret, mirroring `web/lib/folders.ts`. `web/app/api/admin/usage/route.ts` is `GET`, `getSuperAdmin()` → 404 when null, and merges the engine aggregates with the auth-side total user count.

- [ ] **Step 6: Verify and commit**

```bash
cd engine && DATABASE_URL=… uv run pytest -q
cd ../web && npm test && npm run build
```

`### Added`: "Aggregate usage from data already recorded — questions and active users per day, question-type mix, documents and folders per workspace, and the `lexical_arm_empty` / `answer_uncited` degradation rates the retrieval work introduced. Counts only: a test asserts the response contains no question text and no per-user rows, so the aggregate-only promise is structural rather than a convention."

```bash
git add engine/app/library/usage.py engine/tests/test_usage.py engine/app/main.py web/lib/usage.ts web/app/api/admin/usage CHANGELOG.md
git commit -m "feat: aggregate-only usage summary"
```

---

### Task 5: The admin page

**Files:** Create `web/app/(app)/dashboard/admin/page.tsx`, `web/app/(app)/dashboard/admin/AdminPanel.tsx`; modify `web/app/(app)/_components/Rail.tsx`, `web/app/(app)/layout.tsx`, `CHANGELOG.md`

**Interfaces:** Consumes `/api/admin/users`, `/api/admin/users/[id]/block`, `/api/admin/usage`.

- [ ] **Step 1: The page**

`page.tsx` is a server component: `getSuperAdmin()` → `notFound()` when null, issue CSRF, fetch the workspace list for the create form, render `AdminPanel`.

- [ ] **Step 2: The panel**

`AdminPanel.tsx` (`'use client'`), two sections:

**Usage** — headline counts (questions, active users, documents) over the window, then a per-workspace table. Include the two degradation rates with a one-line explanation of what a high `lexical_arm_empty` means, since that is the number most worth acting on.

**Users** — a table (email, name, workspace, role, last active, status) with a create form and a Block/Unblock button per row. After a successful create, show the temporary password in a bordered callout that states plainly it will not be shown again and that there is no in-product password-change flow yet. The super-admin's own row shows no Block button.

Design language: `bg-paper-raised`, `border-line`, `text-ink` / `text-ink-soft`, `font-display` headings, `text-body`/`text-body-sm`, `font-mono text-[0.6875rem] uppercase tracking-[0.08em]` captions, `text-sovereign-text` for destructive/blocked state.

- [ ] **Step 3: Nav**

`Rail.tsx` takes a new `isSuperAdmin` prop and appends `{ href: '/dashboard/admin', label: 'Admin' }` when true, exactly as it already does for the owner-only Atlas link. `layout.tsx` resolves it via `getSuperAdmin()` and passes it down.

- [ ] **Step 4: Verify by running the app**

Sign in as the seeded super-admin. Confirm: Admin appears in the rail; a non-admin gets a 404 at `/dashboard/admin`; creating a user returns a password once; that user can sign in with it; blocking them makes their next request fail; unblocking restores access. Record what you observed.

- [ ] **Step 5: Verify and commit**

```bash
cd web && npm test && npm run build
```

`### Added`: "Super-admin panel at `/dashboard/admin` — aggregate usage plus user creation and blocking. Rail shows the Admin link only to a super-admin; everyone else 404s on the route."

```bash
git add "web/app/(app)" CHANGELOG.md
git commit -m "feat: super-admin panel page"
```

---

## Done criteria

1. A seeded super-admin creates a working account from the panel; that user signs in with the shown password.
2. Blocking kills the target's live session — their next request fails, verified against the real session store.
3. A super-admin cannot block themselves.
4. A non-super-admin gets 404 on every admin route and sees no Admin link.
5. `test_usage_summary_never_returns_question_text_or_per_user_rows` passes.
6. `npm run build` still succeeds with no env and no database.
