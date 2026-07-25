# Onboarding and Document Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a first-time user a guided path — upload documents, watch the AI file them into folders, ask a suggested question and get a cited answer — and replace the flat document list with folders.

**Architecture:** Three stages. **A** adds a flat `folders` table (one folder per document, `NULL` = Unfiled) with engine-owned CRUD, a BFF layer in web, and a folder grid + folder detail UI. **B** adds AI organise, reusing Atlas's existing KMeans + TF-IDF + label pipeline rather than new ML. **C** adds a first-run flow whose progress is derived from real data, plus starter questions built from the caller's own folders. Folders are navigation only — access control stays entirely in `document_groups` × `group_members`.

**Tech Stack:** Next.js 16 (App Router, React 19, Tailwind v3) · Drizzle · FastAPI + psycopg3 · pgvector · scikit-learn (already a dependency) · vitest · pytest.

**Spec:** `docs/superpowers/specs/2026-07-25-onboarding-and-folders-design.md`

## Global Constraints

- **Folders are navigation, NEVER access control.** No code path may read `folder_id` when computing visibility. `engine/app/access.py::resolve_access` and `engine/app/ask/retrieve.py::_perm_sql` must not be modified by any task in this plan.
- **psycopg3**: on a *pooled* connection (`app/db.py::get_conn`) use `with conn.transaction()`, never `with conn:`. A fresh short-lived `with psycopg.connect(DSN) as conn:` in a test is correct and is the established pattern.
- **The engine owns every knowledge-table read and write**; web is a BFF and calls engine endpoints. The schema is defined in Drizzle in `web/lib/db/schema.ts`. `users` is an auth table that web owns outright and may query directly.
- **`next build` must run with no env and no database** — keep `web/lib/db/client.ts` and `web/lib/env.ts` lazy.
- **`server-only` throws under vitest/tsx**; web tests live in `web/lib/**/*.test.ts` and the vitest `include` glob covers nothing else.
- Migrations must apply cleanly to a **fresh, empty database**; never hand-edit an earlier migration.
- **No outbound network on the ingest or ask paths** — deterministic fake providers keep everything runnable with no GPU or credentials.
- `EMBED_DIM = 1024` is pinned in `web/lib/db/schema.ts` and `engine/app/settings.py`. Do not change it.
- Mutating web API routes require the existing `verifyCsrf(req)` check.
- Log every change in `CHANGELOG.md` under `[Unreleased]`, in the same commit.
- Brand is **CompanyMind**; existing infra IDs named `compbrain` stay unchanged.
- Engine commands run from `engine/`; web commands from `web/`. Host DSN: `postgres://compbrain:devpass@localhost:5432/compbrain`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `engine/app/library/folders.py` | Folder CRUD + document assignment. All folder SQL lives here. |
| `engine/app/library/organize.py` | AI organise: cluster unfiled documents into named folders. |
| `engine/app/library/suggest.py` | Starter questions from the caller's visible folders. |
| `engine/tests/test_folders.py` | Folder CRUD, scoping, and the folders-are-not-ACL security test. |
| `engine/tests/test_organize.py` | Clustering determinism, leaves filed documents alone. |
| `engine/tests/test_suggest.py` | Permission scoping of suggestions. |
| `web/lib/folders.ts` | BFF client for the engine's folder endpoints. |
| `web/lib/onboarding.ts` | Pure step-derivation from workspace/user facts. |
| `web/lib/onboarding.test.ts` | Its unit tests. |
| `web/app/api/folders/route.ts` | `GET` list, `POST` create. |
| `web/app/api/folders/[id]/route.ts` | `PATCH` rename, `DELETE`. |
| `web/app/api/folders/organize/route.ts` | `POST` organise. |
| `web/app/api/documents/[id]/folder/route.ts` | `PUT` assign/clear. |
| `web/app/api/onboarding/dismiss/route.ts` | `POST` dismiss. |
| `web/app/(app)/dashboard/sources/FolderGrid.tsx` | Folder cards + Unfiled card + New folder + Organise. |
| `web/app/(app)/dashboard/sources/DocumentList.tsx` | Document rows, extracted from `Sources.tsx`, with Move to…. |
| `web/app/(app)/dashboard/sources/[folderId]/page.tsx` | One folder's documents. |
| `web/app/(app)/dashboard/GetStarted.tsx` | Ask-page empty state + starter questions. |
| `web/app/(app)/dashboard/ProgressStrip.tsx` | Dismissible 3-step strip. |

**Modified**

| File | Change |
|---|---|
| `web/lib/db/schema.ts` | `folders` table; `documents.folderId`; `users.onboardingDismissedAt`. |
| `engine/app/library/documents.py` | `list_documents` returns `folder_id` and accepts a folder filter. |
| `engine/app/main.py` | Folder, organise and suggestion endpoints. |
| `web/app/(app)/dashboard/Sources.tsx` | Becomes upload + `FolderGrid`; document rows move out. |
| `web/app/(app)/dashboard/sources/page.tsx` | Redirects `?doc=` deep links into the document's folder. |
| `web/app/(app)/dashboard/AskWorkspace.tsx` | Renders `GetStarted` when the workspace has no indexed documents. |

---

### Task 1: Schema — folders, `documents.folder_id`, onboarding dismissal

All three schema changes land in one migration so the database is touched once.

**Files:**
- Modify: `web/lib/db/schema.ts`
- Create: `web/lib/db/migrations/<generated>.sql`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: table `folders(id, workspace_id, name, origin, reviewed, keywords, created_at)`; column `documents.folder_id uuid NULL REFERENCES folders(id) ON DELETE SET NULL`; column `users.onboarding_dismissed_at timestamptz NULL`.

- [ ] **Step 1: Add the `folders` table**

In `web/lib/db/schema.ts`, add `uniqueIndex` to the existing import from `drizzle-orm/pg-core`. Declare `folders` **above** the `documents` table (`documents` references it, and declaring first avoids a use-before-declaration read):

```ts
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // 'manual' | 'ai' — an AI folder that hasn't been touched renders a "suggested" chip.
    origin: text('origin').notNull().default('manual'),
    reviewed: boolean('reviewed').notNull().default(false),
    // TF-IDF terms from AI organise; NULL for manual folders. Read by starter questions.
    keywords: text('keywords').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('folders_workspace_idx').on(t.workspaceId),
    uniqueIndex('folders_ws_name_unique').on(t.workspaceId, sql`lower(${t.name})`),
  ],
)
```

- [ ] **Step 2: Add `documents.folderId`**

Inside the `documents` table definition, after `extractedText`:

```ts
    // NAVIGATION ONLY — never access control. Who may see a document is decided
    // solely by document_groups x group_members (engine/app/access.py). Moving a
    // document between folders must not change what anyone can retrieve.
    // ON DELETE SET NULL: deleting a folder must never delete documents.
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
```

- [ ] **Step 3: Add `users.onboardingDismissedAt`**

Inside the `users` table definition, after `name`:

```ts
  // Set when the user dismisses the first-run strip. Onboarding PROGRESS is
  // derived from real data every render; only the dismissal is stored.
  onboardingDismissedAt: timestamp('onboarding_dismissed_at', { withTimezone: true }),
```

- [ ] **Step 4: Generate and apply the migration**

```bash
cd web
npm run db:generate
DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain npm run db:migrate
```

Open the generated SQL and confirm it contains `CREATE TABLE "folders"`, `ALTER TABLE "documents" ADD COLUMN "folder_id"` with `ON DELETE set null`, `ALTER TABLE "users" ADD COLUMN "onboarding_dismissed_at"`, and the unique index on `(workspace_id, lower(name))`. If drizzle-kit emits the unique index without `lower(...)`, correct it by hand in the generated file — a case-sensitive unique index would let "Finance" and "finance" coexist, which the conflict checks in Task 2 assume cannot happen.

- [ ] **Step 5: Verify it applies to a fresh, empty database**

```bash
docker run -d --name folders-migrate-check -e POSTGRES_USER=compbrain -e POSTGRES_PASSWORD=x \
  -e POSTGRES_DB=compbrain -p 55434:5432 pgvector/pgvector:pg16
sleep 8
cd web && DATABASE_URL=postgres://compbrain:x@localhost:55434/compbrain npm run db:migrate
docker rm -f folders-migrate-check
```
Expected: `migrations applied successfully!`

- [ ] **Step 6: Confirm the web suite and build still pass**

```bash
cd web && npm test && npm run build
```
Expected: PASS.

- [ ] **Step 7: CHANGELOG + commit**

Under `### Added`:

```markdown
- `folders` table plus `documents.folder_id` (one folder per document, `NULL` = Unfiled, `ON DELETE
  SET NULL` so deleting a folder never deletes documents) and `users.onboarding_dismissed_at`.
  Folders are navigation only — access control remains entirely in `document_groups` ×
  `group_members`, and no code path reads `folder_id` when computing visibility.
```

```bash
git add web/lib/db/schema.ts web/lib/db/migrations CHANGELOG.md
git commit -m "feat: add folders, documents.folder_id and onboarding dismissal columns"
```

---

### Task 2: Engine folder library and endpoints

