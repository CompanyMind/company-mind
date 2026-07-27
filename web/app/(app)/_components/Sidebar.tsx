'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wordmark } from './Wordmark'
import { SidebarNav } from './SidebarNav'
import { Recents } from './Recents'
import { UserMenu } from './UserMenu'

const COLLAPSE_KEY = 'cm.sidebar.collapsed'

/**
 * The one sidebar. It replaces both the old fixed rail AND the second chat-list
 * sidebar that /dashboard rendered inside it — roughly 500px of chrome before
 * any content, in two different visual languages for the same idea.
 *
 * It lives in the (app) layout, above the routes, which is why chat selection
 * had to move into the URL first: a layout cannot see a page's state.
 */
export function Sidebar({
  csrf,
  workspace,
  userName,
  userEmail,
  isOwner,
  isSuperAdmin,
  locale,
  deploymentMode,
}: {
  csrf: string
  workspace: string
  userName: string | null
  userEmail: string
  isOwner: boolean
  isSuperAdmin: boolean
  locale: string
  deploymentMode: 'hosted' | 'onprem'
}) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Read in an effect, never during render: the server has no localStorage, and
  // a value read during render would make the first client paint disagree with
  // the server's HTML.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  function toggleCollapsed() {
    setCollapsed((c) => {
      window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  // Navigating on mobile means you picked something — the drawer has done its
  // job and should get out of the way.
  useEffect(() => setDrawerOpen(false), [path])

  return (
    <>
      {/* Mobile top bar. Replaces AskWorkspace's ad-hoc "Chats" toggle, which
          only ever opened the second sidebar and existed on one route. */}
      <div className="hidden h-14 shrink-0 items-center gap-3 border-b border-line bg-paper-sunk px-4 max-md:flex">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-raised hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h12M3 9h12M3 13h12" />
          </svg>
        </button>
        <Wordmark className="text-ink" />
      </div>

      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 hidden bg-[color-mix(in_srgb,var(--ink)_40%,transparent)] max-md:block"
          aria-hidden="true"
        />
      )}

      <aside
        style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
        className={`z-40 flex h-dvh shrink-0 flex-col gap-3 border-r border-line bg-paper-sunk px-2.5 py-3 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:!w-[17rem] max-md:transition-transform max-md:duration-200 ${
          drawerOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-1 px-1.5">
          {!collapsed && <Wordmark className="min-w-0 truncate text-ink" />}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search chats"
              aria-pressed={searchOpen}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-raised hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-raised hover:text-ink max-md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="12" height="10" rx="2" />
                <path d="M6.5 3v10" />
              </svg>
            </button>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg bg-ink px-2.5 py-2 text-body-sm text-paper hover:opacity-90"
          title={collapsed ? 'New chat' : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="shrink-0">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          <span className={collapsed ? 'sr-only' : ''}>New chat</span>
        </Link>

        <SidebarNav
          isOwner={isOwner}
          isSuperAdmin={isSuperAdmin}
          deploymentMode={deploymentMode}
          collapsed={collapsed}
        />

        {/* The chat list is the one thing a 56px rail genuinely cannot hold —
            a truncated title is not a title. Collapsed, it is simply absent;
            the New chat button and the nav are what remain. */}
        {!collapsed && (
          <>
            <div className="h-px bg-line" />
            <Recents csrf={csrf} searchOpen={searchOpen} />
          </>
        )}

        <div className="mt-auto">
          <UserMenu
            csrf={csrf}
            workspace={workspace}
            userName={userName}
            userEmail={userEmail}
            locale={locale}
            deploymentMode={deploymentMode}
            collapsed={collapsed}
          />
        </div>
      </aside>
    </>
  )
}
