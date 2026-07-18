import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getSource } from '@/lib/source'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { SourceDoc } from './SourceDoc'

export const runtime = 'nodejs'

export default async function SourcePage({ params }: { params: Promise<{ chunkId: string }> }) {
  const auth = await getCurrentUser()
  const { chunkId } = await params
  // Role comes from the auth-owned memberships table; the engine resolves the
  // group-level access itself and returns the source (or null).
  const mem = auth
    ? await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, auth.user.id),
          eq(memberships.workspaceId, auth.workspace.id),
        ),
      })
    : null
  const src = auth
    ? await getSource(chunkId, auth.workspace.id, auth.user.id, mem?.role ?? 'member')
    : null

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header>
        <h1 className="font-display text-2xl text-ink">Source</h1>
        {src ? (
          <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
            {src.filename}
            {src.page ? ` · page ${src.page}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-body-sm text-ink-soft">
            This source doesn’t exist, or you don’t have access to it.
          </p>
        )}
      </header>
      {src && <SourceDoc text={src.text} charStart={src.charStart} charEnd={src.charEnd} />}
    </div>
  )
}