**Files:**
- Create: `engine/app/library/folders.py`, `engine/tests/test_folders.py`
- Modify: `engine/app/library/documents.py`, `engine/app/main.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `folders` and `documents.folder_id` from Task 1.
- Produces:
  - `list_folders(conn, workspace_id) -> {"folders": [{"id","name","origin","reviewed","keywords","document_count"}], "unfiled_count": int}`
  - `create_folder(conn, workspace_id, name, origin="manual", keywords=None) -> dict | None` (None on name conflict)
  - `rename_folder(conn, workspace_id, folder_id, name) -> "ok" | "notfound" | "conflict"`
  - `delete_folder(conn, workspace_id, folder_id) -> bool`
  - `set_document_folder(conn, workspace_id, document_id, folder_id: str | None) -> bool`
  - `list_documents(conn, workspace_id, folder: str | None = None)` — `folder` is a folder id, the literal `"unfiled"`, or `None` for all; every returned row gains `folder_id`.
  - Endpoints `GET/POST /folders`, `PATCH/DELETE /folders/{id}`, `PUT /documents/{id}/folder`.

- [ ] **Step 1: Write the failing tests**

Create `engine/tests/test_folders.py`:

```python
import os
import uuid

import psycopg
import pytest

from app.library import folders as lib

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'f',%s)", (ws, str(ws)))
    return str(ws)


def _doc(conn, ws: str, name: str = "d.txt") -> str:
    row = conn.execute(
        "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
        (ws, name),
    ).fetchone()
    return str(row[0])


def _cleanup(ws: str) -> None:
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_create_list_and_count():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            d1, d2 = _doc(conn, ws, "a.txt"), _doc(conn, ws, "b.txt")
        f = lib.create_folder(conn, ws, "Finance")
        assert f is not None
        assert lib.set_document_folder(conn, ws, d1, f["id"]) is True
        out = lib.list_folders(conn, ws)
    try:
        assert [x["name"] for x in out["folders"]] == ["Finance"]
        assert out["folders"][0]["document_count"] == 1
        assert out["unfiled_count"] == 1
        assert d2  # the second document stays unfiled
    finally:
        _cleanup(ws)


def test_duplicate_name_is_rejected_case_insensitively():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        assert lib.create_folder(conn, ws, "Finance") is not None
        assert lib.create_folder(conn, ws, "finance") is None
    _cleanup(ws)


def test_deleting_a_folder_unfiles_its_documents_and_never_deletes_them():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            d = _doc(conn, ws)
        f = lib.create_folder(conn, ws, "Temp")
        lib.set_document_folder(conn, ws, d, f["id"])
        assert lib.delete_folder(conn, ws, f["id"]) is True
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (d,)).fetchone()
    try:
        assert row is not None, "the document was deleted with its folder"
        assert row[0] is None, "the document should be unfiled, not dangling"
    finally:
        _cleanup(ws)


def test_folder_from_another_workspace_is_rejected():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws_a, ws_b = _ws(conn), _ws(conn)
            d = _doc(conn, ws_a)
        other = lib.create_folder(conn, ws_b, "Elsewhere")
        assert lib.set_document_folder(conn, ws_a, d, other["id"]) is False
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (d,)).fetchone()
    assert row[0] is None
    _cleanup(ws_a)
    _cleanup(ws_b)


def test_rename_reports_conflict_and_marks_reviewed():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        a = lib.create_folder(conn, ws, "Alpha", origin="ai")
        lib.create_folder(conn, ws, "Beta")
        assert lib.rename_folder(conn, ws, a["id"], "Beta") == "conflict"
        assert lib.rename_folder(conn, ws, a["id"], "Gamma") == "ok"
        assert lib.rename_folder(conn, ws, str(uuid.uuid4()), "X") == "notfound"
        out = lib.list_folders(conn, ws)
    try:
        gamma = [f for f in out["folders"] if f["name"] == "Gamma"][0]
        assert gamma["reviewed"] is True, "renaming is a review — the suggested chip must clear"
    finally:
        _cleanup(ws)
```

- [ ] **Step 2: Write the security test — this is the one that matters**

Append to `engine/tests/test_folders.py`:

```python
def test_moving_a_document_between_folders_does_not_change_visibility():
    """Folders are navigation. Access is document_groups x group_members and
    nothing else. If a folder move ever changes what a principal can retrieve,
    that is a security defect, not a feature."""
    from app.ask.retrieve import retrieve
    from app.ingest.embed import FakeEmbeddings

    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'sec',%s)", (ws, str(ws)))
            gid = uuid.uuid4()
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'Finance',%s,false)",
                (gid, ws, f"fin-{gid}"),
            )
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'policy.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO document_groups (document_id, workspace_id, group_id) VALUES (%s,%s,%s)",
                (doc, ws, gid),
            )
            vec = FakeEmbeddings(1024).embed(["retention is seven years"])[0]
            lit = "[" + ",".join(str(x) for x in vec) + "]"
            conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                "VALUES (%s,%s,0,'retention is seven years',%s::vector)",
                (doc, ws, lit),
            )
    try:
        before_member, _ = retrieve(str(ws), "retention", k=8, group_ids=[str(gid)], all_access=False)
        before_outsider, _ = retrieve(str(ws), "retention", k=8, group_ids=[], all_access=False)

        with psycopg.connect(DB) as conn:
            f = lib.create_folder(conn, str(ws), "Payroll")
            assert lib.set_document_folder(conn, str(ws), str(doc), f["id"]) is True

        after_member, _ = retrieve(str(ws), "retention", k=8, group_ids=[str(gid)], all_access=False)
        after_outsider, _ = retrieve(str(ws), "retention", k=8, group_ids=[], all_access=False)

        assert [r.chunk_id for r in before_member] == [r.chunk_id for r in after_member]
        assert [r.chunk_id for r in before_outsider] == [r.chunk_id for r in after_outsider]
        assert len(after_member) == 1, "the group member must still see it"
        assert after_outsider == [], "filing a document must not expose it to anyone new"
    finally:
        _cleanup(str(ws))
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd engine && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain uv run pytest tests/test_folders.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.library.folders'`.

- [ ] **Step 4: Implement `engine/app/library/folders.py`**

```python
"""Folder CRUD and document assignment.

Folders are NAVIGATION. They are not access control: who may see a document is
decided solely by document_groups x group_members (see app/access.py). Nothing in
this module is consulted when computing visibility, and nothing here may start
being consulted for it.
"""


def list_folders(conn, workspace_id: str) -> dict:
    rows = conn.execute(
        "SELECT f.id, f.name, f.origin, f.reviewed, f.keywords, count(d.id) "
        "FROM folders f "
        "LEFT JOIN documents d ON d.folder_id = f.id AND d.workspace_id = f.workspace_id "
        "WHERE f.workspace_id=%s "
        "GROUP BY f.id, f.name, f.origin, f.reviewed, f.keywords "
        "ORDER BY f.name",
        (workspace_id,),
    ).fetchall()
    unfiled = conn.execute(
        "SELECT count(*) FROM documents WHERE workspace_id=%s AND folder_id IS NULL",
        (workspace_id,),
    ).fetchone()[0]
    return {
        "folders": [
            {
                "id": str(r[0]),
                "name": r[1],
                "origin": r[2],
                "reviewed": bool(r[3]),
                "keywords": list(r[4] or []),
                "document_count": r[5],
            }
            for r in rows
        ],
        "unfiled_count": unfiled,
    }


def create_folder(
    conn, workspace_id: str, name: str, origin: str = "manual", keywords: list[str] | None = None
) -> dict | None:
    """Create a folder. Returns None when the name is already taken (case-insensitive)."""
    with conn.transaction():
        dup = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s)",
            (workspace_id, name),
        ).fetchone()
        if dup:
            return None
        row = conn.execute(
            "INSERT INTO folders (workspace_id, name, origin, reviewed, keywords) "
            "VALUES (%s,%s,%s,false,%s) RETURNING id, name, origin, reviewed, keywords",
            (workspace_id, name, origin, keywords),
        ).fetchone()
    return {
        "id": str(row[0]),
        "name": row[1],
        "origin": row[2],
        "reviewed": bool(row[3]),
        "keywords": list(row[4] or []),
        "document_count": 0,
    }


def rename_folder(conn, workspace_id: str, folder_id: str, name: str) -> str:
    """'ok' | 'notfound' | 'conflict'. Renaming counts as review, so an AI folder
    stops rendering its 'suggested' chip once the user has named it."""
    with conn.transaction():
        found = conn.execute(
            "SELECT 1 FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
        ).fetchone()
        if not found:
            return "notfound"
        dup = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s) AND id<>%s",
            (workspace_id, name, folder_id),
        ).fetchone()
        if dup:
            return "conflict"
        conn.execute(
            "UPDATE folders SET name=%s, reviewed=true WHERE id=%s AND workspace_id=%s",
            (name, folder_id, workspace_id),
        )
    return "ok"


def delete_folder(conn, workspace_id: str, folder_id: str) -> bool:
    """Documents in the folder become unfiled — the FK is ON DELETE SET NULL.
    Deleting a folder never deletes a document."""
    with conn.transaction():
        cur = conn.execute(
            "DELETE FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
        )
    return cur.rowcount > 0


def set_document_folder(
    conn, workspace_id: str, document_id: str, folder_id: str | None
) -> bool:
    """Assign (or clear, with folder_id=None). False when the document or the
    target folder does not belong to this workspace."""
    with conn.transaction():
        doc = conn.execute(
            "SELECT 1 FROM documents WHERE id=%s AND workspace_id=%s", (document_id, workspace_id)
        ).fetchone()
        if not doc:
            return False
        if folder_id is not None:
            target = conn.execute(
                "SELECT 1 FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
            ).fetchone()
            if not target:
                return False
        conn.execute(
            "UPDATE documents SET folder_id=%s WHERE id=%s AND workspace_id=%s",
            (folder_id, document_id, workspace_id),
        )
    return True
```

- [ ] **Step 5: Add `folder_id` and filtering to `list_documents`**

