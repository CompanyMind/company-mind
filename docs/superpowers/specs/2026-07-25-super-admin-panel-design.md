# Super-admin panel — design

**Date:** 2026-07-25
**Status:** Approved (decisions locked). Awaiting spec review before planning.

**Locked decisions:** a platform super-admin above all workspaces · analytics built only from data
already recorded, no new instrumentation · **aggregate-only** activity, no per-user drill-down ·
blocking revokes live sessions.

## 1. Why

There is no way to see whether anyone is using the product, and no way to create or stop a user
without opening a database client. Every account today comes from `web/scripts/seed.ts`.

## 2. Role model

A platform super-admin is not a workspace membership — it sits above them — so it is a property of
the user, not a row in `memberships`.

```sql
users.is_super_admin  boolean not null default false
users.blocked_at      timestamptz                       -- null = active
```

**The first super-admin is seed-only**, extending the existing seed-only posture in `CLAUDE.md`. A
panel that can mint its own super-admins has no floor: anyone who reaches it once can guarantee
themselves permanent access. `web/scripts/seed.ts` gains a flag to mark one account.

Everything below that — ordinary users — the panel creates. This is a **deliberate reversal** of
"seed-only accounts" for non-privileged users, taken because the alternative is a product whose
customer cannot onboard their own staff.

Authorization: `web/lib/auth/require-super-admin.ts::getSuperAdmin()`, modelled on the existing
`require-owner.ts::getOwner()`. Every admin route calls it and 404s (not 403s) when it fails, so the
panel's existence is not disclosed to non-admins.

## 3. Blocking

Setting `blocked_at` alone is theatre — a blocked user keeps working until their cookie expires.
Blocking does three things, and all three are tested:

1. Sets `users.blocked_at`.
2. **Deletes every row in `sessions` for that user**, so live sessions die immediately.
3. `web/lib/auth/current-user.ts::getCurrentUser()` returns null for a blocked user, and login
   refuses one, so a new session cannot be minted.

A super-admin cannot block themselves — that is a one-way door out of the panel.

## 4. Analytics — aggregate only

Built from data that already exists: `query_log` (workspace, user, timestamp, `question_type`,
`degraded[]`, model), `sessions` (logins), `documents` (indexed counts), `memberships`, `workspaces`.

Reported per workspace and platform-wide, over a trailing window:

- questions per day
- **active users per day** — `count(DISTINCT user_id)`, a number, never a list
- question-type mix (`lookup` / `comparison` / `aggregate` / `enumerate`)
- documents indexed, and folder count
- degradation rates: share of queries flagged `lexical_arm_empty` and `answer_uncited`

**The invariant: no endpoint under the admin surface returns question text, and none returns a
per-user activity row.** This is enforced by a test, not by convention — the same way folders are
kept from becoming access control. A drill-down "just for support" is exactly how an aggregate-only
promise erodes.

The user list is not a violation of this: it shows who *exists* and when they last logged in, which
blocking decisions require. It never shows what anyone asked.

## 5. Ownership and API

`query_log` and `documents` are knowledge tables the engine owns; `users`, `sessions` and
`memberships` are auth tables web owns. So the usage figures come from both sides and are combined
in the BFF:

| Endpoint | Owner | Returns |
|---|---|---|
| `GET /usage/summary` | engine | per-workspace aggregates from `query_log` + `documents` + `folders`. Counts only — no user ids, no question text. |
| `GET /api/admin/users` | web | every user, their workspaces and roles, created, last login, status |
| `POST /api/admin/users` | web | create: email, name, workspace, role → generated temp password, returned **once** |
| `POST /api/admin/users/[id]/block` | web | block or unblock; block also deletes that user's sessions |
| `GET /api/admin/usage` | web | engine aggregates + auth-side user counts, merged |

Passwords use the existing argon2id path (`web/lib/auth/password.ts`), identical to the seed script.

## 6. UI

One page, `/dashboard/admin`, owner-shell but super-admin gated, with two sections:

- **Users** — a table (email, name, workspace, role, last login, status) with a create form and a
  block/unblock action per row. The generated password is shown once, with a plain warning that it
  will not be shown again.
- **Usage** — headline counts plus a per-workspace table. Numbers only.

## 7. Known gaps, stated rather than hidden

- **No password-change or reset flow.** The admin hands over a generated password out of band; the
  user cannot change it in-product. This is a real gap and the panel says so where the password is
  displayed.
- **"Time spent" is not reported.** The decision was to use existing data, and existing data cannot
  answer it. A proxy computed from login timestamps would look precise and be wrong, so it is
  omitted rather than faked.
- No workspace creation or deletion, no workspace switcher, no cross-workspace document access for
  the super-admin, no per-user activity drill-down.

## 8. Testing

- `getSuperAdmin()` gates every admin route; a non-admin gets 404.
- Blocking deletes sessions **and** `getCurrentUser()` then returns null — asserted against the real
  session store, not mocked.
- A super-admin cannot block themselves.
- Creating a user stores an argon2id hash, never plaintext, and the temp password authenticates once.
- **The aggregate-only test:** every admin usage response is asserted to contain no `question`
  field and no per-user activity array.

## 9. Success criteria

1. A seeded super-admin can create a working user account without touching the database.
2. Blocking a user kills their active session on their next request, not at cookie expiry.
3. The usage page answers "is anyone using this, and is retrieval failing" from real data.
4. No admin endpoint can return what any individual asked.
