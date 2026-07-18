import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, IBM_Plex_Mono, Inter } from 'next/font/google'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { SmoothScroll } from '@/components/SmoothScroll'
import { site } from '@/content/site'
import './globals.css'

// Display — a confident wide grotesque. Massive scale, tight tracking. No serifs.
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
const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

export const metadata: Metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  keywords: [
    'on-premise AI',
    'enterprise knowledge base',
    'sovereign AI',
    'air-gapped AI',
    'cited answers',
    'regulated industries',
    'data residency',
    'self-hosted knowledge management',
  ],
  authors: [{ name: site.name }],
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: `https://${site.domain}`,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#F3EEE3',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <SmoothScroll />
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-[100] rounded-sm bg-ink px-4 py-2 font-mono text-telemetry text-paper"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