In `engine/app/library/documents.py`, replace `list_documents` with:

```python
def list_documents(conn, workspace_id: str, folder: str | None = None) -> list[dict]:
    """`folder` is a folder id, the literal 'unfiled', or None for every document."""
    sql = (
        "SELECT id, filename, mime, bytes, status, error, created_at, folder_id "
        "FROM documents WHERE workspace_id=%s"
    )
    params: list = [workspace_id]
    if folder == "unfiled":
        sql += " AND folder_id IS NULL"
    elif folder:
        sql += " AND folder_id=%s"
        params.append(folder)
    sql += " ORDER BY created_at DESC"
    rows = conn.execute(sql, tuple(params)).fetchall()
    dg = conn.execute(
        "SELECT document_id, group_id FROM document_groups WHERE workspace_id=%s",
        (workspace_id,),
    ).fetchall()
    groups_by_doc: dict[str, list[str]] = {}
    for did, gid in dg:
        groups_by_doc.setdefault(str(did), []).append(str(gid))
    return [
        {
            "id": str(r[0]),
            "filename": r[1],
            "mime": r[2],
            "bytes": r[3],
            "status": r[4],
            "error": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "folder_id": str(r[7]) if r[7] else None,
            "group_ids": groups_by_doc.get(str(r[0]), []),
        }
        for r in rows
    ]
```

`create_document` also returns a document dict — add `"folder_id": None` to it so both shapes match.

- [ ] **Step 6: Add the endpoints**

In `engine/app/main.py`, add `from .library import folders as lib_folders` to the imports, change the documents route, and add the folder routes:

```python
@app.get("/documents", dependencies=[Depends(require_secret)])
def documents_list(workspace_id: str, folder: str = ""):
    with get_conn() as conn:
        return {"documents": lib_documents.list_documents(conn, workspace_id, folder or None)}


@app.get("/folders", dependencies=[Depends(require_secret)])
def folders_list(workspace_id: str):
    with get_conn() as conn:
        return lib_folders.list_folders(conn, workspace_id)


class FolderNameBody(BaseModel):
    workspace_id: str
    name: str


@app.post("/folders", dependencies=[Depends(require_secret)])
def folders_create(body: FolderNameBody):
    with get_conn() as conn:
        f = lib_folders.create_folder(conn, body.workspace_id, body.name)
    if f is None:
        raise HTTPException(status_code=409, detail="a folder with that name already exists")
    return {"folder": f}


@app.patch("/folders/{folder_id}", dependencies=[Depends(require_secret)])
def folders_rename(folder_id: str, body: FolderNameBody):
    with get_conn() as conn:
        res = lib_folders.rename_folder(conn, body.workspace_id, folder_id, body.name)
    if res == "notfound":
        raise HTTPException(status_code=404, detail="not found")
    if res == "conflict":
        raise HTTPException(status_code=409, detail="a folder with that name already exists")
    return {"ok": True}


@app.delete("/folders/{folder_id}", dependencies=[Depends(require_secret)])
def folders_delete(folder_id: str, workspace_id: str):
    with get_conn() as conn:
        ok = lib_folders.delete_folder(conn, workspace_id, folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


class DocFolderBody(BaseModel):
    workspace_id: str
    folder_id: str | None = None


@app.put("/documents/{document_id}/folder", dependencies=[Depends(require_secret)])
def document_folder_set(document_id: str, body: DocFolderBody):
    with get_conn() as conn:
        ok = lib_folders.set_document_folder(conn, body.workspace_id, document_id, body.folder_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}
```

- [ ] **Step 7: Run the tests**

```bash
cd engine && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain uv run pytest -q
```
Expected: PASS, including the security test and the pre-existing suite.

- [ ] **Step 8: CHANGELOG + commit**

Under `### Added`:

```markdown
- Engine folder library and endpoints (`engine/app/library/folders.py`): list with per-folder
  document counts and an unfiled count, create/rename/delete, and document assignment. Renaming an
  AI-created folder marks it reviewed. `GET /documents` gained a `folder` filter (a folder id or the
  literal `unfiled`) and now returns `folder_id`. A test asserts that moving a document between
  folders leaves permission-scoped retrieval byte-identical for both a group member and an outsider —
  folders are navigation, and this is what stops them quietly becoming access control.
```

```bash
git add engine/app/library/folders.py engine/app/library/documents.py engine/app/main.py engine/tests/test_folders.py CHANGELOG.md
git commit -m "feat: engine folder CRUD, document assignment and folder-filtered listing"
```

---

### Task 3: Web BFF and API routes for folders

**Files:**
- Create: `web/lib/folders.ts`, `web/app/api/folders/route.ts`, `web/app/api/folders/[id]/route.ts`, `web/app/api/documents/[id]/folder/route.ts`
- Modify: `web/lib/engine.ts`, `web/lib/documents.ts`, `web/app/api/documents/route.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the engine endpoints from Task 2.
- Produces:
  - `web/lib/folders.ts`: `FolderRow = { id, name, origin: 'manual'|'ai', reviewed: boolean, keywords: string[], documentCount: number }`; `listFolders(workspaceId): Promise<{folders: FolderRow[]; unfiledCount: number}>`; `createFolder(workspaceId, name): Promise<FolderRow | 'conflict'>`; `renameFolder(workspaceId, id, name): Promise<'ok'|'notfound'|'conflict'>`; `deleteFolder(workspaceId, id): Promise<boolean>`; `setDocumentFolder(documentId, workspaceId, folderId: string | null): Promise<boolean>`
  - `DocumentRow` in `web/lib/engine.ts` gains `folderId: string | null`.
  - `listDocuments(workspaceId, folder?: string)`.
  - Routes: `GET/POST /api/folders`, `PATCH/DELETE /api/folders/[id]`, `PUT /api/documents/[id]/folder`.

- [ ] **Step 1: Extend the document mapper**

In `web/lib/engine.ts`, add `folderId: string | null` to `DocumentRow`, `folder_id?: string | null` to `EngineDoc`, and `folderId: d.folder_id ?? null` to `mapDocument`.

- [ ] **Step 2: Add the folder filter to `listDocuments`**

In `web/lib/documents.ts`:

```ts
export async function listDocuments(
  workspaceId: string,
  folder?: string,
): Promise<DocumentWithGroups[]> {
  const qs = new URLSearchParams({ workspace_id: workspaceId })
  if (folder) qs.set('folder', folder)
  const res = await fetch(`${env.ENGINE_BASE_URL}/documents?${qs}`, {
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`engine /documents responded ${res.status}`)
  const data = (await res.json()) as { documents: Parameters<typeof mapDocument>[0][] }
  return data.documents.map(mapDocument)
}
```

- [ ] **Step 3: Write `web/lib/folders.ts`**

Mirror `web/lib/groups.ts` exactly in style:

```ts
import 'server-only'
import { env } from '@/lib/env'

// The engine owns the knowledge tables. These are thin clients over its internal API.

async function engineFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.ENGINE_BASE_URL}${path}`, {
    ...init,
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET, ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

export type FolderRow = {
  id: string
  name: string
  origin: 'manual' | 'ai'
  reviewed: boolean
  keywords: string[]
  documentCount: number
}

type EngineFolder = {
  id: string
  name: string
  origin: string
  reviewed: boolean
  keywords?: string[]
  document_count: number
}

function mapFolder(f: EngineFolder): FolderRow {
  return {
    id: f.id,
    name: f.name,
    origin: f.origin === 'ai' ? 'ai' : 'manual',
    reviewed: f.reviewed,
    keywords: f.keywords ?? [],
    documentCount: f.document_count,
  }
}

export async function listFolders(
  workspaceId: string,
): Promise<{ folders: FolderRow[]; unfiledCount: number }> {
  const res = await engineFetch(`/folders?workspace_id=${workspaceId}`)
  if (!res.ok) throw new Error(`engine /folders responded ${res.status}`)
  const data = (await res.json()) as { folders: EngineFolder[]; unfiled_count: number }
  return { folders: data.folders.map(mapFolder), unfiledCount: data.unfiled_count }
}

export async function createFolder(
  workspaceId: string,
  name: string,
): Promise<FolderRow | 'conflict'> {
  const res = await engineFetch('/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 409) return 'conflict'
  if (!res.ok) throw new Error(`engine POST /folders responded ${res.status}`)
  const { folder } = (await res.json()) as { folder: EngineFolder }
  return mapFolder(folder)
}

export async function renameFolder(
  workspaceId: string,
  id: string,
  name: string,
): Promise<'ok' | 'notfound' | 'conflict'> {
  const res = await engineFetch(`/folders/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 404) return 'notfound'
  if (res.status === 409) return 'conflict'
  if (!res.ok) throw new Error(`engine PATCH /folders responded ${res.status}`)
  return 'ok'
}

export async function deleteFolder(workspaceId: string, id: string): Promise<boolean> {
  const res = await engineFetch(`/folders/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine DELETE /folders responded ${res.status}`)
  return true
}

export async function setDocumentFolder(
  documentId: string,
  workspaceId: string,
  folderId: string | null,
): Promise<boolean> {
  const res = await engineFetch(`/documents/${documentId}/folder`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, folder_id: folderId }),
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine PUT /documents/folder responded ${res.status}`)
  return true
}
```

- [ ] **Step 4: Add the API routes**

`web/app/api/folders/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { listFolders, createFolder } from '@/lib/folders'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await listFolders(auth.workspace.id))
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (clean.length > 60) {
    return NextResponse.json({ error: 'name is too long (60 characters max)' }, { status: 400 })
  }
  const f = await createFolder(auth.workspace.id, clean)
  if (f === 'conflict') {
    return NextResponse.json({ error: 'a folder with that name already exists' }, { status: 409 })
  }
  return NextResponse.json({ folder: f }, { status: 201 })
}
```

