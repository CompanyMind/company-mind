import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships, userTourSteps } from '@/lib/db/schema'
import { Rail } from './_components/Rail'
import { TourProvider } from './_components/tour/TourProvider'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  // user_tour_steps and users.tour_dismissed_at are auth-owned tables (spec
  // §6), so web reads them directly via Drizzle here — the same pattern as
  // `mem` below — rather than through the engine. `auth.user` already
  // carries `tourDismissedAt` (the full `users` row, see session-store.ts).
  const [mem, admin, csrf, seenStepRows] = await Promise.all([
    db.query.memberships.findFirst({
      where: and(eq(memberships.userId, auth.user.id), eq(memberships.workspaceId, auth.workspace.id)),
    }),
    getSuperAdmin(),
    issueCsrf(),
    db.query.userTourSteps.findMany({
      where: and(
        eq(userTourSteps.userId, auth.user.id),
        eq(userTourSteps.workspaceId, auth.workspace.id),
      ),
      columns: { stepKey: true },
    }),
  ])
  return (
    <TourProvider
      locale={auth.user.locale}
      role={mem?.role === 'owner' ? 'owner' : 'member'}
      csrf={csrf}
      seenSteps={seenStepRows.map((r) => r.stepKey)}
      tourDismissed={auth.user.tourDismissedAt !== null}
    >
      <div className="flex min-h-dvh max-md:flex-col">
        <Rail
          workspace={auth.workspace.name}
          userName={auth.user.name}
          isOwner={mem?.role === 'owner'}
          isSuperAdmin={admin !== null}
          locale={auth.user.locale}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TourProvider>
  )
}
