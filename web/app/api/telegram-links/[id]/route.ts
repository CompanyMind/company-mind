import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { telegramLinks } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const link = await db.query.telegramLinks.findFirst({
    where: and(eq(telegramLinks.id, id), eq(telegramLinks.workspaceId, auth.workspace.id)),
  })
  if (!link) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { action } = (await req.json().catch(() => ({}))) as { action?: string }
  if (action === 'approve') {
    await db
      .update(telegramLinks)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(telegramLinks.id, id))
  } else if (action === 'block') {
    await db.update(telegramLinks).set({ status: 'blocked' }).where(eq(telegramLinks.id, id))
  } else {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
