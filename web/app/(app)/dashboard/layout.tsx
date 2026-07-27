/**
 * Exists only to host the @settings parallel slot, so Settings can render as a
 * modal on top of whatever route is already showing. Every page under
 * /dashboard passes through here unchanged; `settings` is null except when the
 * interceptor matches.
 */
export default function DashboardLayout({
  children,
  settings,
}: {
  children: React.ReactNode
  settings: React.ReactNode
}) {
  return (
    <>
      {children}
      {settings}
    </>
  )
}
