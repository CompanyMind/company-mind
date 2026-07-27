'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
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
  dict,
  workspace,
  userName,
  userEmail,
  isOwner,
  isSuperAdmin,
  locale,
  deploymentMode,
}: {
  csrf: string
  /** Resolved once, server-side, in the (app) layout. Forwarded in slices to
   *  whichever child needs copy rather than each re-resolving its own. */
  dict: Dictionary
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
          aria-label={dict.nav.openNavigation}
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
        {/* Collapsed, the rail is 56px wide and has ~36px of usable width — less
            than two 28px buttons need. Laying both out here pushed the toggle
            18px PAST the sidebar's own right edge, on top of the page content.
            So collapsed shows the toggle alone, centred; the search button goes
            with it, since it filters a Recents list that is itself hidden at
            this width and would otherwise be a control over nothing. */}
        <div
          className={`flex items-center gap-1 px-1.5 ${collapsed ? 'justify-center' : 'justify-between'}`}
        >
          {!collapsed && <Wordmark className="min-w-0 truncate text-ink" />}
          <div className="flex items-center gap-0.5">
            {!collapsed && (
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={dict.nav.searchChats}
              aria-pressed={searchOpen}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-raised hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
            </button>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? dict.nav.expandSidebar : dict.nav.collapseSidebar}
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
          className={`flex items-center rounded-lg bg-ink py-2 text-body-sm text-paper hover:opacity-90 ${
            collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'
          }`}
          title={collapsed ? dict.nav.newChat : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="shrink-0">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          <span className={collapsed ? 'sr-only' : ''}>{dict.nav.newChat}</span>
        </Link>

        <SidebarNav
          dict={dict.nav}
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
            <Recents csrf={csrf} dict={dict} searchOpen={searchOpen} />
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
