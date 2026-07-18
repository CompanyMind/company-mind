import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { SmoothScroll } from '@/components/SmoothScroll'

/**
 * Marketing chrome. Lives in a route group so it wraps only the public site —
 * the authed app and the login page inherit the bare root layout instead, and
 * never get the fixed nav (which otherwise overlaps the app header and eats its
 * clicks). URLs are unchanged: route groups don't affect the path.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  )
}