`web/app/api/folders/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { renameFolder, deleteFolder } from '@/lib/folders'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const res = await renameFolder(auth.workspace.id, id, clean)
  if (res === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (res === 'conflict') {
    return NextResponse.json({ error: 'a folder with that name already exists' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const ok = await deleteFolder(auth.workspace.id, id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

`web/app/api/documents/[id]/folder/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { setDocumentFolder } from '@/lib/folders'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { folderId } = (await req.json().catch(() => ({}))) as { folderId?: string | null }
  const ok = await setDocumentFolder(id, auth.workspace.id, folderId ?? null)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Add the folder filter to the documents route**

In `web/app/api/documents/route.ts`, change `GET` to honour a `folder` search param:

```ts
export async function GET(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const folder = new URL(req.url).searchParams.get('folder') ?? undefined
  return NextResponse.json({ documents: await listDocuments(auth.workspace.id, folder) })
}
```

- [ ] **Step 6: Verify**

```bash
cd web && npm test && npm run build
```
Expected: PASS with no type errors.

- [ ] **Step 7: CHANGELOG + commit**

Under `### Added`:

```markdown
- Web BFF and API routes for folders (`web/lib/folders.ts`, `/api/folders`, `/api/folders/[id]`,
  `/api/documents/[id]/folder`), all CSRF-guarded on mutation. `GET /api/documents` accepts a
  `folder` filter and every document row now carries `folderId`.
```

```bash
git add web/lib/folders.ts web/lib/engine.ts web/lib/documents.ts web/app/api CHANGELOG.md
git commit -m "feat: web BFF and routes for folders"
```

---

### Task 4: Sources becomes a folder grid

**Files:**
- Create: `web/app/(app)/dashboard/sources/FolderGrid.tsx`
- Modify: `web/app/(app)/dashboard/Sources.tsx`, `web/app/(app)/dashboard/sources/page.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `/api/folders`, `/api/documents` from Task 3.
- Produces: `FolderGrid` component; `Sources` renders upload + `FolderGrid` and no longer renders document rows.

- [ ] **Step 1: Build `FolderGrid.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

export type FolderCard = {
  id: string
  name: string
  origin: 'manual' | 'ai'
  reviewed: boolean
  documentCount: number
}

export function FolderGrid({
  folders,
  unfiledCount,
  csrf,
  onChanged,
}: {
  folders: FolderCard[]
  unfiledCount: number
  csrf: string
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    const r = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name: clean }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'could not create folder')
      return
    }
    setName('')
    setCreating(false)
    setError(null)
    onChanged()
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Folders</h2>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          {creating ? 'Cancel' : 'New folder'}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={60}
            className="flex-1 rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper">Create</button>
        </form>
      )}
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}

      {folders.length === 0 && unfiledCount === 0 && (
        <p className="mt-4 rounded-md border border-line px-4 py-6 text-body-sm text-ink-soft">
          No documents yet. Upload PDFs, Word, text or markdown above, then let CompanyMind sort
          them into folders for you.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {folders.map((f) => (
          <li key={f.id}>
            <Link
              href={`/dashboard/sources/${f.id}`}
              className="block rounded-lg border border-line bg-paper-raised p-4 hover:border-brain"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-body text-ink">{f.name}</span>
                {f.origin === 'ai' && !f.reviewed && (
                  <span className="shrink-0 rounded-sm bg-[color-mix(in_srgb,var(--brain)_14%,transparent)] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-brain-text">
                    suggested
                  </span>
                )}
              </div>
              <span className="mt-2 block font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                {f.documentCount} {f.documentCount === 1 ? 'document' : 'documents'}
              </span>
            </Link>
          </li>
        ))}
        {unfiledCount > 0 && (
          <li>
            <Link
              href="/dashboard/sources/unfiled"
              className="block rounded-lg border border-dashed border-line bg-paper p-4 hover:border-brain"
            >
              <span className="text-body text-ink-soft">Unfiled</span>
              <span className="mt-2 block font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                {unfiledCount} {unfiledCount === 1 ? 'document' : 'documents'}
              </span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Rewrite `Sources.tsx` as upload + grid**

Replace the whole component. Keep the upload input, the polling refresh, and the `accept` list exactly as they were; drop the document `<ul>` and the group editor (those move to `DocumentList` in Task 5):

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderGrid, type FolderCard } from './sources/FolderGrid'

export function Sources({ csrf }: { csrf: string }) {
  const [folders, setFolders] = useState<FolderCard[]>([])
  const [unfiledCount, setUnfiledCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/folders')
    if (!r.ok) return
    const d = (await r.json()) as { folders: FolderCard[]; unfiledCount: number }
    setFolders(d.folders)
    setUnfiledCount(d.unfiledCount)
  }, [])

  useEffect(() => {
    refresh()
    // Documents move from 'uploaded' to 'indexed' in the background, which changes
    // the unfiled count, so keep polling while the page is open.
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [refresh])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        const r = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
          body,
        })
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'upload failed')
      }
      await refresh()
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-end">
        <label className="cursor-pointer rounded-md bg-ink px-4 py-2 text-body-sm text-paper">
          {busy ? 'Uploading…' : 'Upload documents'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      <FolderGrid
        folders={folders}
        unfiledCount={unfiledCount}
        csrf={csrf}
        onChanged={refresh}
      />
    </>
  )
}
```

- [ ] **Step 3: Redirect `?doc=` deep links into the document's folder**

Atlas's "Fix" buttons link to `/dashboard/sources?doc=<id>`. That must keep working. In
`web/app/(app)/dashboard/sources/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { listDocuments } from '@/lib/documents'
import { Sources } from '../Sources'

