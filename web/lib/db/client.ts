import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

// Lazy connection: the postgres client and Drizzle instance are created on the
// first query, not at import. This keeps `next build` from needing DATABASE_URL
// (it imports these modules while collecting page data) while still failing fast
// with a clear error the first time a request actually touches the database.
let _sql: Sql | undefined
let _db: PostgresJsDatabase<typeof schema> | undefined

function connect(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    _sql = postgres(env.DATABASE_URL, { max: 10 })
    _db = drizzle(_sql, { schema })
  }
  return _db
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
  if (_sql) await _sql.end()
}
