/**
 * ============================================================================
 * THE DICTIONARY SHAPE — one structural contract, three languages.
 * ============================================================================
 * `content/uz.ts`, `content/ru.ts` and `content/en.ts` are each annotated
 * `: Dictionary`, so TypeScript refuses to compile a translation that has
 * dropped a section, misspelled a key, or invented one. That check is the only
 * thing standing between a trilingual site and a page that silently renders
 * `undefined` in the language nobody on the team reads.
 *
 * WHY TYPES HERE RATHER THAN `typeof en`:
 * deriving the contract from English would make English privileged — its
 * literal strings would become the type, and it would be the only file allowed
 * to add a key. Every language is a peer; the shape belongs to neither.
 *
 * WHAT IS *NOT* IN HERE: paths (see `content/routes.ts`) and the brand name
 * and domain (see `content/brand.ts`). Neither is copy, so neither is
 * translated, and both live in exactly one place.
 */

/* ---------------------------------------------------------------------------
 * Shared primitives
 * ------------------------------------------------------------------------- */

/** One <span> per line of a display headline. The line breaks are typography. */
export type Headline = string[]

export type Link = {
  href: string
  label: string
}

/** The eight artifact kinds the swarm and the /product glyphs both know about. */
export type ArtifactKind = 'doc' | 'sheet' | 'pdf' | 'scan' | 'email' | 'chat' | 'image' | 'audio'

export type Meta = {
  title: string
  description: string
}

/* ---------------------------------------------------------------------------
 * Site chrome — nav, footer, and the words the language switcher needs
 * ------------------------------------------------------------------------- */

export type SiteCopy = {
  /** Brand name and domain live in content/brand.ts — these are the sentences. */
  tagline: string
  description: string
}

export type LocaleSwitcherCopy = {
  /** The accessible name of the control, e.g. "Language". */
  label: string
}

/** Strings that exist only for assistive technology. Still copy; still translated. */
export type NavA11yCopy = {
  primary: string
  home: string
  openMenu: string
  closeMenu: string
}

/**
 * The live readout in the bottom-right corner. It is `aria-hidden` decoration,
 * but it is on screen for the whole scroll, so it gets translated like anything
 * else a visitor can read.
 */
export type TelemetryCopy = {
  artifacts: string
  sourcesCited: string
  queries: string
  dataEgress: string
  egressValue: string
  state: string
  /** One label per beat of the screenplay — the engine's own SceneId set. */
  scenes: {
    hero: string
    problem: string
    turn: string
    ask: string
    sovereign: string
    features: string
    proof: string
    pricing: string
    cta: string
  }
}

export type FooterCopy = {
  blurb: string
  status: string
  groups: {
    title: string
    links: Link[]
  }[]
}

/* ---------------------------------------------------------------------------
 * Homepage — the scroll screenplay, one key per scene
 * ------------------------------------------------------------------------- */

export type HeroCopy = {
  eyebrow: string
  headline: Headline
  sub: string
  scrollCue: string
  /** The two telemetry lines that boot under the hero. */
  systemOnline: string
  egressLabel: string
  egressValue: string
}

export type ProblemCopy = {
  label: string
  headline: Headline
  body: string
  beats: { stat: string; line: string }[]
}

export type TurnCopy = {
  label: string
  headline: Headline
  body: string
  seal: string
}

export type AskCopy = {
  label: string
  headline: Headline
  body: string
  question: string
  answer: { text: string; cite: number }[]
  /** `name` is an illustrative filename and is never translated. */
  sources: { id: number; kind: ArtifactKind; name: string; detail: string }[]
  /** aria-label pattern for a citation chip: "{n}" and "{name}" are substituted. */
  sourceAria: string
  footnote: string
}

export type SovereignCopy = {
  label: string
  headline: Headline
  body: string
  beats: { label: string; value: string }[]
}

export type FeaturesCopy = {
  label: string
  headline: Headline
  items: { n: string; title: string; body: string }[]
}

export type ProofCopy = {
  label: string
  headline: Headline
  body: string
  metrics: { value: number; suffix: string; label: string; note: string }[]
}

export type HomeCtaCopy = {
  label: string
  headline: Headline
  body: string
  formLabel: string
  formPlaceholder: string
  submit: string
  sending: string
  fineprint: string
  success: string
  error: string
}