export const runtime = 'nodejs'

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>
}) {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  const { doc } = await searchParams

  // Deep link from Atlas: send the caller to wherever that document actually lives.
  if (doc && auth) {
    const target = (await listDocuments(auth.workspace.id)).find((d) => d.id === doc)
    if (target) redirect(`/dashboard/sources/${target.folderId ?? 'unfiled'}?doc=${doc}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-2">
        <h1 className="font-display text-2xl text-ink">Sources</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Everything in <strong className="text-ink">{auth?.workspace.name}</strong>’s brain. Files
          never leave your infrastructure.
        </p>
      </header>
      <Sources csrf={csrf} />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
cd web && npm test && npm run build
```
Expected: PASS. `Sources` no longer takes `initialDoc`, so confirm nothing else passes it.

- [ ] **Step 5: CHANGELOG + commit**

Under `### Changed`:

```markdown
- Sources is now a folder grid instead of one flat list of every document — the flat list was already
  unusable at the 150-document demo corpus. Folder cards show a document count and a "suggested" chip
  for AI folders nobody has touched yet; an Unfiled card appears whenever unfiled documents exist.
  Atlas's `?doc=` deep links still work: they now redirect into whichever folder the document is in.
```

```bash
git add "web/app/(app)/dashboard" CHANGELOG.md
git commit -m "feat: replace the flat sources list with a folder grid"
```

---

### Task 5: Folder detail page with Move to…

**Files:**
- Create: `web/app/(app)/dashboard/sources/DocumentList.tsx`, `web/app/(app)/dashboard/sources/[folderId]/page.tsx`, `web/app/(app)/dashboard/sources/[folderId]/FolderHeader.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `/api/documents?folder=`, `/api/folders`, `/api/documents/[id]/folder`, `/api/groups`.
- Produces: `DocumentList` — the document rows, the access-group editor (carried over unchanged from the old `Sources.tsx`), and a Move to… select.

- [ ] **Step 1: Build `DocumentList.tsx`**

This is the old `Sources.tsx` row rendering plus a folder select. Read the pre-Task-4 version of `Sources.tsx` in git history (`git show HEAD~1:web/app/\(app\)/dashboard/Sources.tsx`) and carry the row markup and group-toggle logic across verbatim so the visuals do not drift.

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'

type Doc = {
  id: string
  filename: string
  status: 'uploaded' | 'parsing' | 'indexed' | 'failed'
  error: string | null
  bytes: number
  groupIds: string[]
  folderId: string | null
}
type Group = { id: string; name: string; isDefault: boolean }
type FolderOption = { id: string; name: string }

const STATUS_LABEL: Record<Doc['status'], string> = {
  uploaded: 'Queued',
  parsing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

export function DocumentList({
  csrf,
  folder,
  initialDoc,
}: {
  csrf: string
  folder: string
  initialDoc?: string
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [editing, setEditing] = useState<string | null>(initialDoc ?? null)

  const refresh = useCallback(async () => {
    const [dr, gr, fr] = await Promise.all([
      fetch(`/api/documents?folder=${encodeURIComponent(folder)}`),
      fetch('/api/groups'),
      fetch('/api/folders'),
    ])
    if (dr.ok) setDocs((await dr.json()).documents)
    if (gr.ok) setGroups((await gr.json()).groups)
    if (fr.ok) setFolders((await fr.json()).folders)
  }, [folder])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [refresh])

  async function toggleGroup(doc: Doc, groupId: string) {
    const has = doc.groupIds.includes(groupId)
    const groupIds = has ? doc.groupIds.filter((g) => g !== groupId) : [...doc.groupIds, groupId]
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, groupIds } : d)))
    await fetch(`/api/documents/${doc.id}/groups`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ groupIds }),
    })
  }

  async function move(doc: Doc, folderId: string) {
    await fetch(`/api/documents/${doc.id}/folder`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ folderId: folderId === 'unfiled' ? null : folderId }),
    })
    await refresh()
  }

  function visibleLabel(doc: Doc) {
    const names = groups.filter((g) => doc.groupIds.includes(g.id)).map((g) => g.name)
    return names.length ? names.join(', ') : 'No one'
  }

  return (
    <ul className="mt-4 divide-y divide-line rounded-md border border-line">
      {docs.length === 0 && (
        <li className="px-4 py-6 text-body-sm text-ink-soft">This folder is empty.</li>
      )}
      {docs.map((d) => (
        <li key={d.id} id={`doc-${d.id}`} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="truncate text-body text-ink">{d.filename}</span>
            <span
              className={
                d.status === 'indexed'
                  ? 'text-body-sm text-brain-text'
                  : d.status === 'failed'
                    ? 'text-body-sm text-sovereign-text'
                    : 'text-body-sm text-ink-soft'
              }
              title={d.error ?? undefined}
            >
              {STATUS_LABEL[d.status]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-ink-soft">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em]">
              visible to: {visibleLabel(d)}
            </span>
            <button
              onClick={() => setEditing(editing === d.id ? null : d.id)}
              className="underline underline-offset-2 hover:text-ink"
            >
              {editing === d.id ? 'done' : 'edit'}
            </button>
            <label className="ml-auto flex items-center gap-1">
              <span className="sr-only">Move {d.filename} to folder</span>
              <select
                value={d.folderId ?? 'unfiled'}
                onChange={(e) => move(d, e.target.value)}
                className="rounded-md border border-line bg-paper px-2 py-1 text-body-sm text-ink-soft"
              >
                <option value="unfiled">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editing === d.id && (
            <>
              <p className="mt-2 text-body-sm text-ink-soft">
                Access is set here, not by the folder — moving a document between folders never
                changes who can see it.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {groups.map((g) => {
                  const on = d.groupIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGroup(d, g.id)}
                      data-on={on}
                      className="rounded-md border border-line px-2.5 py-1 text-body-sm text-ink-soft data-[on=true]:border-brain data-[on=true]:bg-[color-mix(in_srgb,var(--brain)_12%,transparent)] data-[on=true]:text-brain-text"
                    >
                      {on ? '✓ ' : ''}
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Build the folder detail page**

`web/app/(app)/dashboard/sources/[folderId]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { listFolders } from '@/lib/folders'
import { DocumentList } from '../DocumentList'
import { FolderHeader } from './FolderHeader'

export const runtime = 'nodejs'

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>
  searchParams: Promise<{ doc?: string }>
}) {
  const auth = await getCurrentUser()
  if (!auth) notFound()
  const { folderId } = await params
  const { doc } = await searchParams
  const csrf = await issueCsrf()

  const { folders } = await listFolders(auth.workspace.id)
  const folder = folders.find((f) => f.id === folderId)
  if (folderId !== 'unfiled' && !folder) notFound()

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Link
        href="/dashboard/sources"
        className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← Sources
      </Link>
      {folder ? (
        <FolderHeader id={folder.id} name={folder.name} csrf={csrf} />
      ) : (
        <h1 className="mt-3 font-display text-2xl text-ink">Unfiled</h1>
      )}
      <DocumentList csrf={csrf} folder={folderId} initialDoc={doc} />
    </div>
  )
}
```

- [ ] **Step 3: Build `FolderHeader.tsx` (rename + delete)**

`web/app/(app)/dashboard/sources/[folderId]/FolderHeader.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function FolderHeader({ id, name, csrf }: { id: string; name: string; csrf: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const clean = value.trim()
    if (!clean || clean === name) {
      setEditing(false)
      return
    }
    const r = await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name: clean }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'could not rename')
      return
    }
    setEditing(false)
    setError(null)
    router.refresh()
  }

  async function remove() {
    if (
      !confirm(
        `Delete the folder “${name}”?\n\nThe documents inside it are NOT deleted — they move to Unfiled.`,
      )
    ) {
      return
    }
    const r = await fetch(`/api/folders/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    })
    if (r.ok) router.push('/dashboard/sources')
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {editing ? (
        <form onSubmit={save} className="flex flex-1 gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            className="flex-1 rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper">Save</button>
        </form>
      ) : (
        <h1 className="font-display text-2xl text-ink">{name}</h1>
      )}
      <div className="flex shrink-0 gap-3 text-body-sm text-ink-soft">
        <button onClick={() => setEditing((v) => !v)} className="underline underline-offset-2 hover:text-ink">
          {editing ? 'Cancel' : 'Rename'}
        </button>
        <button onClick={remove} className="underline underline-offset-2 hover:text-sovereign-text">
          Delete
        </button>
      </div>
      {error && <p className="text-body-sm text-sovereign-text">{error}</p>}
    </div>
  )
}
```

Add `FolderHeader` to the created-files list when committing.

- [ ] **Step 4: Verify**

```bash
cd web && npm test && npm run build
```
Expected: PASS.

- [ ] **Step 5: CHANGELOG + commit**

Under `### Added`:

```markdown
- Folder detail pages (`/dashboard/sources/[folderId]`, plus the literal `unfiled`) listing that
  folder's documents with the existing access-group editor, a **Move to…** select per document, and
  folder rename/delete. Deleting a folder moves its documents to Unfiled and says so in the
  confirmation. Deliberately not drag-and-drop: it breaks on touch and by keyboard. The access
  editor now states in one line that folders never change who can see a document.
```

```bash
git add "web/app/(app)/dashboard/sources" CHANGELOG.md
git commit -m "feat: folder detail page with move-to and rename/delete"
```

---

### Task 6: AI organise — engine

**Files:**
- Create: `engine/app/library/organize.py`, `engine/tests/test_organize.py`
- Modify: `engine/app/main.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `create_folder`/`set_document_folder` (Task 2); `engine/app/graph/cluster.py::cluster_docs`, `keywords_per_cluster`; `engine/app/graph/label.py::label_cluster`; `engine/app/ask/answer.py::get_chat_call`.
- Produces: `organize_unfiled(conn, workspace_id) -> dict` returning `{"folders": [{"id","name","document_count"}], "organized": int}`; raises `NothingToOrganize` when there is no eligible document. Endpoint `POST /folders/organize`.

- [ ] **Step 1: Write the failing tests**

Create `engine/tests/test_organize.py`:

```python
import os
import uuid

import psycopg
import pytest

from app.ingest.embed import FakeEmbeddings
from app.library import folders as lib_folders
from app.library.organize import NothingToOrganize, organize_unfiled

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

EMB = FakeEmbeddings(1024)


def _seed(conn, ws, filename: str, text: str) -> str:
    doc = conn.execute(
        "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
        (ws, filename),
    ).fetchone()[0]
    lit = "[" + ",".join(str(x) for x in EMB.embed([text])[0]) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
        "VALUES (%s,%s,0,%s,%s::vector)",
        (doc, ws, text, lit),
    )
    return str(doc)


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'o',%s)", (ws, str(ws)))
    return str(ws)


def _cleanup(ws):
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_organize_files_every_unfiled_document_and_is_deterministic():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            for i in range(8):
                _seed(conn, ws, f"doc{i}.txt", f"document number {i} about topic {i % 2}")
        first = organize_unfiled(conn, ws)
        # Everything is filed now, so a second run has nothing left to do.
        with pytest.raises(NothingToOrganize):
            organize_unfiled(conn, ws)
        listing = lib_folders.list_folders(conn, ws)
    try:
        assert first["organized"] == 8
        assert listing["unfiled_count"] == 0
        assert sum(f["document_count"] for f in listing["folders"]) == 8
        assert all(f["origin"] == "ai" for f in listing["folders"])
        assert all(f["reviewed"] is False for f in listing["folders"])
    finally:
        _cleanup(ws)


def test_organize_leaves_already_filed_documents_alone():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            kept = _seed(conn, ws, "mine.txt", "a document I filed myself")
            for i in range(5):
                _seed(conn, ws, f"other{i}.txt", f"unrelated document {i}")
        mine = lib_folders.create_folder(conn, ws, "Mine")
        lib_folders.set_document_folder(conn, ws, kept, mine["id"])
        out = organize_unfiled(conn, ws)
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (kept,)).fetchone()
    try:
        assert out["organized"] == 5, "only the unfiled documents should be touched"
        assert str(row[0]) == mine["id"], "a user's own filing must not be overwritten"
    finally:
        _cleanup(ws)


def test_organize_with_nothing_eligible_raises():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        with pytest.raises(NothingToOrganize):
            organize_unfiled(conn, ws)
    _cleanup(ws)


def test_documents_without_embeddings_are_skipped():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            for i in range(4):
                _seed(conn, ws, f"e{i}.txt", f"embedded document {i}")
            # A document with no chunks at all — it cannot be clustered.
            conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'empty.txt','text/plain',1,'k','indexed')",
                (ws,),
            )
        out = organize_unfiled(conn, ws)
        listing = lib_folders.list_folders(conn, ws)
    try:
        assert out["organized"] == 4
        assert listing["unfiled_count"] == 1, "the unembeddable document stays unfiled"
    finally:
        _cleanup(ws)
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd engine && DATABASE_URL=… uv run pytest tests/test_organize.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.library.organize'`.

- [ ] **Step 3: Implement `engine/app/library/organize.py`**

