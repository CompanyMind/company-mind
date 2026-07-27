import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Lazy connection: the postgres client and Drizzle instance are created on the
// first query, not at import. This keeps `next build` from needing DATABASE_URL
// (it imports these modules while collecting page data) while still failing fast
// with a clear error the first time a request actually touches the database.
//
// Cached on globalThis rather than in a module-level binding, because Next's dev
// server re-evaluates this module on every hot reload. With a plain `let`, each
// recompile built a NEW pool of 10 and abandoned the old one — an editing
// session runs Postgres out of connections in well under an hour, and the
// symptom ("sorry, too many clients already") looks nothing like its cause.
// Production evaluates the module once, so the global is inert there; it is
// still used in both so the two paths cannot diverge.
type Cache = { sql?: Sql; db?: PostgresJsDatabase<typeof schema> }
const globalCache = globalThis as unknown as { __cmDb?: Cache }
const cache: Cache = (globalCache.__cmDb ??= {})

function connect(): PostgresJsDatabase<typeof schema> {
  if (!cache.db) {
    cache.sql = postgres(env.DATABASE_URL, { max: 10 })
    cache.db = drizzle(cache.sql, { schema })
  }
  return cache.db
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop, receiver) {
    const target = connect() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(target, prop, receiver)
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
  },
})

/** Close the pool. Used by one-shot scripts (seed) so the process can exit. */
export async function closeDb(): Promise<void> {
  if (cache.sql) await cache.sql.end()
  cache.sql = undefined
  cache.db = undefined
}
