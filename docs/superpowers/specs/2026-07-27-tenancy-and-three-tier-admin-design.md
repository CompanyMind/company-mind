# Tenancy and the three-tier admin model — design

**Date:** 2026-07-27
**Status:** Approved (decisions locked). Awaiting spec review before planning.

**Supersedes** `2026-07-25-super-admin-panel-design.md`, whose §7 explicitly deferred workspace
creation and put per-worker account management in the platform admin's hands. That was the wrong
split: it gave the platform tier the firm's job and left the platform tier's own job — provisioning
tenants — impossible outside a shell on the server.

**Locked decisions:** three tiers, platform / firm owner / member · the platform tier manages
**firms, not people** · one codebase, two deployment modes (`hosted`, `onprem`) · deployment mode is
**presentation, never authorization** · forced password change on admin-created accounts · one user,
one workspace.

## 1. The model

| Tier | Who | Creates | Sees | Never |
|---|---|---|---|---|
| **Platform** | the operator (one, seed-only) | firms, and each firm's first owner | firm list, aggregate usage | any document, chunk, or question text |
| **Firm owner** | the customer's admin | staff accounts in **their** firm | their firm only | any other firm |
| **Member** | staff | — | answers from their access groups | documents outside their groups |

A firm = a `workspaces` row. Renting the product to a firm means creating that row plus its first
owner account. Everything below that is the firm's own business, which is why the platform tier
does not create individual workers: today's `POST /api/admin/users` lets the operator mint an
account in any firm, and that route is deleted.

## 2. What is already correct, and must not be re-litigated

Tenant isolation holds today and is enforced at the right place. This is a provisioning and
delegation change, **not a security re-architecture**:

- `web/lib/auth/session-store.ts:46` resolves the workspace from the caller's own membership row.
  It is never client-supplied — there is no `workspace_id` parameter a user could tamper with.
- Every engine read scopes it: `engine/app/library/source.py:10,19` filters `workspace_id` on the
  chunk **and** the document; `engine/app/access.py` scopes groups to the workspace;
  `engine/app/library/groups.py` scopes every group query.
- `resolve_access` remains the single access rule. Tier 3 needs no change at all.

The one place a naive extension breaks this: `admin-users.ts::createUser` takes `workspaceId` as a
parameter, and `POST /api/admin/users` reads it from the request body. The owner-tier route **must
take the workspace from the session and ignore any body value** — that is the single cross-tenant
hole this work could introduce, and §8 tests it directly.

## 3. Deployment modes

`DEPLOYMENT_MODE = 'hosted' | 'onprem'`, **default `hosted`**.

The default is the weaker claim on purpose: an unset variable must never cause the product to assert
an air-gap it does not have. An on-prem install that forgets the flag under-sells itself, which is a
marketing loss, not a false statement.

| | `hosted` | `onprem` |
|---|---|---|
| Who runs it | the operator; many firms in one Postgres | the customer, inside their network; one firm |
| Platform panel | visible to the super-admin | hidden from the nav |
| Rail copy (`Rail.tsx:85`) | `egress 0 B` + "never leaves this server" | `egress 0 B` + "never leaves your infrastructure" |

**Mode gates presentation only.** Authorization stays `getSuperAdmin()` in both modes, and the
platform routes stay gated identically — a mode flag that also grants or revokes access would be a
second, weaker security control shadowing the first.

The claim change is the honest part of going hosted: in `hosted` mode a firm's documents sit in a
database beside another firm's, so "nothing leaves *your* infrastructure" is not available. What
remains true and is still strong: documents never leave this server, are never used to train
anything, and every answer traces to its source.

## 4. Schema

```sql
ALTER TABLE workspaces ADD COLUMN suspended_at timestamptz;          -- null = active
ALTER TABLE users      ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX memberships_one_workspace_per_user ON memberships (user_id);
```

**`suspended_at` on the workspace, not on each user.** Cutting off a non-paying firm by blocking its
employees one at a time is not a mechanism, and it loses the reason. Suspension is enforced at the
same choke point as blocking (§6).

**The unique index makes "one user, one workspace" an invariant rather than an accident.**
`session-store.ts:46` calls `findFirst` on memberships with no ordering, so a user with two
memberships lands in whichever workspace Postgres happens to return. Pinning it costs one index;
a workspace switcher is not being built (YAGNI), so the ambiguity has no upside. Verify no existing
user holds two memberships before the migration — if the index fails to create, that is information,
not a blocker to route around.

## 5. Surfaces

### Platform — `/platform`, its own route group

Not under `/dashboard`. The `(app)` layout requires a workspace, and the platform operator may not
have one (§7); a separate `(platform)` route group with its own minimal layout is what makes that
possible without touching the 38 files that call `getCurrentUser()`.

- **Firms** — name, created, users, documents, status. Create firm (name + first owner's email +
  name) → workspace, Everyone group, owner account, temp password shown **once**. Suspend / resume.
