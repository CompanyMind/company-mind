# Access Groups + Permission-Aware Retrieval — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person only gets answers from documents they're allowed to see. Add access **groups**, tag documents with the groups that may see them, and filter retrieval by the asking person's groups on the web Ask — workspace owners bypass the filter.

**Architecture:** New tables `groups`, `group_members` (web users for now), `document_groups`. The engine `retrieve()` gains `group_ids` + `all_access`; the web ask route resolves the current user's groups and passes them. A seeded **"Everyone"** group + backfilling existing documents to it keeps today's behavior (everyone sees everything) until an admin restricts. Group management + per-document "Visible to" UI in the dashboard.

**Tech Stack:** Drizzle schema + migration; engine psycopg retrieval filter; Next.js route handlers + a Groups admin page + a per-document visibility control.

This is **Plan A** of the access-groups + Telegram spec (`docs/superpowers/specs/2026-07-18-access-groups-and-telegram-design.md`). Plan B (Telegram) reuses everything here.

## Global Constraints

- Every retrieval/query stays `workspace_id`-scoped **and** now group-scoped (except `all_access`).
- **Owners bypass** the group filter (`memberships.role = 'owner'` → `all_access = true`).
- New documents default to the **Everyone** group; the Everyone group is `is_default` and cannot be deleted.
- The permission predicate lives in **one** engine SQL query — no surface re-implements it.
- Reuse `styles/tokens.css`; mono for labels; accent text uses `-text` variants; visible focus + reduced-motion inherited.
- Tests: engine group-filter is TDD; web typechecks + a browser check that a restricted doc is hidden from a non-member.

---

## File Structure