/** The pricing beat on the homepage. The plans themselves come from `pricing`. */
export type HomePricingCopy = {
  /** No eyebrow: the headline IS the section's name here. */
  headline: Headline
  body: string
  /** Link through to the full /pricing page. */
  more: string
}

/* ---------------------------------------------------------------------------
 * /product
 * ------------------------------------------------------------------------- */

export type ProductCopy = {
  meta: Meta
  /** Rendered as "Chapter 01" above each section head. */
  chapterLabel: string
  hero: {
    eyebrow: string
    headline: Headline
    sub: string
    pipeline: string[]
  }
  ingest: {
    chapter: string
    label: string
    headline: Headline
    body: string
    sources: { kind: ArtifactKind; name: string; note: string }[]
    footnote: string
  }
  organize: {
    chapter: string
    label: string
    headline: Headline
    body: string
    beats: { title: string; body: string }[]
    permission: { label: string; title: string; body: string; emphasis: string }
  }
  ask: {
    chapter: string
    label: string
    headline: Headline
    body: string
    demo: {
      label: string
      question: string
      answerLabel: string
      answer: { text: string; cite: number }[]
      telemetry: string[]
      sourcesLabel: string
      /** Rendered as "Sources · 4 artifacts"; "{n}" is substituted. */
      sourcesCount: string
      sources: { id: number; kind: ArtifactKind; name: string; detail: string }[]
      backLabel: string
      sourceAria: string
      caption: string
    }
    pipelineLabel: string
    pipeline: { title: string; body: string }[]
    construction: string
    empty: { title: string; body: string }
    footnote: string
  }
  close: {
    label: string
    headline: Headline
    body: string
    primary: Link
    secondary: Link
  }
}

/* ---------------------------------------------------------------------------
 * /security
 * ------------------------------------------------------------------------- */

export type SecurityCopy = {
  meta: Meta
  hero: { label: string; headline: Headline; sub: string }
  rail: { label: string; value: string }[]
  perimeter: {
    label: string
    headline: Headline
    body: string
    modes: { n: string; name: string; line: string }[]
  }
  dataflow: {
    label: string
    headline: Headline
    body: string
    wallLabel: string
    stages: { label: string; title: string; line: string }[]
    audit: { label: string; line: string }
    barriers: { dir: 'outbound' | 'inbound'; label: string; target: string; note: string }[]
    caption: string
  }
  directions: {
    label: string
    headline: Headline
    body: string
    /** The eyebrow on each "run this yourself" line. */
    verifyLabel: string
    items: { label: string; title: string; body: string; verify: string }[]
  }
  permissions: {
    label: string
    headline: Headline
    body: string
    points: string[]
    close: string
    closeNote: string
    trace: {
      label: string
      asker: string
      /** `file` is an illustrative filename and is never translated. */
      rows: { ok: boolean; file: string; state: string }[]
    }
  }
  audit: {
    label: string
    headline: Headline
    body: string
    rows: { k: string; v: string }[]
  }
  inheritance: {
    label: string
    headline: Headline
    body: string
    rows: { control: string; line: string }[]
    frameworks: { label: string; body: string }
  }
  notClaiming: {
    label: string
    headline: Headline
    body: string
    items: { claim: string; line: string }[]
    close: string
    closeNote: string
  }
  cta: { label: string; headline: Headline; body: string; fineprint: string }
}

/* ---------------------------------------------------------------------------
 * /pricing
 * ------------------------------------------------------------------------- */

export type Plan = {
  id: string
  name: string
  /** Non-null on exactly one plan — the emphasized card. */
  badge: string | null
  who: string
  /**
   * The number as it is printed, currency symbol included — or the word that
   * stands in for one on the plan that genuinely has no list price.
   */
  price: string
  /** "/ month", "per person / month", or empty where a period is meaningless. */
  period: string
  /** The line under the number: what the number buys, or what gets scoped. */
  priceNote: string
  features: string[]
  cta: string
}