```python
"""AI organise: cluster unfiled documents into named folders.

Reuses the Atlas pipeline rather than introducing new ML — the same KMeans over
mean document vectors, the same TF-IDF keywords, and the same LLM labeller with
its deterministic keyword fallback. That keeps this runnable with no GPU and
makes it testable under the fake providers.

Only unfiled documents are touched: a user's own filing is never overwritten.
"""

import numpy as np

from ..ask.answer import get_chat_call
from ..graph.cluster import keywords_per_cluster
from ..graph.label import label_cluster
from ..settings import settings
from . import folders as lib_folders


class NothingToOrganize(Exception):
    """No unfiled document has an embedding, so there is nothing to cluster."""


def _k_for(n: int) -> int:
    """Folder count. Deliberately different from Atlas's topic count: a first
    upload of a dozen files should yield a handful of folders, not one."""
    if n < 4:
        return 1
    return max(2, min(8, round(n**0.5)))


def _load_unfiled(conn, workspace_id: str):
    """(doc_ids, vectors, first-chunk texts) for unfiled documents that have at
    least one embedded chunk."""
    rows = conn.execute(
        "SELECT d.id, AVG(c.embedding) "
        "FROM documents d JOIN chunks c ON c.document_id = d.id "
        "WHERE d.workspace_id=%s AND d.folder_id IS NULL AND c.embedding IS NOT NULL "
        "GROUP BY d.id ORDER BY d.id",
        (workspace_id,),
    ).fetchall()
    if not rows:
        return [], None, []
    doc_ids = [str(r[0]) for r in rows]
    vectors = np.vstack(
        [(r[1].to_numpy() if hasattr(r[1], "to_numpy") else np.asarray(r[1], dtype=float))
         for r in rows]
    )
    text_rows = conn.execute(
        "SELECT DISTINCT ON (document_id) document_id, text FROM chunks "
        "WHERE workspace_id=%s AND document_id = ANY(%s::uuid[]) ORDER BY document_id, ordinal",
        (workspace_id, doc_ids),
    ).fetchall()
    by_id = {str(r[0]): r[1] for r in text_rows}
    return doc_ids, vectors, [by_id.get(d, "") for d in doc_ids]


def _unique_name(conn, workspace_id: str, base: str) -> str:
    """Append ' 2', ' 3', … until the name is free. create_folder is
    case-insensitive, so this must be too."""
    name = base
    n = 1
    while True:
        taken = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s)",
            (workspace_id, name),
        ).fetchone()
        if not taken:
            return name
        n += 1
        name = f"{base} {n}"


def organize_unfiled(conn, workspace_id: str) -> dict:
    from ..graph.cluster import cluster_docs

    doc_ids, vectors, texts = _load_unfiled(conn, workspace_id)
    if not doc_ids:
        raise NothingToOrganize("no unfiled documents with embeddings")

    k = _k_for(len(doc_ids))
    labels = (
        np.zeros(len(doc_ids), dtype=int)
        if k <= 1
        else cluster_docs(vectors, seed=settings.graph_seed)[: len(doc_ids)]
    )
    if k > 1:
        # cluster_docs picks its own k for Atlas; re-cluster at the folder k.
        from sklearn.cluster import KMeans

        labels = KMeans(n_clusters=min(k, len(doc_ids)), random_state=settings.graph_seed,
                        n_init=10).fit_predict(vectors)

    kw = keywords_per_cluster(texts, labels)
    call = get_chat_call()

    created: list[dict] = []
    organized = 0
    for cluster in sorted({int(x) for x in labels}):
        members = [d for d, lab in zip(doc_ids, labels) if int(lab) == cluster]
        titles = [t for t, lab in zip(texts, labels) if int(lab) == cluster][:5]
        base = label_cluster(kw.get(cluster, []), titles, call=call)
        folder = lib_folders.create_folder(
            conn,
            workspace_id,
            _unique_name(conn, workspace_id, base),
            origin="ai",
            keywords=kw.get(cluster, []),
        )
        if folder is None:  # lost a race; skip rather than crash the whole run
            continue
        for doc_id in members:
            lib_folders.set_document_folder(conn, workspace_id, doc_id, folder["id"])
            organized += 1
        created.append(
            {"id": folder["id"], "name": folder["name"], "document_count": len(members)}
        )
    return {"folders": created, "organized": organized}
```

- [ ] **Step 4: Add the endpoint**

In `engine/app/main.py`, import `from .library.organize import NothingToOrganize, organize_unfiled` and add:

```python
class OrganizeBody(BaseModel):
    workspace_id: str


@app.post("/folders/organize", dependencies=[Depends(require_secret)])
def folders_organize(body: OrganizeBody):
    with get_conn() as conn:
        try:
            return organize_unfiled(conn, body.workspace_id)
        except NothingToOrganize as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
```

- [ ] **Step 5: Run the tests**

```bash
cd engine && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain uv run pytest -q
```
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- AI organise (`engine/app/library/organize.py`, `POST /folders/organize`): clusters **unfiled**
  documents into named folders, reusing the Atlas pipeline — mean document vectors via pgvector's
  `avg(vector)`, KMeans at a folder-sized k (`clamp(round(√n), 2, 8)`), TF-IDF keywords, and the
  existing labeller with its deterministic keyword fallback — so it needs no new ML, no GPU, and is
  reproducible under the fake providers. A user's own filing is never overwritten, documents with no
  embeddings are skipped rather than dumped into a folder, and folder names de-duplicate against
  existing ones.
```

```bash
git add engine/app/library/organize.py engine/app/main.py engine/tests/test_organize.py CHANGELOG.md
git commit -m "feat: AI organise unfiled documents into folders"
```

---

### Task 7: AI organise — web route and button

**Files:**
- Create: `web/app/api/folders/organize/route.ts`
- Modify: `web/lib/folders.ts`, `web/app/(app)/dashboard/sources/FolderGrid.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `POST /folders/organize` (Task 6).
- Produces: `organizeFolders(workspaceId): Promise<{folders: {id: string; name: string; documentCount: number}[]; organized: number} | 'nothing'>` in `web/lib/folders.ts`; `POST /api/folders/organize`; an "Organise with AI" button in `FolderGrid`.

- [ ] **Step 1: Add the BFF client**

Append to `web/lib/folders.ts`:

```ts
export type OrganizeResult = {
  folders: { id: string; name: string; documentCount: number }[]
  organized: number
}

export async function organizeFolders(workspaceId: string): Promise<OrganizeResult | 'nothing'> {
  const res = await engineFetch('/folders/organize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
  if (res.status === 400) return 'nothing'
  if (!res.ok) throw new Error(`engine POST /folders/organize responded ${res.status}`)
  const data = (await res.json()) as {
    folders: { id: string; name: string; document_count: number }[]
    organized: number
  }
  return {
    organized: data.organized,
    folders: data.folders.map((f) => ({
      id: f.id,
      name: f.name,
      documentCount: f.document_count,
    })),
  }
}
```

- [ ] **Step 2: Add the route**

`web/app/api/folders/organize/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { organizeFolders } from '@/lib/folders'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const result = await organizeFolders(auth.workspace.id)
  if (result === 'nothing') {
    return NextResponse.json(
      { error: 'nothing to organise — every indexed document is already in a folder' },
      { status: 400 },
    )
  }
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Add the button to `FolderGrid`**

Add to the component's state and header. Insert alongside the existing "New folder" button:

```tsx
  const [organizing, setOrganizing] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function organize() {
    setOrganizing(true)
    setNote(null)
    setError(null)
    try {
      const r = await fetch('/api/folders/organize', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? 'could not organise')
        return
      }
      setNote(
        `Organised ${d.organized} ${d.organized === 1 ? 'document' : 'documents'} into ${d.folders.length} ${d.folders.length === 1 ? 'folder' : 'folders'}.`,
      )
      onChanged()
    } finally {
      setOrganizing(false)
    }
  }
```

and in the header row, before the "New folder" button:

```tsx
        {unfiledCount > 0 && (
          <button
            type="button"
            onClick={organize}
            disabled={organizing}
            className="mr-3 rounded-md border border-brain px-3 py-1 text-body-sm text-brain-text disabled:opacity-60"
          >
            {organizing ? 'Organising…' : 'Organise with AI'}
          </button>
        )}
```

and below the error line:

```tsx
      {note && <p className="mt-2 text-body-sm text-brain-text">{note}</p>}
```

Wrap the two header buttons in a `<div className="flex items-center">` so the layout holds.

- [ ] **Step 4: Verify**

```bash
cd web && npm test && npm run build
```
Expected: PASS.

- [ ] **Step 5: CHANGELOG + commit**

Under `### Added`:

```markdown
- **Organise with AI** button on Sources, shown whenever unfiled documents exist, reporting what it
  did ("Organised 12 documents into 3 folders"). Folders it creates are marked "suggested" until
  renamed or otherwise touched.
```

```bash
git add web/lib/folders.ts web/app/api/folders/organize "web/app/(app)/dashboard/sources/FolderGrid.tsx" CHANGELOG.md
git commit -m "feat: organise-with-AI button and route"
```

---

### Task 8: Starter questions (engine)

**Files:**
- Create: `engine/app/library/suggest.py`, `engine/tests/test_suggest.py`
- Modify: `engine/app/main.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `engine/app/access.py::resolve_access`; `engine/app/ask/answer.py::get_chat_call`.
- Produces: `suggest_questions(conn, workspace_id, user_id, role, limit=3) -> list[str]`; endpoint `GET /suggestions?workspace_id=&user_id=&role=` returning `{"questions": [...]}`.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_suggest.py`:

