import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">404</p>
      <h1 className="font-display text-3xl font-bold">This page isn’t here</h1>
      <Link
        href="/dashboard"
        className="rounded-md border border-line-control px-4 py-2 text-sm text-ink hover:bg-paper-raised"
      >
        Back to dashboard
      </Link>
    </main>
  )
}
