import { brand } from '@/content/brand'
import type { LegalCopy, LegalDoc } from '@/content/types'

/**
 * /privacy and /terms, which are the same page twice.
 *
 * Previously each route owned its own near-identical copy of this markup, with
 * a note saying "extract <LegalPage> if a third one ever appears". Three
 * languages arrived before a third document did — six copies of the same JSX is
 * well past the point where the duplication stops being cheap.
 *
 * A Server Component: it is prose and hairlines, and there is nothing here
 * worth shipping JavaScript for.
 */
export function LegalPage({ doc, meta }: { doc: LegalDoc; meta: LegalCopy['meta'] }) {
  return (
    <article className="pb-24 pt-[calc(var(--nav-h)+4rem)] md:pb-32 md:pt-[calc(var(--nav-h)+7rem)]">
      <header className="shell">
        <p className="mono-label">{doc.label}</p>
        <h1 className="mt-6 font-display text-display-md text-ink">
          {doc.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft md:text-xl">
          {doc.standfirst}
        </p>
        <p className="mt-10 font-mono text-telemetry uppercase tracking-[0.08em] text-ink-soft">
          {meta.updatedPrefix} <time dateTime={meta.updatedISO}>{meta.updatedLabel}</time>
        </p>
      </header>

      <div className="shell mt-14 md:mt-20">
        {doc.sections.map((section, i) => (
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
          <p className="mono-label text-brain-text">{doc.note.label}</p>
          <h2 className="mt-5 font-display text-display-sm text-ink">{doc.note.heading}</h2>
          <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">{doc.note.body}</p>
        </div>
      </aside>

      <section className="shell mt-14 md:mt-20">
        <div className="border-t border-line pt-10 md:pt-14">
          <h2 className="font-display text-display-sm text-ink">{doc.contact.heading}</h2>
          <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">{doc.contact.body}</p>
          <a
            href={`mailto:${brand.email}`}
            className="mt-7 inline-block font-mono text-sm text-ink underline decoration-line decoration-1 underline-offset-[6px] transition-colors hover:decoration-brain"
          >
            {brand.email}
          </a>
        </div>
      </section>
    </article>
  )
}
