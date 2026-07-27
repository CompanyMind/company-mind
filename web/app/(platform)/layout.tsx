import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'

export const runtime = 'nodejs'

/**
 * The platform tier's own shell, deliberately NOT under `(app)`.
 *
 * `(app)/layout.tsx` requires a workspace, and the platform operator may not
 * have one: in hosted mode they run the platform and belong to no firm. Sharing
 * that layout would have meant making `workspace` nullable across all 38
 * `getCurrentUser()` call sites for the sake of this one screen.
 *
 * There is no Rail here either, on purpose — the rail's Ask/Sources/Access items
 * all need a workspace.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // 404 rather than redirect, so the tier's existence is never disclosed.
  if (!(await getSuperAdmin())) notFound()

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg text-ink">CompanyMind</span>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
              platform
            </span>
          </div>
          <nav className="flex items-center gap-4 text-body-sm text-ink-soft">
            <Link href="/dashboard" className="underline underline-offset-2 hover:text-ink">
              My workspace
            </Link>
            <form action="/logout" method="post">
              <button className="underline underline-offset-2 hover:text-ink">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
    </div>
  )
}
