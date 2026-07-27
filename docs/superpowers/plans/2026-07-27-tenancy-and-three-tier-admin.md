# Tenancy and the three-tier admin model — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the open control plane (stage 0), then split admin into three tiers — platform
operator provisions firms, firm owners manage their own staff, members consume.

**Architecture:** Stage 0 pushes the existing permission predicate into the library-listing surfaces
and owner-gates every mutating route. Stages 1–4 add firm provisioning above workspaces and staff
management inside them, without making `workspace` nullable across the 38 files that call
`getCurrentUser()`.

**Spec:** `docs/superpowers/specs/2026-07-27-tenancy-and-three-tier-admin-design.md`

**Tech Stack:** Next.js 16 / React 19 / Tailwind v3 / Drizzle · FastAPI / Python 3.12 / psycopg3 ·
Postgres 16 + pgvector · vitest + pytest

## Global Constraints

- **Brand is CompanyMind.** Never "CompBrain" in user-visible copy.
- **The engine owns knowledge tables.** Web never touches `documents`, `chunks`, `folders`,
  `groups`, `document_groups`, `group_members`, `query_log` via Drizzle — always through an engine
  endpoint. Web owns `users`, `sessions`, `memberships`, `workspaces`, `chats`, `messages`,
  `citations`, `user_tour_steps`.
- **psycopg3 pooled connections:** use `with conn.transaction()`, never `with conn:`.
- **Engine role parameters default to `"member"`** and `user_id` to `""` — safe-by-default, matching
  `main.py::graph_documents`. A forgetful caller must get *less* access, never more.
- **404, not 403, on the platform tier** so its existence is not disclosed. **403 on the owner tier**
  — a member knows the surface exists, they just may not use it.
- **Deployment mode gates presentation only, never authorization.**
- **Temp passwords are returned exactly once**, never logged, never re-fetchable.
- **Log every notable change in `CHANGELOG.md`** under `[Unreleased]`, in the same commit.
- Commit after each task, tests passing.

---

# Stage 0 — Close the control plane

## Task 1: Permission-scope the engine's document and folder listings

**Files:**
- Modify: `engine/app/library/documents.py::list_documents`
- Modify: `engine/app/library/folders.py::list_folders`
- Modify: `engine/app/main.py:54-63` (`documents_list`, `folders_list`)
- Test: `engine/tests/test_library_scoping.py` (create)

**Interfaces:**
- Produces: `list_documents(conn, workspace_id, folder=None, group_ids=None, all_access=True)` and
  `list_folders(conn, workspace_id, group_ids=None, all_access=True)`. Defaults preserve today's
  behaviour for existing internal callers; the HTTP layer always passes real values.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_library_scoping.py
def test_member_document_list_excludes_documents_outside_their_groups(db_conn, workspace):
    """A member sees only what their groups can open. Asserted against a workspace
    holding a document they cannot see, so empty-vs-empty cannot pass."""
    ws = workspace
    hr = create_group(db_conn, ws, "HR")
    visible = seed_document(db_conn, ws, "handbook.pdf", groups=[hr])
    hidden = seed_document(db_conn, ws, "redundancy-list.xlsx", groups=[create_group(db_conn, ws, "Exec")])
    member = seed_user_in_groups(db_conn, ws, [hr])

    gids, all_access = resolve_access(db_conn, ws, member, "member")
    rows = list_documents(db_conn, ws, None, gids, all_access)
    names = {r["filename"] for r in rows}

    assert "handbook.pdf" in names          # non-vacuous: they DO see their own
    assert "redundancy-list.xlsx" not in names
    assert len(rows) == 1

def test_owner_document_list_sees_everything(db_conn, workspace):
    gids, all_access = resolve_access(db_conn, workspace, owner_id, "owner")
    assert all_access is True
    assert len(list_documents(db_conn, workspace, None, gids, all_access)) == 2
```

- [ ] **Step 2: Run it, confirm it fails** — `uv run pytest tests/test_library_scoping.py -v`.
      Expected: `TypeError` (list_documents takes 3 args) or the hidden file present.

- [ ] **Step 3: Implement**

```python
# documents.py — reuse the ONE predicate's shape (ask/retrieve.py::_perm_sql)
def list_documents(conn, workspace_id, folder=None, group_ids=None, all_access=True):
    sql = ("SELECT id, filename, mime, bytes, status, error, created_at, folder_id "
           "FROM documents d WHERE workspace_id=%s")
    params: list = [workspace_id]
    if not all_access:
        sql += (" AND EXISTS (SELECT 1 FROM document_groups dg "
                "WHERE dg.document_id = d.id AND dg.group_id = ANY(%s::uuid[]))")
        params.append(list(group_ids or []))
    ...
