import { notFound } from 'next/navigation'
import { loadSettingsData } from '../load'
import { isSection } from '../section-keys'
import { SettingsShell } from '../SettingsShell'

export const runtime = 'nodejs'

/**
 * Settings as a standalone page — a hard refresh, a pasted link, or a browser
 * that arrived here without a client-side navigation. The intercepted route in
 * @settings renders the same shell as a modal.
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!isSection(section)) notFound()
  const data = await loadSettingsData()
  return <SettingsShell section={section} asModal={false} data={data} />
}