- **Reset a firm owner's password** — the one per-person action the platform tier keeps, because a
  firm's owner is the top of that firm and nobody else can unlock them. Owners only, never members.
- **Usage** — today's aggregate view, moved here unchanged.

`GET /api/admin/users` (read-only list) is kept and moved to `/api/platform/users`; **`POST
/api/admin/users` and the platform-level per-user block route are deleted.** Blocking a person is
the firm's decision; suspending the firm is the operator's.

### Firm owner — `/dashboard/people`

`getOwner()`-gated, workspace from the session. Create staff account (email, name, **role** → temp
password shown once), assign access groups inline via the existing `setGroupMembers` path,
block/unblock, reset password. This is the surface every firm needs on day one.

An owner **may create another owner** in their own firm — a firm with one admin has a single point of
failure the operator then has to unlock by hand (§5, owner password reset). An owner may not create a
platform super-admin; that remains seed-only, and `createUser` already hard-codes `isSuperAdmin:
false` rather than accepting it as a parameter.

**`/dashboard/admin` and `AdminPanel.tsx` are deleted**, not extended. Their two halves move in
opposite directions — usage and the user list up to `/platform`, account creation down to
`/dashboard/people` — so nothing is left for the page to be.

### Any user — `/change-password`

Verify current password, set new, clear `must_change_password`, revoke the user's **other** sessions.

## 6. Enforcement

Blocking already lives at the one place every authenticated request funnels through
(`session-store.ts:44`). Suspension joins it:

```ts
if (user.blockedAt) return null
// ... resolve workspace ...
if (workspace.suspendedAt) return null
```

Suspending a firm also deletes the sessions of every user in it, so live sessions die immediately
rather than at cookie expiry — the same reasoning that made `blockUser` delete sessions. Login
refuses a suspended firm's users for the same reason.

**Forced password change is enforced in the `(app)` layout, not at the session choke point** — a
choke-point check would lock the user out of the very page that fixes it. Stated plainly because it
is weaker than it looks: a user who knows their own temp password could still call an API route
directly without changing it. That is hygiene, not a defence against the account's own holder, and
the proportionate enforcement is the UI redirect. It is not described as a hard gate anywhere.

## 7. The platform operator has no firm

`validateSessionToken` returns null when a user has no membership (`session-store.ts:49`), so a
super-admin who owns no workspace — exactly what the operator is in `hosted` mode — cannot log in at
all today. This blocks the whole tier and is not obvious from the outside.

Fix without a 38-file refactor: add `validateSessionUserOnly(token)` to the session store — same
expiry and blocked checks, no membership requirement — and have `getSuperAdmin()` use it.
`validateSessionToken` keeps requiring a membership, so every product route is unchanged. The `(app)`
layout gains one branch: no workspace **and** a valid super-admin session → redirect to `/platform`
instead of `/login`, which otherwise loops.

The seed keeps creating a workspace for the first admin, so existing installs are unaffected and the
migration is a no-op for them.

## 8. Invariants, each a test

1. **An owner of firm A cannot create a user in firm B.** `POST /api/people` with a forged
   `workspaceId` in the body creates the account in A. The body value is ignored, not validated.
2. An owner listing people sees only their own firm's.
3. **No platform endpoint returns document text, chunk text, or question text.** Extends the
   existing aggregate-only test to the new routes rather than restating the promise in prose.
4. Suspending a firm deletes its users' sessions and `validateSessionToken` then returns null for
   them — asserted against the real session store, not a mock.
5. An admin-created account carries `must_change_password`, and the `(app)` layout redirects it.
6. Creating a firm is atomic: a failure partway leaves no orphan workspace and no orphan user.
7. A new firm has an Everyone group before its owner first signs in, so the Access page is not empty
   on day one. Web must not write knowledge tables, so firm creation calls a new engine
   `POST /workspaces/{id}/bootstrap` that wraps the existing `ensure_default_group`.
8. `memberships` rejects a second workspace for the same user.

## 9. Out of scope, stated rather than discovered later

- **No workspace switcher** and no user in two firms — §4 pins this deliberately.
- **No self-serve signup.** Provisioning stays gated by the operator; a firm cannot create itself.
- **No per-firm billing, plans, or seat limits.** Suspension is the only commercial lever.
- **No platform-level drill-down into a firm's people beyond the read-only list and the owner
  password reset.** The aggregate-only promise from the superseded spec survives intact.
- **No email delivery.** Temp passwords are shown once to whoever created the account and handed
  over out of band, in both tiers. This is a real gap and each surface says so where the password
  appears.

## 10. Success criteria

1. The operator can take a firm from "asked to rent it" to "their owner is signed in" without a
   shell, a database client, or an env var.
2. That firm's owner can create their own staff and grant access without the operator.
3. An owner cannot reach another firm's people or documents by any request they can construct.
4. Suspending a firm ends its sessions on the next request.
5. An admin-created account cannot sit forever on a password its creator knows.
6. `onprem` installs see and claim exactly what they did before this change.