**Web — schema:** `lib/db/schema.ts` (+ `groups`, `groupMembers`, `documentGroups`) + migration + a seed/backfill step.
**Web — created:** `lib/groups.ts` (group queries + a `resolveAccess(user, workspace)` helper), `app/api/groups/route.ts` (list/create), `app/api/groups/[id]/route.ts` (rename/delete + membership), `app/api/documents/[id]/groups/route.ts` (set a doc's groups), `app/(app)/dashboard/access/page.tsx` (+ `AccessManager.tsx`).
**Web — modified:** `lib/engine.ts` (`askEngine` passes groups), `lib/chat.ts` or `app/api/ask/route.ts` (resolve + pass groups), `app/(app)/_components/Rail.tsx` (+ Access nav), `app/(app)/dashboard/Sources.tsx` (+ "Visible to" control), `app/api/documents/route.ts` (default new docs to Everyone; return doc groups in GET).
**Engine — modified:** `app/ask/retrieve.py` (group filter), `app/main.py` (`/ask` body: `group_ids`, `all_access`); test `tests/test_retrieve.py` (+ group-filter cases).

---

## Task 1: Schema — groups, group_members, document_groups

**Files:** Modify `web/lib/db/schema.ts`; generate migration.

**Interfaces:** Produces `groups`, `groupMembers` (web-user principals; `telegramLinkId` added in Plan B), `documentGroups`.

- [ ] **Step 1: Append to `web/lib/db/schema.ts`**

```ts
import { boolean } from 'drizzle-orm/pg-core' // add to the existing import block

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('groups_workspace_idx').on(t.workspaceId)],
)

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('group_members_group_idx').on(t.groupId)],
)

export const documentGroups = pgTable(
  'document_groups',
  {
    documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.groupId] })],
)
```

- [ ] **Step 2: Generate + apply + verify**

```bash
cd web && npm run db:generate
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm run db:migrate
cd .. && docker compose exec -T db psql -U compbrain -d compbrain -c "\dt" | grep -E "groups|group_members|document_groups"
```
Expected: all three tables.

- [ ] **Step 3: Commit** — `git add web/lib/db/schema.ts web/lib/db/migrations && git commit -m "Schema: groups, group_members, document_groups"`

---

## Task 2: Seed "Everyone" + backfill existing docs; group helpers

**Files:** Create `web/lib/groups.ts`; create `web/scripts/backfill-groups.ts`.

**Interfaces:**
- `groups.ts`: `getEveryoneGroup(workspaceId)` (create if missing), `resolveAccess(userId, workspaceId, role)` → `{ groupIds: string[]; allAccess: boolean }`, `listGroups(workspaceId)`, `documentGroupIds(documentId, workspaceId)`, `setDocumentGroups(documentId, workspaceId, groupIds)`.
- backfill script: ensures every workspace has an Everyone group and every existing document is tagged with it.

- [ ] **Step 1: Create `web/lib/groups.ts`**

```ts
import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { groups, groupMembers, documentGroups } from '@/lib/db/schema'

export async function getEveryoneGroup(workspaceId: string): Promise<string> {
  const existing = await db.query.groups.findFirst({
    where: and(eq(groups.workspaceId, workspaceId), eq(groups.isDefault, true)),
  })
  if (existing) return existing.id
  const [g] = await db
    .insert(groups)
    .values({ workspaceId, name: 'Everyone', slug: 'everyone', isDefault: true })
    .returning()
  return g.id
}

export type Access = { groupIds: string[]; allAccess: boolean }

export async function resolveAccess(
  userId: string,
  workspaceId: string,
  role: string,
): Promise<Access> {
  if (role === 'owner') return { groupIds: [], allAccess: true }
  const everyone = await getEveryoneGroup(workspaceId)
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.workspaceId, workspaceId), eq(groupMembers.userId, userId)))
  const ids = new Set<string>([everyone, ...rows.map((r) => r.groupId)])
  return { groupIds: [...ids], allAccess: false }
}

export async function listGroups(workspaceId: string) {
  return db.select().from(groups).where(eq(groups.workspaceId, workspaceId))
}

export async function documentGroupIds(documentId: string, workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: documentGroups.groupId })
    .from(documentGroups)
    .where(and(eq(documentGroups.documentId, documentId), eq(documentGroups.workspaceId, workspaceId)))
  return rows.map((r) => r.groupId)
}

export async function setDocumentGroups(
  documentId: string,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await db
    .delete(documentGroups)
    .where(and(eq(documentGroups.documentId, documentId), eq(documentGroups.workspaceId, workspaceId)))
  if (groupIds.length) {
    // Only groups that belong to this workspace.
    const valid = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.workspaceId, workspaceId), inArray(groups.id, groupIds)))
    if (valid.length) {
      await db
        .insert(documentGroups)
        .values(valid.map((g) => ({ documentId, workspaceId, groupId: g.id })))
    }
  }
}
```

- [ ] **Step 2: Create `web/scripts/backfill-groups.ts`** (idempotent)

```ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq, notInArray, sql as dsql } from 'drizzle-orm'
import { groups, documents, documentGroups, workspaces } from '../lib/db/schema'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL')
  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql, { schema: { groups, documents, documentGroups, workspaces } })

  const wss = await db.select().from(workspaces)
  for (const ws of wss) {
    let ev = await db.query.groups.findFirst({
      where: and(eq(groups.workspaceId, ws.id), eq(groups.isDefault, true)),
    })
    if (!ev) {
      ;[ev] = await db
        .insert(groups)
        .values({ workspaceId: ws.id, name: 'Everyone', slug: 'everyone', isDefault: true })
        .returning()
    }
    // Tag every doc not yet tagged with Everyone.
    const docs = await db.select().from(documents).where(eq(documents.workspaceId, ws.id))
    for (const d of docs) {
      const has = await db.query.documentGroups.findFirst({
        where: and(eq(documentGroups.documentId, d.id), eq(documentGroups.groupId, ev.id)),
      })
      if (!has) await db.insert(documentGroups).values({ documentId: d.id, workspaceId: ws.id, groupId: ev.id })
    }
    console.log(`workspace ${ws.name}: Everyone ready, ${docs.length} docs tagged.`)
  }
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
```
(Prune unused imports `notInArray`/`dsql` if the linter flags them.)

- [ ] **Step 3: Add script + run it**

```bash
cd web && npm pkg set scripts.backfill:groups="tsx scripts/backfill-groups.ts"
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm run backfill:groups
cd .. && docker compose exec -T db psql -U compbrain -d compbrain -c \
"SELECT g.name, count(dg.document_id) docs FROM groups g LEFT JOIN document_groups dg ON dg.group_id=g.id GROUP BY g.name;"
```
Expected: an "Everyone" group with the existing docs count.

- [ ] **Step 4: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
cd .. && git add web/lib/groups.ts web/scripts/backfill-groups.ts web/package.json
git commit -m "Groups helpers + Everyone seed/backfill (idempotent)"
```

---

## Task 3: Engine retrieve — group filter (TDD)

**Files:** Modify `engine/app/ask/retrieve.py`, `engine/app/main.py`; extend `engine/tests/test_retrieve.py`.

**Interfaces:** `retrieve(workspace_id, query, k=8, group_ids: list[str] | None = None, all_access: bool = False)`. When `all_access` is false, only chunks whose document is in `document_groups` for one of `group_ids` are returned. `/ask` body gains `group_ids: list[str] = []` and `all_access: bool = False`.

- [ ] **Step 1: Extend `engine/tests/test_retrieve.py`** — add a test: two docs in ws1, one tagged group A, one tagged group B; `retrieve(ws1, q, group_ids=[A])` returns only the A doc; `all_access=True` returns both.

```python
def _tag(conn, doc_id, ws, group_name):
    gid = uuid.uuid4()
    conn.execute("INSERT INTO groups (id, workspace_id, name, slug, is_default) VALUES (%s,%s,%s,%s,false)",
                 (gid, ws, group_name, f"{group_name}-{gid}"))
    conn.execute("INSERT INTO document_groups (document_id, workspace_id, group_id) VALUES (%s,%s,%s)",
                 (doc_id, ws, gid))
    return str(gid)


def test_retrieval_respects_group_filter():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))
            d_a = _seed_doc(conn, ws, "alpha secret about finance")
            d_b = _seed_doc(conn, ws, "beta secret about legal")
            ga = _tag(conn, d_a, ws, "A")
            _tag(conn, d_b, ws, "B")
    try:
        only_a = retrieve(str(ws), "secret", k=10, group_ids=[ga], all_access=False)
        assert {r.text for r in only_a} == {"alpha secret about finance"}
        both = retrieve(str(ws), "secret", k=10, all_access=True)
        assert len(both) == 2
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```
Refactor the existing `_seed` into a `_seed_doc(conn, ws, text) -> doc_id` helper the new test reuses (returns the document id; no group tagging).

- [ ] **Step 2: Run — expect fail** (new test errors on the extra params / filter).

```bash
cd engine && DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" uv run pytest tests/test_retrieve.py -q
```

- [ ] **Step 3: Update `engine/app/ask/retrieve.py`** — add params + predicate.

```python
def retrieve(
    workspace_id: str,
    query: str,
    k: int = 8,
    group_ids: list[str] | None = None,
    all_access: bool = False,
) -> list[Retrieved]:
    qvec = get_provider().embed([query])[0]
    lit = "[" + ",".join(str(x) for x in qvec) + "]"
    gids = group_ids or []
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT c.id, c.document_id, d.filename, c.page, c.char_start, c.char_end, c.text, "
            "       1 - (c.embedding <=> %s::vector) AS score "
            "FROM chunks c JOIN documents d ON d.id = c.document_id "
            "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            "  AND ( %s OR EXISTS (SELECT 1 FROM document_groups dg "
            "                      WHERE dg.document_id = c.document_id "
            "                        AND dg.group_id = ANY(%s::uuid[])) ) "
            "ORDER BY c.embedding <=> %s::vector "
            "LIMIT %s",
            (lit, workspace_id, all_access, gids, lit, k),
        ).fetchall()
    finally:
        conn.close()
    return [Retrieved(str(r[0]), str(r[1]), r[2], r[3], r[4], r[5], r[6], float(r[7])) for r in rows]
```

- [ ] **Step 4: Update `engine/app/main.py`** `/ask` — accept + forward the params.

```python
class AskBody(BaseModel):
    workspace_id: str
    question: str
    group_ids: list[str] = []
    all_access: bool = False


@app.post("/ask", dependencies=[Depends(require_secret)])
def ask(body: AskBody):
    retrieved = retrieve(body.workspace_id, body.question, group_ids=body.group_ids, all_access=body.all_access)
    result = answer_question(body.question, retrieved)
    ...  # unchanged response shape
```

- [ ] **Step 5: Run — expect pass** (both new + existing retrieval tests). Then full suite `uv run pytest -q`.

- [ ] **Step 6: Commit** — `git add engine/app/ask/retrieve.py engine/app/main.py engine/tests/test_retrieve.py && git commit -m "Engine retrieve: document-group permission filter + owner bypass (TDD)"`

---

## Task 4: Web ask route passes the caller's groups

**Files:** Modify `web/lib/engine.ts` (`askEngine` params), `web/app/api/ask/route.ts`.

**Interfaces:** `askEngine(workspaceId, question, access: { groupIds: string[]; allAccess: boolean })`. The ask route calls `resolveAccess(user.id, workspace.id, role)` and passes it.

- [ ] **Step 1: Update `askEngine` in `web/lib/engine.ts`** to accept `access` and include `group_ids` + `all_access` in the POST body.
- [ ] **Step 2: Update `web/app/api/ask/route.ts`** — resolve the membership role, call `resolveAccess`, pass to `askEngine`. (Role: query `memberships` for this user+workspace; owner → allAccess.)

```ts
import { resolveAccess } from '@/lib/groups'
import { memberships } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
// inside POST, after auth:
const mem = await db.query.memberships.findFirst({
  where: and(eq(memberships.userId, auth.user.id), eq(memberships.workspaceId, auth.workspace.id)),
})
const access = await resolveAccess(auth.user.id, auth.workspace.id, mem?.role ?? 'member')
const result = await askEngine(auth.workspace.id, q, access)
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
cd .. && git add web/lib/engine.ts web/app/api/ask/route.ts
git commit -m "Web ask: resolve caller's groups and pass to the permission-filtered engine"
```

---

## Task 5: Document "Visible to" — default on upload + set API + Sources control

**Files:** Modify `web/app/api/documents/route.ts` (default new docs to Everyone; include `groups` in GET); create `web/app/api/documents/[id]/groups/route.ts`; modify `web/app/(app)/dashboard/Sources.tsx`.

**Interfaces:** `POST /api/documents` also tags the new doc with Everyone. `GET /api/documents` returns `{documents:[{..., groupIds:[]}]}`. `PUT /api/documents/:id/groups {groupIds}` sets a doc's groups (owner/member of workspace only). Sources shows a "Visible to" multi-select per document.

- [ ] **Step 1:** In `web/app/api/documents/route.ts` POST, after inserting the document, tag Everyone: `await setDocumentGroups(doc.id, auth.workspace.id, [await getEveryoneGroup(auth.workspace.id)])`. In GET, join each document to its `documentGroupIds`.
- [ ] **Step 2: Create `web/app/api/documents/[id]/groups/route.ts`** — `PUT` validates auth + workspace ownership of the doc, then `setDocumentGroups`.

```ts
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { documents } from '@/lib/db/schema'
import { setDocumentGroups } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.workspaceId, auth.workspace.id)),
  })
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { groupIds } = (await req.json().catch(() => ({}))) as { groupIds?: string[] }
  await setDocumentGroups(id, auth.workspace.id, Array.isArray(groupIds) ? groupIds : [])
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3:** In `Sources.tsx`, add a compact "Visible to" control per document (a popover/multiselect of the workspace's groups, fetched from `GET /api/groups`), persisting via `PUT /api/documents/:id/groups`. Keep it minimal and on-brand (mono group chips). Default shows "Everyone".
- [ ] **Step 4: Build + commit**

```bash
cd web && npm run build
cd .. && git add "web/app/api/documents" "web/app/(app)/dashboard/Sources.tsx"
git commit -m "Documents: default to Everyone, per-document Visible-to control + API"
```

---

## Task 6: Groups management (API + Access page + rail)

**Files:** Create `web/app/api/groups/route.ts`, `web/app/api/groups/[id]/route.ts`, `web/app/(app)/dashboard/access/page.tsx`, `web/app/(app)/dashboard/access/AccessManager.tsx`; modify `web/app/(app)/_components/Rail.tsx`.

**Interfaces:** `GET /api/groups` (list + members), `POST /api/groups {name}` (create), `PATCH /api/groups/:id {name}` (rename), `DELETE /api/groups/:id` (not the default), `POST /api/groups/:id/members {userId}` / `DELETE …` (manage web-user members). Access page lists groups, members, and lets an owner manage them.

- [ ] **Step 1: `web/app/api/groups/route.ts`** — GET lists this workspace's groups (with member user ids); POST creates a group (slugify name; reject dup slug). Auth + workspace scoped + CSRF on POST.
- [ ] **Step 2: `web/app/api/groups/[id]/route.ts`** — PATCH rename; DELETE (403 if `is_default`); nested member add/remove (or a `/members` subroute). Validate the group belongs to the workspace.
- [ ] **Step 3: `AccessManager.tsx`** (client) — list groups with their members; create/rename/delete; add/remove members (from the workspace's users). On-brand (paper cards, mono group chips, teal accents). Note that owners see all documents regardless of groups.
- [ ] **Step 4: `access/page.tsx`** — server page: `getCurrentUser`, `issueCsrf`, render `<AccessManager csrf={csrf} />` inside the standard `max-w-3xl` shell with an "Access" header.
- [ ] **Step 5: Rail** — add `{ href: '/dashboard/access', label: 'Access' }` to `NAV`.
- [ ] **Step 6: Build + commit**

```bash
cd web && npm run build
cd .. && git add "web/app/api/groups" "web/app/(app)/dashboard/access" "web/app/(app)/_components/Rail.tsx"
git commit -m "Access page: create/manage groups + web-user membership"
```

---

## Task 7: End-to-end verification (Playwright)

**Files:** none.

- [ ] **Step 1:** Bring up db + engine (host) + web (host), migrations + backfill applied, seeded owner login.
- [ ] **Step 2:** As the owner, upload two docs (or reuse). On **Access**, create a group "Finance". On **Sources**, set one doc's "Visible to" = Finance only (remove Everyone).
- [ ] **Step 3 (owner sees all):** Ask a question answered by the Finance-only doc → the owner gets the cited answer (owner bypass).
- [ ] **Step 4 (member is scoped):** Seed a second **member** user (not owner), *not* in Finance. Sign in as them, ask the same question → **insufficient-evidence refusal** for the Finance-only content (they only see Everyone docs). Add them to Finance on Access → now they get the answer.
- [ ] **Step 5:** Assert in DB: `document_groups` reflects the restriction; `query_log` shows both asks.
- [ ] **Step 6:** Stop servers; run suites (`web: npm run test`, `engine: uv run pytest`).

---

## Self-Review (against spec)

**Spec coverage:** §2 groups/group_members/document_groups → T1; seed Everyone + backfill → T2; §3 permission-aware retrieve (group_ids + all_access, owner bypass, one SQL predicate) → T3–T4; §4 groups management + per-doc Visible-to → T5–T6. ✓
**Placeholder scan:** every step has real code or an exact command. ✓
**Type consistency:** `resolveAccess` returns `{groupIds, allAccess}` used by `askEngine`; engine `group_ids`/`all_access` names match the web body; `document_groups(document_id, group_id)` PK consistent across schema, backfill, retrieve, and API. ✓
**Known limits:** `group_members` holds only web users here (Telegram principals added in Plan B); per-document (not per-chunk) visibility; no nested groups; group changes take effect on the next question (no cache to invalidate).

## Next (Plan B)
Telegram: `telegram_bots`/`telegram_links` (+ `group_members.telegram_link_id`), token encryption, Integrations UI (connect + approve + assign groups), the long-polling bot worker calling this same permission-filtered retrieve+answer, and a compose `bot` service.
