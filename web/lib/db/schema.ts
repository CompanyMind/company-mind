import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
  integer,
  bigint,
  vector,
  boolean,
} from 'drizzle-orm/pg-core'

// EMBED_DIM — pinned. Must equal engine/app/settings.py embed_dim. Changing it
// requires regenerating the migration and re-embedding every chunk.
export const EMBED_DIM = 1024

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
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
    index('chunks_workspace_idx').on(t.workspaceId),
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
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

export const citations = pgTable('citations', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  chunkId: uuid('chunk_id')
    .notNull()
    .references(() => chunks.id, { onDelete: 'cascade' }),
  marker: integer('marker').notNull(), // the [n]
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  page: integer('page'),
  snippet: text('snippet').notNull(),
})

export const queryLog = pgTable('query_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  retrievedChunkIds: uuid('retrieved_chunk_ids').array(),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

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
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('group_members_group_idx').on(t.groupId)],
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
  (t) => [primaryKey({ columns: [t.documentId, t.groupId] })],
)
