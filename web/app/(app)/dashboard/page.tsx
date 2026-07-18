import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

export default async function Dashboard() {
  const auth = await getCurrentUser()
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">
        Welcome{auth?.user.name ? `, ${auth.user.name}` : ''}.
      </h1>
      <p className="mt-2 text-body text-ink-soft">
        Workspace <strong className="text-ink">{auth?.workspace.name}</strong>. Upload and ask
        arrive in Plan 2–3.
      </p>
    </div>
  )
}
