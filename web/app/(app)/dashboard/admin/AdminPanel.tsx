'use client'

import { useCallback, useEffect, useState } from 'react'

type AdminUserRow = {
  id: string
  email: string
  name: string | null
  workspace: string | null
  role: string | null
  createdAt: string
  lastLoginAt: string | null
  blocked: boolean
  isSuperAdmin: boolean
}

type QuestionTypeMix = {
  lookup: number
  comparison: number
  aggregate: number
  enumerate: number
}

type UsageCounters = {
  questions: number
  activeUsers: number
  documentsIndexed: number
  folders: number
  questionTypes: QuestionTypeMix
  lexicalArmEmpty: number
  answerUncited: number
}

type WorkspaceUsage = UsageCounters & { workspaceId: string; name: string }

type UsageSummary = {
  days: number
  workspaces: WorkspaceUsage[]
  totals: UsageCounters
  perDay: { date: string; questions: number; activeUsers: number }[]
  totalUsers: number
}

type WorkspaceOption = { id: string; name: string }

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// Both degradation counts are raw counts of questions, not rates — the rate
// against that same window's question count is what's actually actionable.
function pct(n: number, of: number): string {
  if (of === 0) return '—'
  return `${Math.round((n / of) * 100)}%`
}

export function AdminPanel({
  csrf,
  workspaces,
  currentUserId,
}: {
  csrf: string
  workspaces: WorkspaceOption[]
  currentUserId: string
}) {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [role, setRole] = useState<'member' | 'owner'>('member')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ email: string; tempPassword: string } | null>(
    null,
  )

  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ur, usr] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/usage')])
    if (ur.ok) setUsers((await ur.json()).users)
    if (usr.ok) setUsage(await usr.json())
    setLoadError(ur.ok && usr.ok ? null : 'Could not load admin data.')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !workspaceId) return
    setCreating(true)
    setCreateError(null)
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ email: trimmedEmail, name: name.trim() || null, workspaceId, role }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setCreateError(data.error ?? 'Could not create that account.')
        return
      }
      setCreatedPassword({ email: data.user.email, tempPassword: data.tempPassword })
      setEmail('')
      setName('')
      setRole('member')
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function toggleBlock(user: AdminUserRow) {
    setBusyId(user.id)
    setActionError(null)
    try {
      const r = await fetch(`/api/admin/users/${user.id}/block`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ blocked: !user.blocked }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setActionError(data.error ?? 'Could not update that account.')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-6 space-y-10">
      <section>
        <h2 className="font-display text-lg text-ink">Usage</h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          Trailing {usage?.days ?? 30} days, aggregate only — no individual question is ever shown
          here.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Questions" value={usage?.totals.questions} />
          <Stat label="Active users" value={usage?.totals.activeUsers} />
          <Stat label="Documents indexed" value={usage?.totals.documentsIndexed} />
          <Stat label="Accounts" value={usage?.totalUsers} />
        </div>

        <p className="mt-4 text-body-sm text-ink-soft">
          <strong className="text-ink">Lexical-empty rate</strong> is the share of questions where the
          keyword half of retrieval came back with nothing and the answer ran on semantic search
          alone — it is the single most actionable number here, since a high rate for a workspace
          usually means its indexing or tokenization needs attention.{' '}
          <strong className="text-ink">Uncited rate</strong> is the share of answers that shipped with
          no source citation at all.
        </p>

        {loadError && <p className="mt-3 text-body-sm text-sovereign-text">{loadError}</p>}

        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line bg-paper-sunk font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                <th className="px-3 py-2">Workspace</th>
                <th className="px-3 py-2">Questions</th>
                <th className="px-3 py-2">Active users</th>
                <th className="px-3 py-2">Documents</th>
                <th className="px-3 py-2">Folders</th>
                <th className="px-3 py-2">Lexical-empty</th>
                <th className="px-3 py-2">Uncited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(usage?.workspaces ?? []).map((w) => (
                <tr key={w.workspaceId}>
                  <td className="px-3 py-2 text-ink">{w.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{w.questions}</td>
                  <td className="px-3 py-2 text-ink-soft">{w.activeUsers}</td>
                  <td className="px-3 py-2 text-ink-soft">{w.documentsIndexed}</td>
                  <td className="px-3 py-2 text-ink-soft">{w.folders}</td>
                  <td className="px-3 py-2 text-ink-soft">{pct(w.lexicalArmEmpty, w.questions)}</td>
                  <td className="px-3 py-2 text-ink-soft">{pct(w.answerUncited, w.questions)}</td>
                </tr>
              ))}
              {usage && usage.workspaces.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-soft">
                    No activity in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg text-ink">Users</h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          Create an account directly into a workspace. It signs in with a generated password shown to
          you once.
        </p>

        <form
          onSubmit={createUser}
          className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-line bg-paper-raised p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@company.com"
              className="rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
              Workspace
            </span>
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            >
              {workspaces.length === 0 && <option value="">No workspaces</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'owner')}
              className="rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button
            className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-50"
            disabled={creating || !email.trim() || !workspaceId}
          >
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {createdPassword && (
          <div className="mt-4 rounded-md border border-brain bg-[color-mix(in_srgb,var(--brain)_8%,transparent)] p-4">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brain-text">
              Temporary password
            </p>
            <p className="mt-2 text-body text-ink">
              <strong>{createdPassword.email}</strong> can sign in with{' '}
              <code className="rounded bg-paper-sunk px-1.5 py-0.5 font-mono text-ink">
                {createdPassword.tempPassword}
              </code>
            </p>
            <p className="mt-2 text-body-sm text-ink-soft">
              This password is shown exactly once and will not be shown again. There is no
              in-product way for this user to change it yet — hand it to them directly.
            </p>
            <button
              onClick={() => setCreatedPassword(null)}
              className="mt-2 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        )}

        {createError && <p className="mt-3 text-body-sm text-sovereign-text">{createError}</p>}
        {actionError && <p className="mt-3 text-body-sm text-sovereign-text">{actionError}</p>}

        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line bg-paper-sunk font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Workspace</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 text-ink">{u.email}</td>
                  <td className="px-3 py-2 text-ink-soft">{u.name ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{u.workspace ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{u.role ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{fmtDate(u.lastLoginAt)}</td>
                  <td className={`px-3 py-2 ${u.blocked ? 'text-sovereign-text' : 'text-ink-soft'}`}>
                    {u.blocked ? 'Blocked' : 'Active'}
                  </td>
                  <td className="px-3 py-2">
                    {/* The API itself refuses a self-block; hiding the button here
                        avoids offering an action that would always error. */}
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => toggleBlock(u)}
                        disabled={busyId === u.id}
                        className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-sovereign-text disabled:opacity-50"
                      >
                        {busyId === u.id ? 'Working…' : u.blocked ? 'Unblock' : 'Block'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-soft">
                    No accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-md border border-line bg-paper-raised p-3">
      <div className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl text-ink">{value ?? '—'}</div>
    </div>
  )
}
