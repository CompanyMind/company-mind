'use client'

import { useActionState } from 'react'
import { submitPasswordChange } from './actions'

// Outside the (app) route group on purpose. That layout redirects here whenever
// mustChangePassword is set, so a page inside it would redirect to itself
// forever.
export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState(submitPasswordChange, undefined)
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <form action={action} className="w-full max-w-sm rounded-lg bg-paper-raised p-8 shadow-card">
        <h1 className="font-display text-2xl text-ink">Choose your own password</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Your account was created with a temporary password that whoever set it up still knows.
          Pick your own — everywhere else you are signed in will be signed out.
        </p>

        <label className="mt-6 block text-body-sm text-ink-soft" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
        />

        <label className="mt-4 block text-body-sm text-ink-soft" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="pw-hint"
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
        />
        <p id="pw-hint" className="mt-1 text-body-sm text-ink-soft">
          At least 12 characters. Length beats punctuation.
        </p>

        <label className="mt-4 block text-body-sm text-ink-soft" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
        />

        {state?.error && (
          <p role="alert" className="mt-4 text-body-sm text-sovereign-text">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </main>
  )
}