```python
import os
import uuid

import psycopg
import pytest

from app.library import folders as lib_folders
from app.library.suggest import suggest_questions

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_suggestions_never_reference_documents_the_caller_cannot_see():
    """A suggested question is a disclosure. Offering 'What is the Band 4 salary
    range?' to someone who cannot open the HR file leaks both its existence and
    its topic."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'s',%s)", (ws, str(ws)))
            everyone = uuid.uuid4()
            hr = uuid.uuid4()
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'Everyone',%s,true)",
                (everyone, ws, f"ev-{everyone}"),
            )
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'HR',%s,false)",
                (hr, ws, f"hr-{hr}"),
            )
            docs = {}
            for name, group in (("open.txt", everyone), ("secret.txt", hr)):
                d = conn.execute(
                    "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                    "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
                    (ws, name),
                ).fetchone()[0]
                conn.execute(
                    "INSERT INTO document_groups (document_id, workspace_id, group_id) "
                    "VALUES (%s,%s,%s)",
                    (d, ws, group),
                )
                docs[name] = str(d)
        public = lib_folders.create_folder(conn, str(ws), "Retention", origin="ai",
                                           keywords=["retention", "records"])
        private = lib_folders.create_folder(conn, str(ws), "Compensation", origin="ai",
                                            keywords=["salary", "band"])
        lib_folders.set_document_folder(conn, str(ws), docs["open.txt"], public["id"])
        lib_folders.set_document_folder(conn, str(ws), docs["secret.txt"], private["id"])

        member = suggest_questions(conn, str(ws), str(uuid.uuid4()), "member")
        owner = suggest_questions(conn, str(ws), str(uuid.uuid4()), "owner")
    try:
        assert any("Retention" in q for q in member)
        assert not any("Compensation" in q for q in member), member
        assert any("Compensation" in q for q in owner), owner
        assert len(owner) <= 3
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_no_visible_folders_yields_no_questions():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'s2',%s)", (ws, str(ws)))
        assert suggest_questions(conn, str(ws), str(uuid.uuid4()), "owner") == []
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd engine && DATABASE_URL=… uv run pytest tests/test_suggest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.library.suggest'`.

- [ ] **Step 3: Implement `engine/app/library/suggest.py`**

```python
"""Starter questions for the first-run panel.

Built from the caller's OWN folders, scoped by the same access rule the ask path
uses. A suggested question is a disclosure: offering "What is the Band 4 salary
range?" to someone who cannot open the HR file leaks both that the file exists
and what it is about.
"""

from ..access import resolve_access
from ..ask.answer import get_chat_call

_PROMPT = (
    "Write one short question an employee might ask about a folder of company "
    "documents. Reply with only the question.\n"
    "Folder: {name}\n"
    "Keywords: {keywords}\n"
)


def _fallback(name: str, keywords: list[str]) -> str:
    if keywords:
        return f"What do our {name} documents say about {keywords[0]}?"
    return f"What is in our {name} documents?"


def suggest_questions(
    conn, workspace_id: str, user_id: str, role: str, limit: int = 3
) -> list[str]:
    group_ids, all_access = resolve_access(conn, workspace_id, user_id, role)

    # Folders ranked by how many documents this caller can actually see. Ties
    # break on name so the panel is stable between renders.
    rows = conn.execute(
        "SELECT f.name, f.keywords, count(d.id) AS visible "
        "FROM folders f JOIN documents d ON d.folder_id = f.id "
        "WHERE f.workspace_id = %s AND ( %s OR EXISTS ("
        "  SELECT 1 FROM document_groups dg "
        "  WHERE dg.document_id = d.id AND dg.group_id = ANY(%s::uuid[])) ) "
        "GROUP BY f.id, f.name, f.keywords "
        "HAVING count(d.id) > 0 "
        "ORDER BY visible DESC, f.name "
        "LIMIT %s",
        (workspace_id, all_access, group_ids, limit),
    ).fetchall()
    if not rows:
        return []

    call = get_chat_call()
    out: list[str] = []
    for name, keywords, _count in rows:
        kws = list(keywords or [])
        if call is None:
            out.append(_fallback(name, kws))
            continue
        try:
            raw = call(_PROMPT.format(name=name, keywords=", ".join(kws) or "(none)"))
            q = raw.strip().strip('"').splitlines()[0].strip() if raw else ""
        except Exception:  # noqa: BLE001 — a suggestion never blocks the page
            q = ""
        out.append(q[:160] or _fallback(name, kws))
    return out
```

- [ ] **Step 4: Add the endpoint**

In `engine/app/main.py`, import `from .library.suggest import suggest_questions` and add:

```python
@app.get("/suggestions", dependencies=[Depends(require_secret)])
def suggestions(workspace_id: str, user_id: str = "", role: str = "member"):
    with get_conn() as conn:
        return {"questions": suggest_questions(conn, workspace_id, user_id, role)}
```

- [ ] **Step 5: Run the tests**

```bash
cd engine && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain uv run pytest -q
```
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- Starter questions (`engine/app/library/suggest.py`, `GET /suggestions`) built from the caller's own
  folders and their stored keywords, ranked by how many documents that caller can actually see, with
  a deterministic template when no chat model is configured. Scoped by the same `resolve_access` rule
  the ask path uses — a suggested question is a disclosure, so a member is never offered one derived
  from a document they cannot open.
```

```bash
git add engine/app/library/suggest.py engine/app/main.py engine/tests/test_suggest.py CHANGELOG.md
git commit -m "feat: permission-scoped starter questions"
```

---

### Task 9: Onboarding state — derivation, dismissal, and the API

**Files:**
- Create: `web/lib/onboarding.ts`, `web/lib/onboarding.test.ts`, `web/app/api/onboarding/dismiss/route.ts`, `web/app/api/suggestions/route.ts`
- Modify: `web/lib/engine.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `listDocuments` (Task 3); `GET /suggestions` (Task 8); `users.onboardingDismissedAt` (Task 1).
- Produces:
  - `OnboardingFacts = { indexedCount: number; foldered: boolean; hasAsked: boolean; dismissed: boolean }`
  - `OnboardingState = { steps: [{ key: 'add'|'organise'|'ask'; done: boolean }]; complete: boolean; show: boolean; workspaceEmpty: boolean }`
  - `deriveOnboarding(facts: OnboardingFacts): OnboardingState` — **pure**, unit-tested
  - `getSuggestions(workspaceId, userId, role): Promise<string[]>` in `web/lib/engine.ts`
  - `POST /api/onboarding/dismiss`, `GET /api/suggestions`

- [ ] **Step 1: Write the failing test**

Create `web/lib/onboarding.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveOnboarding } from './onboarding'

const base = { indexedCount: 0, foldered: false, hasAsked: false, dismissed: false }

describe('deriveOnboarding', () => {
  it('marks nothing done for a brand-new workspace and flags it empty', () => {
    const s = deriveOnboarding(base)
    expect(s.steps.map((x) => x.done)).toEqual([false, false, false])
    expect(s.workspaceEmpty).toBe(true)
    expect(s.complete).toBe(false)
    expect(s.show).toBe(true)
  })

  it('completes step 1 once a document is indexed', () => {
    const s = deriveOnboarding({ ...base, indexedCount: 2 })
    expect(s.steps[0].done).toBe(true)
    expect(s.workspaceEmpty).toBe(false)
  })

  it('completes all three and stops showing', () => {
    const s = deriveOnboarding({ indexedCount: 3, foldered: true, hasAsked: true, dismissed: false })
    expect(s.complete).toBe(true)
    expect(s.show).toBe(false)
  })

  // Dismissal hides the strip. It must NOT fake completion, or a half-set-up
  // workspace would report itself as finished.
  it('hides when dismissed without claiming completion', () => {
    const s = deriveOnboarding({ ...base, indexedCount: 1, dismissed: true })
    expect(s.show).toBe(false)
    expect(s.complete).toBe(false)
  })

  it('a member joining a populated workspace is not asked to upload', () => {
    const s = deriveOnboarding({ indexedCount: 40, foldered: true, hasAsked: false, dismissed: false })
    expect(s.workspaceEmpty).toBe(false)
    expect(s.steps[0].done).toBe(true)
    expect(s.steps[1].done).toBe(true)
    expect(s.steps[2].done).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/onboarding.test.ts`
Expected: FAIL — cannot resolve `./onboarding`.

- [ ] **Step 3: Implement `web/lib/onboarding.ts`**

```ts
export type OnboardingFacts = {
  indexedCount: number
  foldered: boolean
  hasAsked: boolean
  dismissed: boolean
}

export type OnboardingStep = { key: 'add' | 'organise' | 'ask'; done: boolean }

export type OnboardingState = {
  steps: OnboardingStep[]
  complete: boolean
  show: boolean
  workspaceEmpty: boolean
}

/**
 * Progress is DERIVED from real facts on every render — there is no stored
 * "current step". That means the panel resumes correctly, cannot desync, and
 * honestly reverts if the user deletes their documents.
 *
 * Dismissal only hides the strip. It never marks incomplete work as complete.
 */
export function deriveOnboarding(facts: OnboardingFacts): OnboardingState {
  const steps: OnboardingStep[] = [
    { key: 'add', done: facts.indexedCount > 0 },
    { key: 'organise', done: facts.foldered },
    { key: 'ask', done: facts.hasAsked },
  ]
  const complete = steps.every((s) => s.done)
  return {
    steps,
    complete,
    show: !complete && !facts.dismissed,
    workspaceEmpty: facts.indexedCount === 0,
  }
}
```

- [ ] **Step 4: Add the suggestions client and routes**

Append to `web/lib/engine.ts`:

