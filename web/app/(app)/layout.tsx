import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Rail } from './_components/Rail'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  return (
    <div className="flex min-h-dvh max-md:flex-col">
      <Rail workspace={auth.workspace.name} userName={auth.user.name} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
