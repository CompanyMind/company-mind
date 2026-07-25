# Onboarding and document folders — design

**Date:** 2026-07-25
**Status:** Approved (decisions locked). Awaiting spec review before planning.

**Locked decisions:** AI organises uploads automatically and everything stays editable ·
onboarding adapts to whether the workspace is empty or populated · folders are navigation, never
access control · one folder per document, flat, no nesting.

## 1. Why

A new owner signs in and lands on `/dashboard`, which is Ask. The page renders a chat input. They
type a question. Retrieval finds nothing, so `engine/app/ask/answer.py::answer_question` returns the
refusal sentinel — *"I couldn't find anything in your sources to answer that."*

**The product's first interaction tells the user it is empty, with no explanation and no next step.**
There is no empty state anywhere on the Ask page, nothing points at Sources, and the Rail
(`web/app/(app)/_components/Rail.tsx`) offers five bare nouns — Ask, Sources, Access, Integrations,
Atlas — with no indication that Sources must come first.

The second problem is Sources itself: `web/app/(app)/dashboard/Sources.tsx` renders every document in
one flat `<ul>`. At the 150-document demo corpus it is already unusable, and it gives the user no way
to form a mental model of what the workspace contains.

## 2. Onboarding

### 2.1 Progress is derived, never stored

Three steps, each computed from real data on every render:

| Step | Complete when |
|---|---|
| 1. Add documents | ≥1 document in the workspace has `status='indexed'` |
| 2. Organise them | ≥1 document has a non-null `folder_id` |
| 3. Ask your first question | ≥1 `messages` row with `role='user'` exists in a chat owned by this user |

No wizard state machine, no "current step" column. Derivation means the panel is resumable, cannot
desync from reality, and honestly reverts if the user deletes their documents.

The **only** persisted field is `users.onboarding_dismissed_at timestamptz` (nullable). Dismissal is
per-user and permanent; it hides the strip but does not fake completion.

`users` is an auth table, which web owns outright — so web reads and writes this column directly
through Drizzle, not via an engine endpoint. Steps 1 and 2 are knowledge-table facts and come from
the engine's existing `GET /documents` (which gains `folder_id`, §3.3); step 3 is a `messages` fact,
also web-owned. No new engine endpoint is needed for progress itself.

### 2.2 Two shapes, one mechanism

- **Empty workspace** (no indexed documents — typically the owner on day one): the Ask page's chat is
  replaced by a Get Started panel that states the loop in one line per step and offers a primary
  *Add documents* action linking to Sources.
- **Populated workspace** (a member joining later): step 1 and 2 already read as complete, so the
  panel collapses to a short orientation plus starter questions. A member is never told to upload.

The distinction is computed from workspace state, not from role, so an owner joining an
already-populated workspace also gets the lighter shape.

### 2.3 Starter questions

Once documents are indexed and foldered, the Ask empty state shows **three** concrete questions
derived from the user's own corpus rather than canned examples.

`GET /suggestions?workspace_id=&user_id=&role=` (engine) resolves the caller's access with the
existing `resolve_access`, keeps only folders that contain at least one document that caller may see,
takes the **three such folders with the most visible documents** (ties broken by folder name, for
determinism), and builds one question each from the folder's `name` plus its stored `keywords`. A
manual folder has no keywords, so its question is built from the name alone. With a real chat model
the questions are phrased naturally; with the fake providers a deterministic template
(`What do our {name} documents say about {keyword}?`) is used, so the surface is testable with no GPU.
Fewer than three qualifying folders yields fewer than three questions — never padding with invented
topics.

Permission scoping is not optional here: suggesting *"What is the Band 4 salary range?"* to someone
who cannot open the HR document would leak the existence and topic of a restricted file.

### 2.4 Placement

- Ask page empty state — `web/app/(app)/dashboard/AskWorkspace.tsx` renders `GetStarted` instead of
  `AskChat` when the workspace has no indexed documents.
- A slim, dismissible progress strip above the content on Ask and Sources while onboarding is
  incomplete and not dismissed.
- No modal, no coach-mark overlay, no `/tutorial` route.

## 3. Folders

### 3.1 Data model

```sql
folders(
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  origin       text not null default 'manual',  -- 'manual' | 'ai'
  reviewed     boolean not null default false,   -- false + origin='ai' => show "suggested"
  keywords     text[],                           -- TF-IDF terms from AI organise; NULL for manual
  created_at   timestamptz not null default now()
)
-- unique index on (workspace_id, lower(name))
-- index on (workspace_id)

documents.folder_id uuid references folders(id) on delete set null
```

One folder per document. `NULL` means **Unfiled**, which is a real, visible bucket rather than a
hidden state. Flat — no `parent_id`, no nesting.

`ON DELETE SET NULL` is deliberate: **deleting a folder must never delete documents.** They return to
Unfiled.

### 3.2 The security invariant

**Folders are navigation. Access control is `document_groups` × `group_members` and nothing else.**

No code path may read `folder_id` when computing visibility. `engine/app/access.py::resolve_access`
and the permission predicate in `engine/app/ask/retrieve.py::_perm_sql` are untouched by this work.

This is enforced by a test, not by convention: seed two documents with different access groups, move
one between folders, and assert that permission-scoped retrieval returns byte-identical results
before and after. A folder move that changes what a principal can retrieve is a security defect.