```ts
export async function getSuggestions(
  workspaceId: string,
  userId: string,
  role: string,
): Promise<string[]> {
  const qs = new URLSearchParams({ workspace_id: workspaceId, user_id: userId, role })
  const res = await fetch(`${env.ENGINE_BASE_URL}/suggestions?${qs}`, {
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { questions?: string[] }
  return data.questions ?? []
}
```

`web/app/api/suggestions/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { getSuggestions } from '@/lib/engine'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })
  const questions = await getSuggestions(auth.workspace.id, auth.user.id, mem?.role ?? 'member')
  return NextResponse.json({ questions })
}
```

`web/app/api/onboarding/dismiss/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  // users is an auth table — web owns it and writes it directly.
  await db
    .update(users)
    .set({ onboardingDismissedAt: new Date() })
    .where(eq(users.id, auth.user.id))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run the tests**

```bash
cd web && npm test && npm run build
```
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- Onboarding state (`web/lib/onboarding.ts`): a pure `deriveOnboarding()` computing the three steps
  from real facts — a document is indexed, any document is foldered, the user has asked a question —
  rather than a stored wizard step, so it resumes correctly and reverts honestly if documents are
  deleted. Dismissal (`POST /api/onboarding/dismiss`) hides the strip without ever marking
  incomplete work complete. `GET /api/suggestions` proxies the engine's permission-scoped starter
  questions.
```

```bash
git add web/lib/onboarding.ts web/lib/onboarding.test.ts web/lib/engine.ts web/app/api/onboarding web/app/api/suggestions CHANGELOG.md
git commit -m "feat: derived onboarding state, dismissal and suggestions API"
```

---

### Task 10: The first-run UI

**Files:**
- Create: `web/app/(app)/dashboard/GetStarted.tsx`, `web/app/(app)/dashboard/ProgressStrip.tsx`
- Modify: `web/app/(app)/dashboard/page.tsx`, `web/app/(app)/dashboard/AskWorkspace.tsx`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `deriveOnboarding` (Task 9), `/api/suggestions`, `/api/documents`, `/api/onboarding/dismiss`.
- Produces: `GetStarted` (Ask empty state) and `ProgressStrip`; `AskWorkspace` accepts `onboarding: OnboardingState` and `initialSuggestions: string[]`.

- [ ] **Step 1: Build `GetStarted.tsx`**

```tsx
'use client'

import Link from 'next/link'

export function GetStarted({
  workspaceEmpty,
  suggestions,
  onPick,
}: {
  workspaceEmpty: boolean
  suggestions: string[]
  onPick: (q: string) => void
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center px-6 py-16">
      <h2 className="font-display text-2xl text-ink">
        {workspaceEmpty ? 'Let’s build your brain' : 'Ask anything about your documents'}
      </h2>

      {workspaceEmpty ? (
        <>
          <p className="mt-2 text-body text-ink-soft">
            CompanyMind answers questions from your own documents, and every answer links back to
            the exact page it came from. Nothing leaves your infrastructure.
          </p>
          <ol className="mt-6 space-y-3 text-body text-ink-soft">
            <li>
              <strong className="text-ink">1. Add documents.</strong> PDFs, Word, text or markdown.
            </li>
            <li>
              <strong className="text-ink">2. We sort them into folders</strong> so you can see what
              your workspace actually contains.
            </li>
            <li>
              <strong className="text-ink">3. Ask a question</strong> and get an answer with its
              sources attached.
            </li>
          </ol>
          <Link
            href="/dashboard/sources"
            className="mt-8 self-start rounded-md bg-ink px-4 py-2 text-body-sm text-paper"
          >
            Add documents
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-body text-ink-soft">
            Every answer cites the document it came from — click a citation to read the source.
          </p>
          {suggestions.length > 0 && (
            <>
              <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
                Try one of these
              </p>
              <ul className="mt-2 space-y-2">
                {suggestions.map((q) => (
                  <li key={q}>
                    <button
                      onClick={() => onPick(q)}
                      className="w-full rounded-lg border border-line bg-paper-raised px-4 py-3 text-left text-body text-ink hover:border-brain"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build `ProgressStrip.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { OnboardingState } from '@/lib/onboarding'

const LABEL: Record<string, string> = {
  add: 'Add documents',
  organise: 'Sort them into folders',
  ask: 'Ask your first question',
}

export function ProgressStrip({ state, csrf }: { state: OnboardingState; csrf: string }) {
  const [hidden, setHidden] = useState(false)
  if (!state.show || hidden) return null

  async function dismiss() {
    setHidden(true)
    await fetch('/api/onboarding/dismiss', { method: 'POST', headers: { 'x-csrf-token': csrf } })
  }

  return (
    <div className="flex items-center gap-4 border-b border-line bg-paper-sunk px-6 py-2">
      <ol className="flex flex-1 flex-wrap items-center gap-4">
        {state.steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-body-sm">
            <span
              aria-hidden="true"
              data-done={s.done}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-line font-mono text-[0.5rem] text-ink-soft data-[done=true]:border-brain data-[done=true]:bg-brain data-[done=true]:text-paper"
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className={s.done ? 'text-ink-soft line-through' : 'text-ink'}>
              {LABEL[s.key]}
            </span>
          </li>
        ))}
      </ol>
      <button
        onClick={dismiss}
        className="shrink-0 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Dismiss
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Wire the Ask page**

`web/app/(app)/dashboard/page.tsx`:

```tsx
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { chats, memberships, messages, users } from '@/lib/db/schema'
import { listDocuments } from '@/lib/documents'
import { getSuggestions } from '@/lib/engine'
import { deriveOnboarding } from '@/lib/onboarding'
import { AskWorkspace } from './AskWorkspace'

export const runtime = 'nodejs'

export default async function AskPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  if (!auth) return <AskWorkspace csrf={csrf} onboarding={null} initialSuggestions={[]} />

  const docs = await listDocuments(auth.workspace.id)
  const indexedCount = docs.filter((d) => d.status === 'indexed').length
  const foldered = docs.some((d) => d.folderId !== null)

  const asked = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .where(and(eq(chats.userId, auth.user.id), eq(messages.role, 'user')))
    .limit(1)

  const me = await db.query.users.findFirst({
    where: eq(users.id, auth.user.id),
    columns: { onboardingDismissedAt: true },
  })

  const onboarding = deriveOnboarding({
    indexedCount,
    foldered,
    hasAsked: asked.length > 0,
    dismissed: !!me?.onboardingDismissedAt,
  })

  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })
  const initialSuggestions = onboarding.workspaceEmpty
    ? []
    : await getSuggestions(auth.workspace.id, auth.user.id, mem?.role ?? 'member')

  return (
    <AskWorkspace csrf={csrf} onboarding={onboarding} initialSuggestions={initialSuggestions} />
  )
}
```

- [ ] **Step 4: Render it in `AskWorkspace`**

Add the two props, render `ProgressStrip` above the panes, and swap `AskChat` for `GetStarted` when there is no active chat and onboarding is not complete. Read the current file first; change only these parts:

```tsx
export function AskWorkspace({
  csrf,
  onboarding,
  initialSuggestions,
}: {
  csrf: string
  onboarding: OnboardingState | null
  initialSuggestions: string[]
}) {
  const [pending, setPending] = useState<string | null>(null)
  // …existing state…
```

Above the existing outer `<div className="flex h-dvh flex-col …">` content, render:

```tsx
      {onboarding && <ProgressStrip state={onboarding} csrf={csrf} />}
```

and in the main pane, when `selectedChatId === null` and `onboarding && !onboarding.steps[2].done`, render:

```tsx
          <GetStarted
            workspaceEmpty={onboarding.workspaceEmpty}
            suggestions={initialSuggestions}
            onPick={(q) => setPending(q)}
          />
```

instead of `<AskChat …/>`. Pass `pending` into `AskChat` as a new optional `initialQuestion` prop; when it is set, `AskChat` prefills its input and submits once on mount. Add to `AskChat`:

```tsx
  // A starter question picked on the empty state: prefill and send once.
  const sentInitial = useRef(false)
  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true
      setQ(initialQuestion)
      void send(initialQuestion)
    }
  }, [initialQuestion])
```

where `send(text)` is the existing submit handler refactored to take the question text as an argument rather than reading `q` directly.

- [ ] **Step 5: Verify by hand**

```bash
cd web && npm test && npm run build
```
Then run the app against a workspace with no documents and confirm the Ask page shows the Get Started panel rather than a chat box that refuses. Then upload a document, press Organise with AI, return to Ask, and confirm starter questions appear and clicking one produces a cited answer.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- First-run experience. The Ask page no longer hands a brand-new user an empty chat box whose first
  reply is "I couldn't find anything in your sources to answer that" — an empty workspace now shows
  what CompanyMind does, the three steps to get there, and a button to add documents. A populated
  workspace instead offers three starter questions drawn from folders the caller can actually see;
  clicking one asks it. A dismissible progress strip tracks the three steps, each derived from real
  data rather than a stored wizard position.
```

```bash
git add "web/app/(app)/dashboard" CHANGELOG.md
git commit -m "feat: first-run get-started panel, starter questions and progress strip"
```

---

## Done criteria

1. A workspace with no documents shows the Get Started panel on Ask, never the refusal sentinel.
2. Uploading documents and pressing **Organise with AI** produces named folders containing them.
3. `engine/tests/test_folders.py::test_moving_a_document_between_folders_does_not_change_visibility` passes — folders provably are not access control.
4. Deleting a folder leaves its documents in Unfiled, never deleted.
5. A member is never offered a starter question derived from a document they cannot open.
6. Atlas's `?doc=` deep links still land on the right document.
7. `npm run build` still succeeds with no env and no database.
