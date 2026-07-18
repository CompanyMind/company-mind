import type { Metadata } from 'next'
import { legalMeta, termsDoc } from '@/content/legal'

/**
 * ⚠️ NOT LEGALLY REVIEWED — A LAWYER MUST WRITE THE REAL VERSION BEFORE LAUNCH.
 * This is an honest stub for a pre-launch marketing site. It deliberately has no
 * governing law, no entity or registration number, no warranty, no liability
 * cap, no indemnity — inventing any of them would be worse than omitting them.
 * See the header of content/legal.ts for the full list and the reasoning.
 *
 * The binding terms live in the deployment agreement, not on this page. If that
 * ever stops being true — a self-serve signup, a download, a trial — these terms
 * are no longer adequate and must be replaced, not extended.
 *
 * Layout note: this page and /privacy are intentionally near-identical in
 * structure. They are not sharing a component because each page owns its file
 * in this build; if a third legal page ever appears, extract <LegalPage>.
 */

export const metadata: Metadata = {
  title: termsDoc.title,
  description: termsDoc.description,
}

export default function TermsPage() {
  return (
    <article className="pb-24 pt-[calc(var(--nav-h)+4rem)] md:pb-32 md:pt-[calc(var(--nav-h)+7rem)]">
      <header className="shell">
        <p className="mono-label">{termsDoc.label}</p>
        <h1 className="mt-6 font-display text-display-md text-ink">
          {termsDoc.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft md:text-xl">
          {termsDoc.standfirst}
        </p>
        <p className="mt-10 font-mono text-telemetry uppercase tracking-[0.08em] text-ink-soft">
          {legalMeta.updatedPrefix}{' '}
          <time dateTime={legalMeta.updatedISO}>{legalMeta.updatedLabel}</time>
        </p>
      </header>

      <div className="shell mt-14 md:mt-20">
        {termsDoc.sections.map((section, i) => (
          <section
            key={section.heading}
            className="grid gap-5 border-t border-line py-10 md:grid-cols-[4rem_1fr] md:gap-8 md:py-14"
          >
            {/* section marker — telemetry, not content, so it stays out of the a11y tree */}
            <p aria-hidden="true" className="font-mono text-telemetry text-ink-soft">
              {String(i + 1).padStart(2, '0')}
            </p>
            <div className="max-w-measure">
              <h2 className="font-display text-display-sm text-ink">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-5 leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-7 flex flex-col gap-4">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-4 leading-relaxed text-ink-soft">
                      <span aria-hidden="true" className="mt-3 h-px w-5 shrink-0 bg-brain" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <aside className="shell mt-14 md:mt-20">
        <div className="rounded-2xl border border-line bg-paper-raised p-8 shadow-card md:p-12">
          <p className="mono-label text-brain-text">{termsDoc.note.label}</p>
          <h2 className="mt-5 font-display text-display-sm text-ink">{termsDoc.note.heading}</h2>
          <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">{termsDoc.note.body}</p>
        </div>
      </aside>

      <section className="shell mt-14 md:mt-20">
        <div className="border-t border-line pt-10 md:pt-14">
          <h2 className="font-display text-display-sm text-ink">{termsDoc.contact.heading}</h2>
          <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">
            {termsDoc.contact.body}
          </p>
          <a
            href={`mailto:${legalMeta.email}`}
            className="mt-7 inline-block font-mono text-sm text-ink underline decoration-line decoration-1 underline-offset-[6px] transition-colors hover:decoration-brain"
          >
            {legalMeta.email}
          </a>
        </div>
      </section>
    </article>
  )
}
