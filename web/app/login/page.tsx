'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <form action={action} className="w-full max-w-sm rounded-lg bg-paper-raised p-8 shadow-card">
        <h1 className="font-display text-2xl text-ink">Sign in to CompBrain</h1>
        <p className="mt-1 text-body-sm text-ink-soft">Closed beta — invite only.</p>
        <label className="mt-6 block text-body-sm text-ink-soft" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
        />
        <label className="mt-4 block text-body-sm text-ink-soft" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
        />
        {state?.error && <p className="mt-3 text-body-sm text-sovereign-text">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-ink px-4 py-2 text-body text-paper disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
