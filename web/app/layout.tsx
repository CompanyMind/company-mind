import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, IBM_Plex_Mono, Inter } from 'next/font/google'
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
  themeColor: '#F3EEE3',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  )
}
