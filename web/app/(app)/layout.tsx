import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { Rail } from './_components/Rail'
import { TourProvider } from './_components/tour/TourProvider'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  const [mem, admin, csrf] = await Promise.all([
    db.query.memberships.findFirst({
      where: and(eq(memberships.userId, auth.user.id), eq(memberships.workspaceId, auth.workspace.id)),
    }),
    getSuperAdmin(),
    issueCsrf(),
  ])
  return (
    <TourProvider
      locale={auth.user.locale}
      role={mem?.role === 'owner' ? 'owner' : 'member'}
      csrf={csrf}
      // user_tour_steps doesn't exist yet (spec §6) — persistence and
      // auto-start are a later task. This keeps the tour start()-only.
      seenSteps={[]}
      tourDismissed={false}
    >
      <div className="flex min-h-dvh max-md:flex-col">
        <Rail
          workspace={auth.workspace.name}
          userName={auth.user.name}
          isOwner={mem?.role === 'owner'}
          isSuperAdmin={admin !== null}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TourProvider>
  )
}