export type PricingCopy = {
  meta: Meta
  /** No eyebrow: the headline IS the section's name here. */
  hero: { headline: Headline; sub: string }
  plans: Plan[]
  /** Billing terms under the grid. Currency, cadence, tax. */
  plansNote: string
  everyTier: {
    label: string
    headline: Headline
    items: { label: string; value: string }[]
  }
  faq: {
    label: string
    headline: string
    items: { q: string; a: string }[]
  }
  cta: {
    label: string
    headline: Headline
    body: string
    submit: string
    href: string
    fineprint: string
  }
}

/* ---------------------------------------------------------------------------
 * /about
 * ------------------------------------------------------------------------- */

export type AboutCopy = {
  meta: Meta
  hero: { eyebrow: string; headline: Headline; sub: string }
  position: {
    label: string
    headline: Headline
    body: string[]
    ledger: {
      colWho: string
      colWhy: string
      rows: { who: string; why: string }[]
    }
    closer: string
    closerBody: string
  }
  beliefs: {
    label: string
    headline: Headline
    items: { n: string; title: string; body: string }[]
  }
  stage: {
    label: string
    headline: Headline
    body: string
    inventory: { k: string; v: string }[]
    have: string
  }
  lab: {
    label: string
    headline: Headline
    body: string
    note: string
    roles: { n: string; title: string; focus: string; nameSlot: string; body: string }[]
  }
  cta: { label: string; headline: Headline; body: string; fineprint: string }
}

/* ---------------------------------------------------------------------------
 * /contact
 * ------------------------------------------------------------------------- */

export type ContactCopy = {
  meta: Meta
  hero: { eyebrow: string; headline: Headline; lede: string }
  fit: {
    label: string
    title: string
    body: string
    points: { label: string; line: string }[]
    trade: string
  }
  next: {
    label: string
    title: string
    steps: { n: string; line: string }[]
    promise: string
  }
  form: {
    title: string
    intro: string
    fields: {
      email: { label: string; hint: string; placeholder: string }
      company: { label: string; hint: string; placeholder: string }
      role: { label: string; hint: string; placeholder: string }
      scattered: { label: string; hint: string; placeholder: string }
    }
    submit: string
    sending: string
    errors: { emailRequired: string; emailInvalid: string }
    success: { title: string; body: string }
    failure: { title: string; body: string }
    /** `address` is the real mailbox and is never translated. */
    fallback: { lead: string; address: string; subject: string }
  }
}

/* ---------------------------------------------------------------------------
 * /privacy, /terms and the 404
 * ------------------------------------------------------------------------- */

export type LegalSection = {
  heading: string
  body: string[]
  /** Rendered as a list. Used where plain prose would turn into a run-on. */
  list?: string[]
}

export type LegalDoc = {
  label: string
  title: string
  description: string
  headline: Headline
  standfirst: string
  sections: LegalSection[]
  note: { label: string; heading: string; body: string }
  contact: { heading: string; body: string }
}

export type LegalCopy = {
  /** `updatedISO` is machine-readable and identical in every language. */
  meta: { updatedISO: string; updatedLabel: string; updatedPrefix: string }
  privacy: LegalDoc
  terms: LegalDoc
}

export type NotFoundCopy = {
  label: string
  title: string
  description: string
  headline: Headline
  body: string
  footnote: string
  artifact: { caption: string; status: string }
  home: string
  linksLabel: string
  sectionsAria: string
}

/* ---------------------------------------------------------------------------
 * The whole thing
 * ------------------------------------------------------------------------- */

export type Dictionary = {
  site: SiteCopy
  localeSwitcher: LocaleSwitcherCopy
  skipToContent: string
  navA11y: NavA11yCopy
  nav: Link[]
  cta: Link
  footer: FooterCopy
  home: {
    hero: HeroCopy
    problem: ProblemCopy
    turn: TurnCopy
    ask: AskCopy
    sovereign: SovereignCopy
    features: FeaturesCopy
    proof: ProofCopy
    pricing: HomePricingCopy
    cta: HomeCtaCopy
    telemetry: TelemetryCopy
    /** Text equivalent for the canvas. Required, not optional. */
    canvasAlt: string
  }
  product: ProductCopy
  security: SecurityCopy
  pricing: PricingCopy
  about: AboutCopy
  contact: ContactCopy
  legal: LegalCopy
  notFound: NotFoundCopy
}

/** The homepage slice, which is what crosses the server/client boundary. */
export type HomeCopy = Dictionary['home']
