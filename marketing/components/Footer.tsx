import Link from 'next/link'
import { brand } from '@/content/brand'
import type { FooterCopy } from '@/content/types'
import { localePath, type Locale } from '@/i18n/config'
import { Wordmark } from './Wordmark'

/**
 * Minimal, telemetry-styled. Closes the page the way the hero opened it:
 * with a quiet true statement about egress.
 *
 * A Server Component — it takes its copy as a prop and renders three static
 * link columns, so there is nothing here worth shipping JavaScript for.
 */
export function Footer({ locale, copy }: { locale: Locale; copy: FooterCopy }) {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 mt-px border-t border-line bg-paper-sunk">
      <div className="shell grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div className="max-w-xs">
          <Wordmark className="text-ink" />
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{copy.blurb}</p>
        </div>

        {copy.groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="mono-label">{group.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={localePath(locale, link.href)}
                    className="text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* The status line. Same sentence the telemetry rail has been holding all
          the way down the page — it is true here too. */}
      <div className="border-t border-line">
        <div className="shell flex flex-col gap-3 py-5 font-mono text-telemetry text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {brand.name}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brain" aria-hidden="true" />
            {copy.status}
          </span>
        </div>
      </div>
    </footer>
  )
}
