import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  integer,
  bigint,
  vector,
  boolean,
  doublePrecision,
  jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// EMBED_DIM — pinned. Must equal engine/app/settings.py embed_dim. Changing it
// requires regenerating the migration and re-embedding every chunk.
export const EMBED_DIM = 1024

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  // Set when the user dismisses the first-run strip. Onboarding PROGRESS is
  // derived from real data every render; only the dismissal is stored.
  onboardingDismissedAt: timestamp('onboarding_dismissed_at', { withTimezone: true }),
  // Platform-level, above workspaces — NOT a membership role. Seed-only on
  // purpose: a panel that can mint its own super-admins has no floor.
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  // Set by the admin panel. Blocking also deletes the user's sessions, so this
  // flag is a durable record, not the enforcement mechanism on its own.
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  // 'en' | 'ru' | 'uz'. Per-user rather than per-workspace: a bank's Russian-speaking
  // analyst and its English-speaking admin share one workspace.
  locale: text('locale').notNull().default('en'),
  // Set when the user explicitly declines the guided tour (the pill's own
  // dismiss action). Deliberately separate from onboardingDismissedAt above —
  // that column belongs to the older static first-run strip a later task
  // deletes; conflating the two would make that deletion destructive to this
  // feature. Tour PROGRESS is derived from user_tour_steps below, same
  // philosophy as onboarding: only the dismissal itself is stored.
  tourDismissedAt: timestamp('tour_dismissed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner' | 'member'
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
)

// One row per (user, workspace, step) the guided tour has ever SHOWN that
// user — not completed, shown (spec §6, §5). No stored step cursor anywhere:
// what to show next is always the set difference between the role's defined
// step keys and the rows here (web/lib/tour/state.ts::nextStepKey). Replaying
// the tour via the rail's Guide item never deletes from this table — the
// upsert route (app/api/tour/step/route.ts) is insert-only, ON CONFLICT DO
// NOTHING, so a replay can never erase evidence that a step was already
// shown once. An auth-owned table (not knowledge-domain): web writes it
// directly via Drizzle, the same as users/sessions/memberships.
export const userTourSteps = pgTable(
  'user_tour_steps',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // Free text, not an enum — an enum would need a migration to add a new
    // step key, contradicting the append-only, no-hand-edited-migration
    // discipline spec §6 asks for.
    stepKey: text('step_key').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId, t.stepKey] })],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(), // sha256(token), never the token
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

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

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    status: text('status').notNull().default('uploaded'), // uploaded|parsing|indexed|failed
    error: text('error'),
    // Full extracted text, stored at ingest so the source viewer can render the
    // document and highlight the exact cited span.
    extractedText: text('extracted_text'),
    // NAVIGATION ONLY — never access control. Who may see a document is decided
    // solely by document_groups x group_members (engine/app/access.py). Moving a
    // document between folders must not change what anyone can retrieve.
    // ON DELETE SET NULL: deleting a folder must never delete documents.
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('documents_workspace_idx').on(t.workspaceId)],
)

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'), // queued|running|done|failed
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    text: text('text').notNull(),
    page: integer('page'),
    charStart: integer('char_start'),
    charEnd: integer('char_end'),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBED_DIM }),
  },
  (t) => [
    // Neighbour expansion, re-ingest DELETE, and the documents cascade all filter
    // by document and order by ordinal.
    index('chunks_doc_ordinal_idx').on(t.documentId, t.ordinal),
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    // Lexical half of hybrid retrieval — must match the to_tsvector('english', …)
    // expression used by the engine's lexical query, or Postgres won't use it.
    index('chunks_content_tsv_idx').using('gin', sql`to_tsvector('english', ${t.text})`),
  ],
)

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('chats_workspace_idx').on(t.workspaceId)],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('messages_chat_idx').on(t.chatId)],
)

