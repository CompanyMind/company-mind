import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { issueCsrf } from '@/lib/csrf'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { userTourSteps } from '@/lib/db/schema'
import { Rail } from './_components/Rail'
import { TourProvider } from './_components/tour/TourProvider'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) {
    // A platform operator in `hosted` mode owns no firm, so getCurrentUser
    // (which requires a membership) returns null for them. Without this branch
    // they would be redirected to /login, sign in successfully, land back here
    // and be redirected again — an unbreakable loop for the one account that
    // exists to administer the platform.
    const platform = await getSuperAdmin()
    redirect(platform ? '/platform' : '/login')
  }
  // Every admin-created account carries mustChangePassword until its holder
  // sets their own. Enforced HERE and not in validateSessionToken, because a
  // choke-point check would also lock them out of the page that clears it.
  // This is hygiene, not a defence against the account's own holder — see
  // docs/superpowers/specs/2026-07-27-tenancy-and-three-tier-admin-design.md §6.
  if (auth.user.mustChangePassword) redirect('/change-password')
  // user_tour_steps and users.tour_dismissed_at are auth-owned tables (spec
  // §6), so web reads them directly via Drizzle here — the same pattern as
  // `mem` below — rather than through the engine. `auth.user` already
  // carries `tourDismissedAt` (the full `users` row, see session-store.ts).
  const [admin, csrf, seenStepRows] = await Promise.all([
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
      role={auth.role}
      csrf={csrf}
      seenSteps={seenStepRows.map((r) => r.stepKey)}
      tourDismissed={auth.user.tourDismissedAt !== null}
    >
      <div className="flex min-h-dvh max-md:flex-col">
        <Rail
          workspace={auth.workspace.name}
          userName={auth.user.name}
          isOwner={auth.role === 'owner'}
          isSuperAdmin={admin !== null}
          locale={auth.user.locale}
          deploymentMode={env.DEPLOYMENT_MODE}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TourProvider>
  )
}
