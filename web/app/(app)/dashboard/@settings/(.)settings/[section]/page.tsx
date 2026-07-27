import { notFound } from 'next/navigation'
import { loadSettingsData } from '../../../settings/load'
import { isSection } from '../../../settings/section-keys'
import { SettingsShell } from '../../../settings/SettingsShell'

export const runtime = 'nodejs'

/**
 * Settings as a modal over whatever you were doing.
 *
 * This is the intercepted half of the pair: reached by client-side navigation
 * from anywhere under /dashboard, it renders into the layout's @settings slot
 * on top of the page already there — so Escape puts you back in your thread
 * with its scroll position intact. A hard refresh on the same URL falls through
 * to settings/[section]/page.tsx and renders a full page instead.
 *
 * `(.)` because the interceptor and the route it intercepts are both direct
 * children of dashboard/, which is what makes the marker correct regardless of
 * how deep the navigation originated (/dashboard/c/[chatId], say).
 */
export default async function SettingsModal({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!isSection(section)) notFound()
  const data = await loadSettingsData()
  return <SettingsShell section={section} asModal data={data} />
}
