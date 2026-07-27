import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Space_Grotesk, IBM_Plex_Mono, Inter } from 'next/font/google'
import { isMotion, isTheme, MOTION_COOKIE, THEME_COOKIE } from '@/lib/theme'
import './globals.css'

// Display — a confident wide grotesque. Massive scale, tight tracking.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-display',
})

// Mono — telemetry, file names, labels. NEVER body copy.
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

// Body — a clean neutral that gets out of the way.
const body = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' })

export const metadata: Metadata = {
  title: { default: 'CompanyMind', template: '%s — CompanyMind' },
  description: 'On-premise knowledge platform.',
  // The product lives behind auth — it is not public content to index.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Both, so the browser's own chrome matches the palette actually in effect
  // rather than staying cream behind a dark app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3EEE3' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1917' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read from a cookie rather than from the session: this layout also wraps
  // /login, where there is no session yet, and a signed-out visitor's chosen
  // theme should still hold. The durable store is users.theme; the cookie is
  // the mirror that makes a server render possible.
  //
  // These attributes are the whole no-flash mechanism. styles/tokens.css keys
  // `color-scheme` off them, and light-dark() resolves against color-scheme —
  // so the correct palette is in effect on the first paint, with no inline
  // script. 'system' is rendered as a real value so an explicit choice can
  // always beat the media query.
  //
  // Reading cookies() opts these routes into dynamic rendering. Every
  // authenticated route already is (runtime = 'nodejs', getCurrentUser() per
  // render); /login joins them, which is acceptable for a page that sets a
  // session cookie on submit anyway.
  const jar = await cookies()
  const themeCookie = jar.get(THEME_COOKIE)?.value
  const motionCookie = jar.get(MOTION_COOKIE)?.value
  const theme = isTheme(themeCookie) ? themeCookie : 'system'
  const motion = isMotion(motionCookie) ? motionCookie : 'system'
  return (
    <html
      lang="en"
      data-theme={theme}
      data-motion={motion}
      className={`${display.variable} ${mono.variable} ${body.variable}`}
    >
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  )
}