```

Apply the same predicate to `list_folders`'s `LEFT JOIN documents d` (so counts exclude invisible
documents) **and** to its `unfiled` count. Then drop folders whose visible `document_count` is 0
when `not all_access` — an empty "Board Minutes" still discloses that board minutes exist.

- [ ] **Step 4: Wire the HTTP layer** — `documents_list` and `folders_list` gain
      `user_id: str = ""`, `role: str = "member"`, call `resolve_access`, pass through.

- [ ] **Step 5: Run the full engine suite** — `uv run pytest`. Expected: all pass.
- [ ] **Step 6: Commit** + CHANGELOG under Fixed.

## Task 2: Pass the caller through the BFF

**Files:**
- Modify: `web/lib/documents.ts::listDocuments`, `web/lib/folders.ts::listFolders`
- Modify: callers — `web/app/api/documents/route.ts`, `web/app/api/folders/route.ts`,
  `web/app/(app)/dashboard/sources/page.tsx`, `web/app/(app)/dashboard/sources/[folderId]/page.tsx`,
  `web/app/(app)/dashboard/page.tsx` (any listDocuments use)
- Test: `web/lib/documents.test.ts`

- [ ] **Step 1:** `listDocuments(workspaceId, folder, caller)` where
      `caller: { userId: string; role: string }`. **Required, not optional** — an optional caller is
      how this bug returns. TypeScript then flags every call site.
- [ ] **Step 2:** Resolve role once. Add `web/lib/auth/role.ts::getRole(userId, workspaceId)`
      returning `'owner' | 'member'`, reusing the `memberships` lookup `getOwner()` already does.
- [ ] **Step 3:** Update every call site to pass `{ userId, role }` from the session.
- [ ] **Step 4:** `npm run build` — expected: clean, and it *would* have failed before step 3.
- [ ] **Step 5:** Commit + CHANGELOG.

## Task 3: Owner-gate the control plane

**Files:**
- Modify: `web/app/api/documents/[id]/groups/route.ts` (PUT), `web/app/api/documents/route.ts` (POST),
  `web/app/api/documents/[id]/folder/route.ts` (PUT), `web/app/api/groups/route.ts` (POST),
  `web/app/api/groups/[id]/route.ts` (PATCH, DELETE), `web/app/api/groups/[id]/members/route.ts` (PUT),
  `web/app/api/folders/route.ts` (POST), `web/app/api/folders/[id]/route.ts` (PATCH, DELETE),
  `web/app/api/folders/organize/route.ts` (POST), `web/app/api/integrations/telegram/route.ts`
  (GET, POST, DELETE), `web/app/api/telegram-links/[id]/route.ts` (POST),
  `web/app/api/telegram-links/[id]/groups/route.ts` (PUT)
- Test: `web/app/api/control-plane-gates.test.ts` (create)

- [ ] **Step 1: Write the enumerated gate test.** A table of `[method, path]` for every
      control-plane route; each asserts 403 for a member session. **The table is the test** — a
      route added later without a gate must fail here rather than pass silently.
- [ ] **Step 2: Write the escalation-by-effect test.** A member PUTs
      `/api/documents/[id]/groups` adding a hidden document to their group, gets 403, **then runs
      the same ask and still gets no new documents.** Status codes can be right while the write
      lands; this asserts the outcome.
- [ ] **Step 3: Run, confirm both fail.**
- [ ] **Step 4: Implement** — swap `getCurrentUser()` for `getOwner()`, returning 403.
      `GET /api/groups` stays member-reachable (the Access page's read-only explainer needs it);
      `GET /api/documents` stays member-reachable but is now scoped by Task 1.
- [ ] **Step 5:** `npm test` + `npm run build`. Commit + CHANGELOG under **Security**.

## Task 4: Lock chat isolation with a regression test

**Files:** Test: `web/lib/chat.test.ts`

- [ ] **Step 1:** Two users, same workspace, one chat each. Assert `listChats` returns only the
      caller's, `getChatMessages(otherChatId, ws, userId)` is `null`, and rename/delete return false.
      **No production change** — this behaviour is already correct and the test exists to keep it so.
- [ ] **Step 2:** Run, commit.

---

# Stage 1 — Tenancy foundation

## Task 5: Schema

- [ ] `workspaces.suspendedAt`, `users.mustChangePassword`, unique index
      `memberships_one_workspace_per_user` on `(user_id)` in `web/lib/db/schema.ts`.
- [ ] **Before generating the migration**, check no user holds two memberships. If any does, stop
      and report — do not route around it.
- [ ] `npm run db:generate` (never hand-write), migrate, commit + CHANGELOG.

## Task 6: Session-layer enforcement

**Files:** `web/lib/auth/session-store.ts`, `web/lib/auth/require-super-admin.ts`,
`web/app/(app)/layout.tsx`, `web/app/login/actions.ts`

- [ ] **Test first:** suspending a workspace makes `validateSessionToken` return null for its users
      and login refuse them — against the real session store, not a mock.
- [ ] Add `if (workspace.suspendedAt) return null` after workspace resolution.
- [ ] Add `validateSessionUserOnly(token)` — same expiry/blocked checks, **no membership
      requirement**. `getSuperAdmin()` uses it. `validateSessionToken` is unchanged, so all 38
      `getCurrentUser()` call sites keep their non-null workspace.
- [ ] `(app)/layout.tsx`: no workspace **and** a valid super-admin session → redirect `/platform`
      (otherwise `/login` loops forever for an operator who owns no firm).
- [ ] Commit + CHANGELOG.

## Task 7: Password change

**Files:** `web/app/change-password/`, `web/app/api/account/password/route.ts`,
`web/lib/auth/password.ts`, `web/app/(app)/layout.tsx`

- [ ] **Test first:** correct current password rotates the hash, clears `mustChangePassword`, and
      revokes the user's *other* sessions but not the current one; a wrong current password 403s.
- [ ] Implement the route + page, reusing the argon2id path.
- [ ] `(app)/layout.tsx` redirects when `mustChangePassword`. **Document in the spec's own words
      that this is UI-layer hygiene, not a hard gate** — the account's holder knows the password.
- [ ] Commit + CHANGELOG.

---

# Stage 2 — Platform tier

## Task 8: Firm provisioning

**Files:** `engine/app/main.py` (+ `POST /workspaces/{id}/bootstrap`),
`web/lib/platform/firms.ts`, `web/app/api/platform/firms/route.ts`

- [ ] **Test first:** creating a firm is atomic — a failure partway leaves no orphan workspace and
      no orphan user; and the new firm has an Everyone group before its owner first signs in.
- [ ] Engine `bootstrap` wraps the existing `groups.py::ensure_default_group`.
- [ ] `createFirm({ name, ownerEmail, ownerName })` in one Drizzle transaction: workspace → user →
      membership(owner) → then the engine bootstrap call. Returns the temp password once.
- [ ] Commit + CHANGELOG.

## Task 9: Platform UI + suspension + owner reset

**Files:** `web/app/(platform)/platform/` (page, layout, `FirmsPanel.tsx`),
`web/app/api/platform/firms/[id]/suspend/route.ts`,
`web/app/api/platform/firms/[id]/reset-owner-password/route.ts`, `web/app/api/platform/usage/route.ts`

- [ ] **Test first:** suspend deletes every session belonging to that firm's users; the aggregate-only
      assertion extends to all new platform routes (no `question`, no document/chunk text, no
      per-user activity array).
- [ ] Its own route group and layout — no workspace required.
- [ ] Owner password reset applies to owners only, never members.
- [ ] Commit + CHANGELOG.

## Task 10: Retire `/dashboard/admin`

- [ ] Delete `web/app/(app)/dashboard/admin/` and `web/app/api/admin/users/route.ts` (both methods)
      and `web/app/api/admin/users/[id]/block/route.ts`; move the read-only user list to
      `/api/platform/users` and usage to `/api/platform/usage`.
- [ ] **`POST /api/admin/users` is deleted, not moved** — minting an account inside a firm is the
      firm's job. This is the whole point of the tier split.
- [ ] Rail: "Platform" link for super-admins. Commit + CHANGELOG under Removed.

---

# Stage 3 — Firm owner tier

## Task 11: `/dashboard/people`

**Files:** `web/app/(app)/dashboard/people/`, `web/app/api/people/route.ts`,
`web/app/api/people/[id]/block/route.ts`, `web/app/api/people/[id]/reset-password/route.ts`,
`web/lib/auth/admin-users.ts` (refactor)

- [ ] **Test first — the cross-tenant invariant:** an owner of firm A POSTs `/api/people` with firm
      B's id in the body; the account is created in **A**. The body value is ignored, never
      validated. Also: an owner listing people sees only their own firm's.
- [ ] `createUser` takes the workspace from the session. Role selectable owner/member (a firm with
      one admin is a single point of failure). `isSuperAdmin` stays hard-coded false.
- [ ] Group assignment inline, reusing `setGroupMembers`.
- [ ] Commit + CHANGELOG.

---

# Stage 4 — Deployment mode

## Task 12: `DEPLOYMENT_MODE`

**Files:** `web/lib/env.ts`, `web/app/(app)/_components/Rail.tsx:85`, `web/lib/i18n/en.ts` (+ru/uz),
`docker-compose.yml`, `CLAUDE.md`

- [ ] `DEPLOYMENT_MODE: 'hosted' | 'onprem'`, **default `hosted`** — an unset variable must never
      assert an air-gap the deployment does not have.
- [ ] Rail copy per mode; `onprem` hides the Platform nav item. **Authorization unchanged in both.**
- [ ] Keep `web/lib/env.ts` getter-based so `next build` still runs with no env.
- [ ] Commit + CHANGELOG.
