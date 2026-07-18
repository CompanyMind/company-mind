import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { Sources } from './Sources'

export const runtime = 'nodejs'

export default async function Dashboard() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">
        Welcome{auth?.user.name ? `, ${auth.user.name}` : ''}.
      </h1>
      <p className="mt-2 text-body text-ink-soft">
        Workspace <strong className="text-ink">{auth?.workspace.name}</strong>. Ask arrives in Plan 3.
      </p>
      <Sources csrf={csrf} />
    </div>
  )
}