export const citations = pgTable(
  'citations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // A citation is evidence for an answer that was already given. Re-ingesting a
    // document deletes and re-creates its chunks (engine/app/ingest/store.py), so
    // these must NOT cascade — the row survives with a frozen filename/page/snippet
    // and a null chunk reference, which the UI renders as an unlinkable citation.
    chunkId: uuid('chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
    marker: integer('marker').notNull(), // the [n]
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
    filename: text('filename').notNull(),
    page: integer('page'),
    snippet: text('snippet').notNull(),
  },
  (t) => [
    index('citations_message_idx').on(t.messageId),
    index('citations_chunk_idx').on(t.chunkId),
    index('citations_document_idx').on(t.documentId),
  ],
)

export const queryLog = pgTable(
  'query_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // A query comes from a web user OR a Telegram identity — exactly one is set.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    telegramLinkId: uuid('telegram_link_id').references(() => telegramLinks.id, {
      onDelete: 'set null',
    }),
    question: text('question').notNull(),
    retrievedChunkIds: uuid('retrieved_chunk_ids').array(),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // Retrieval telemetry — how the pipeline actually behaved for this query.
    degraded: text('degraded').array(),
    timingsMs: jsonb('timings_ms'),
    candidateCounts: jsonb('candidate_counts'),
    rerankApplied: boolean('rerank_applied'),
    questionType: text('question_type'),
  },
  // A plain btree on (workspace_id, created_at) serves ORDER BY created_at DESC
  // via a backward index scan; no .desc() modifier needed.
  (t) => [index('query_log_ws_created_idx').on(t.workspaceId, t.createdAt)],
)

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
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
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    // A member is a web user OR a Telegram identity (exactly one is set).
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    telegramLinkId: uuid('telegram_link_id').references(() => telegramLinks.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('group_members_group_idx').on(t.groupId),
    index('group_members_ws_user_idx').on(t.workspaceId, t.userId),
  ],
)

export const documentGroups = pgTable(
  'document_groups',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.groupId] }),
    index('document_groups_group_idx').on(t.groupId),
  ],
)

export const telegramBots = pgTable('telegram_bots', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  botTokenEncrypted: text('bot_token_encrypted').notNull(),
  botUsername: text('bot_username').notNull(),
  lastUpdateId: bigint('last_update_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const telegramLinks = pgTable(
  'telegram_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
    telegramUsername: text('telegram_username'),
    displayName: text('display_name'),
    status: text('status').notNull().default('pending'), // pending | approved | blocked
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [index('telegram_links_workspace_idx').on(t.workspaceId)],
)

export const graphBuildJobs = pgTable('graph_build_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'), // queued|running|done|failed
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const graphTopics = pgTable(
  'graph_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    keywords: text('keywords').array(),
    centroid: vector('centroid', { dimensions: EMBED_DIM }),
    docCount: integer('doc_count').notNull().default(0),
    x: doublePrecision('x').notNull().default(0),
    y: doublePrecision('y').notNull().default(0),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('graph_topics_workspace_idx').on(t.workspaceId)],
)

export const graphTopicMembers = pgTable(
  'graph_topic_members',
  {
    topicId: uuid('topic_id')
      .notNull()
      .references(() => graphTopics.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.documentId] })],
)

export const graphDocMeta = pgTable('graph_doc_meta', {
  documentId: uuid('document_id')
    .primaryKey()
    .references(() => documents.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => graphTopics.id, { onDelete: 'set null' }),
  degree: integer('degree').notNull().default(0),
  exposureScore: doublePrecision('exposure_score').notNull().default(0),
  isOrphan: boolean('is_orphan').notNull().default(false),
  lastRetrievedAt: timestamp('last_retrieved_at', { withTimezone: true }),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const graphFindings = pgTable(
  'graph_findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // permission_anomaly|over_exposure|orphan|dead|stale
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    severity: doublePrecision('severity').notNull().default(0),
    detail: jsonb('detail'),
    status: text('status').notNull().default('open'), // open|dismissed
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('graph_findings_workspace_idx').on(t.workspaceId)],
)
