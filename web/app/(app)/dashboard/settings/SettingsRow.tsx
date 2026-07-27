'use client'

/**
 * The row grammar of the whole Settings surface: label on the left, control on
 * the right, a hairline between. One primitive so four sections cannot drift
 * into four different-looking forms.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: string
  /** When the control is a single labellable input, pass its id and the label
   *  becomes a real <label> — clicking the text focuses the control. */
  htmlFor?: string
  children?: React.ReactNode
}) {
  const Label = htmlFor ? 'label' : 'span'
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-b-0 max-md:flex-col max-md:items-start max-md:gap-2">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="block text-body text-ink">
          {label}
        </Label>
        {description && <p className="mt-0.5 text-body-sm text-ink-soft">{description}</p>}
      </div>
      {children && <div className="shrink-0 max-md:w-full">{children}</div>}
    </div>
  )
}

export function SettingsSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10 last:mb-0">
      <h3 className="mb-1 font-display text-lg text-ink">{heading}</h3>
      <div>{children}</div>
    </section>
  )
}

/**
 * A segmented control. Used for Appearance and Motion, where the options are
 * few, mutually exclusive and worth seeing all at once — a <select> would hide
 * two of three behind a click for no gain.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-line bg-paper p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          data-on={value === o.value}
          className="rounded-md px-3 py-1 text-body-sm text-ink-soft data-[on=true]:bg-paper-raised data-[on=true]:text-ink data-[on=true]:shadow-artifact"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line-control bg-paper px-3 py-1.5 text-body-sm text-ink'