The Sources UI states this in one line where the two controls sit next to each other, because a user
who has just filed a document into "Payroll" will otherwise reasonably assume it is now restricted.

### 3.3 Ownership and API

Per the architecture in `CLAUDE.md`, the engine owns every knowledge-table read and write; web is a
BFF; the schema is defined in Drizzle.

**Engine** — new `engine/app/library/folders.py`:

| Endpoint | Purpose |
|---|---|
| `GET /folders?workspace_id=` | folders with document counts, plus the unfiled count |
| `POST /folders` | create (409 on duplicate name, case-insensitive) |
| `PATCH /folders/{id}` | rename (409 on duplicate) |
| `DELETE /folders/{id}` | delete; contained documents become unfiled |
| `PUT /documents/{id}/folder` | assign or clear (`folder_id: null`) |
| `POST /folders/organize` | AI organise (see §4) |
| `GET /suggestions` | starter questions (see §2.3) |

**Web** — `web/lib/folders.ts` (BFF client, mirroring `web/lib/documents.ts`) and routes under
`web/app/api/folders/`. Mutating routes require the existing CSRF check.

`GET /documents` gains `folder_id` in its response so the Sources list can render without a second
round trip.

### 3.4 UI

**`/dashboard/sources`** — folder cards: name, document count, and a "suggested" chip when
`origin='ai' AND NOT reviewed`. An **Unfiled** card appears whenever unfiled documents exist. Actions:
*New folder*, *Organise with AI* (shown when ≥1 indexed document is unfiled).

**`/dashboard/sources/[folderId]`** — that folder's documents using the existing row UI, with a
breadcrumb back, rename and delete for the folder, and a per-document **Move to…** select.

Deliberately **not** drag-and-drop: it breaks on touch, is inaccessible by keyboard, and needs a
hit-testing layer this codebase has already paid for once in Atlas.

The existing per-document access-group editor is unchanged.

## 4. AI organise

Reuses the Atlas machinery rather than introducing new ML:

1. Load per-document mean vectors — `engine/app/graph/store.py::load_docs` already computes these in
   SQL via pgvector's `avg(vector)`.
2. Consider only documents with `folder_id IS NULL` and ≥1 embedded chunk, so a user's own filing is
   never disturbed.
3. `k = clamp(round(sqrt(n)), 2, 8)` for `n ≥ 4`, else `k = 1`. (12 documents → 3 folders; 25 → 5.)
4. KMeans via `engine/app/graph/cluster.py::cluster_docs` with the fixed seed, then
   `keywords_per_cluster` for TF-IDF terms.
5. Name each cluster with `engine/app/graph/label.py::label_cluster`, which already falls back to
   Title-Cased keywords when `get_chat_call()` returns `None`.
6. Create folders with `origin='ai'`, `reviewed=false`, storing the cluster's TF-IDF terms in
   `keywords` (which §2.3's starter questions read), de-duplicating names against existing folders
   (append ` 2`, ` 3`, … on collision), and assign the documents.

Deterministic under the fake providers because KMeans is seeded and the label fallback is pure, so CI
tests it with no GPU and no network.

Returns `{folders: [{id, name, document_count}], organized: n}` so the UI can report *"Organised 12
documents into 3 folders."*

## 5. Error handling

| Case | Behaviour |
|---|---|
| Organise with 0 eligible documents | 400, message names why (no indexed, unfiled documents) |
| Documents present but none embedded | 400 rather than creating empty folders |
| Duplicate folder name | 409; the UI shows an inline error and keeps the typed name |
| Delete a folder with documents | Succeeds; documents become unfiled; the confirm dialog says so |
| Assign to a folder in another workspace | 404 — every query is workspace-scoped |
| Suggestions with no visible documents | Empty list; the panel falls back to its static explanation |

## 6. Testing

**Engine (pytest, DB-gated):** folder CRUD and workspace scoping · duplicate-name 409 ·
delete-unfiles-documents · assign/clear · organise determinism across two runs with the same seed ·
organise leaves already-filed documents alone · suggestions are permission-scoped (a member never
receives a question derived from a document they cannot see) · **the folder-move security test in
§3.2**.

**Web (vitest, `lib/**/*.test.ts`):** the onboarding step-derivation function as a pure unit
(empty / partial / complete / dismissed) · folder-name validation.

## 7. Non-goals

Nested folders · drag-and-drop · bulk multi-select · coach-mark or spotlight tours · a separate
tutorial route · auto-organising on every upload · changing the Rail's information architecture ·
any change to the access model.

## 8. Sequence

Each stage leaves the product working.

- **A. Folders** — schema and migration, engine library and endpoints, BFF and routes, folder grid,
  folder detail, Move to…, and the security test.
- **B. AI organise** — clustering, labelling, the endpoint, the button, and the result toast.
- **C. Onboarding** — derived steps, the Ask empty state, the progress strip, starter questions, and
  `onboarding_dismissed_at`.

B depends on A. C uses both, and its starter questions depend on B having produced folder labels.

## 9. Success criteria

1. A brand-new owner never sees the refusal sentinel as their first interaction.
2. Uploading documents and pressing *Organise with AI* produces named folders containing those
   documents, with no further input.
3. Moving a document between folders provably does not change what any principal can retrieve.
4. Deleting a folder never deletes a document.
5. A member in a populated workspace is never asked to upload anything, and every starter question
   they are offered is answerable from documents they can open.
6. Sources remains usable at 150+ documents.
