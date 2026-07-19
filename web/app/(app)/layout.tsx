import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { Rail } from './_components/Rail'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  const mem = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, auth.user.id), eq(memberships.workspaceId, auth.workspace.id)),
  })
  return (
    <div className="flex min-h-dvh max-md:flex-col">
      <Rail workspace={auth.workspace.name} userName={auth.user.name} isOwner={mem?.role === 'owner'} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
