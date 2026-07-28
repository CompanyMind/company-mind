import type { Session } from '@/lib/auth/session-store'

/**
 * A `Session` for route tests.
 *
 * Five test files each hand-rolled this object, and every one of them predated
 * `sessionId` being added to `Session` — 44 `tsc` errors that neither
 * `next build` nor `npm test` reported, because Next does not typecheck test
 * files and vitest does not typecheck at all. One helper means the next field
 * added to `Session` is one edit, not five, and it fails loudly here rather
 * than silently everywhere.
 *
 * `user` and `workspace` are cast: routes under test only ever read `.id`, and
 * building two full Drizzle rows would be pages of noise asserting nothing.
 * The cast is deliberately narrow — the ids are real values, so a route that
 * reads the wrong one still fails.
 */
export function fakeSession(over: Partial<Session> = {}): Session {
  return {
    sessionId: 's1',
    user: { id: 'u1' } as Session['user'],
    workspace: { id: 'w1' } as Session['workspace'],
    role: 'member',
    ...over,
  }
}

/** The owner shape `getOwner()` resolves to. */
export function fakeOwner(over: Partial<{ userId: string; workspaceId: string }> = {}) {
  return { userId: 'u1', workspaceId: 'w1', ...over }
}
