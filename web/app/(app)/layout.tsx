import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="font-display text-ink">CompBrain</span>
        <div className="flex items-center gap-4 text-body-sm text-ink-soft">
          <span>{auth.workspace.name}</span>
          <form action="/logout" method="post">
            <button className="underline">Sign out</button>
          </form>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  )
}
