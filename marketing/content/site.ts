/**
 * ============================================================================
 * EVERY WORD OF MARKETING COPY ON THIS SITE LIVES HERE.
 * ============================================================================
 * Components import from this file and never inline their own strings, so copy
 * can be rewritten without touching a single component. See README §"Editing copy".
 *
 * HONESTY RULES — these are load-bearing, not stylistic. CompanyMind is pre-launch:
 * no customers, no revenue, no certifications. Therefore:
 *
 *   1. NEVER claim SOC 2 / HIPAA / ISO 27001 / FedRAMP or any certification.
 *      Frameworks may appear ONLY as obligations the CUSTOMER has, which our
 *      deployment model helps them meet.
 *   2. NEVER invent customer counts, logos, testimonials, or named people.
 *   3. Every number in PROOF must be true BY CONSTRUCTION (see `proof` below).
 *   4. Trust claims are verifiable, never absolute:
 *        "every answer cited to its source"  ✓
 *        "100% accurate"                     ✗
 *   5. Security claims are architectural, never absolute:
 *        "your data never leaves your infrastructure"  ✓
 *        "unhackable"                                  ✗
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make the copy sound more impressive.
 */

export const site = {
  name: 'CompanyMind',
  domain: 'companymind.ai',
  tagline: 'Everything your company knows. Behind your own walls.',
  description:
    'CompanyMind turns every file, chat, image and call your company owns into one brain you can ask — deployed entirely inside your own infrastructure, with every answer traced back to its source.',
} as const

export const nav = [
  { href: '/product', label: 'Product' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
] as const

export const cta = {
  label: 'Become a design partner',
  href: '/contact',
} as const

/* ---------------------------------------------------------------------------
 * HOMEPAGE — the scroll screenplay. One scene per beat.
 * ------------------------------------------------------------------------- */

export const hero = {
  eyebrow: 'On-premise knowledge infrastructure',
  // The swarm SHOWS the chaos, so the headline never has to describe it.
  // It states the product and the differentiator in one breath.
  headline: ['Everything your', 'company knows.', 'Behind your own walls.'],
  sub: 'One brain for every file, chat, image and call — deployed entirely inside your infrastructure.',
  scrollCue: 'Scroll',
} as const

export const problem = {
  label: 'The problem',
  headline: ['Your company already', 'knows the answer.', 'Nobody can find it.'],
  body: 'It is in a thread from March. In a PDF someone renamed. In a voice note nobody transcribed. In the fourth version of a file called final.',
  beats: [
    {
      stat: 'Buried',
      line: 'The answer exists. It is nine tools and two departments away from the person who needs it.',
    },
    {
      stat: 'Duplicated',
      line: 'Four versions of the same document. Three are wrong. Nothing says which.',
    },
    {
      stat: 'Lost',
      line: 'The person who knew left in April. Their knowledge left with them.',
    },
    {
      stat: 'Unsearchable',
      line: 'Search matches filenames, not meaning. It cannot read the image, the audio, or the scan.',
    },
  ],
} as const

export const turn = {
  label: 'The turn',
  headline: ['One brain.', 'Everything in it.'],
  body: 'CompanyMind ingests every source your company owns and organizes it into a single connected index. Duplicates merge. Formats stop mattering. What was scattered becomes one thing you can ask.',
  // Fires when the ingestion completes and the perimeter pulses.
  seal: 'And none of it left your walls.',
} as const

export const ask = {
  label: 'Trustworthy',
  headline: ['Ask anything.', 'Trace every word back.'],
  body: 'Answers are constructed from what your data actually says. Every clause carries a citation to the artifact it came from — click it and you are looking at the source.',
  // The demonstration answer rendered in scene 4. Each clause maps to a source.
  question: 'What did we commit to on data residency in the Meridian contract?',
  answer: [
    { text: 'All customer data stays in-region with no cross-border transfer', cite: 1 },
    { text: 'and the retention window was negotiated down to 18 months', cite: 2 },
    { text: 'after Legal flagged the original 36-month term.', cite: 3 },
  ],
  sources: [
    { id: 1, kind: 'pdf', name: 'meridian_msa_executed.pdf', detail: 'Schedule 2 · §4.1 · p.14' },
    {
      id: 2,
      kind: 'sheet',
      name: 'contract_terms_tracker.xlsx',
      detail: 'Row 87 · "Retention (mo)"',
    },
    { id: 3, kind: 'email', name: 're: Meridian redlines', detail: 'Legal · 12 Mar · 09:41' },
  ],
  footnote: 'No source, no claim. If the data does not say it, CompanyMind does not either.',
} as const

export const sovereign = {
  label: 'Sovereign',
  headline: ['Nothing leaves.', 'Nothing foreign enters.'],
  body: 'CompanyMind runs where your data already lives — your datacenter, your VPC, or a machine with no route to the internet at all. There is no vendor cloud to trust, because there is no vendor cloud.',
  beats: [
    { label: 'Outbound', value: 'Nothing calls home. No telemetry, no phone-home, no model API.' },
    { label: 'Inbound', value: 'No inbound path from us. We have no access to your deployment.' },
    { label: 'Air-gap', value: 'Runs fully offline. Models and index ship with the deployment.' },
  ],
} as const

export const features = {
  label: 'Capability',
  headline: ['Built for the companies', 'that cannot use the cloud.'],
  items: [
    {
      n: '01',
      title: 'Ingest everything',
      body: 'Documents, spreadsheets, PDFs, email, chat, images and audio. Scans get read. Calls get transcribed. Formats stop being a reason things go missing.',
    },
    {
      n: '02',
      title: 'Cited answers',
      body: 'Every clause traces to the artifact it came from. Open the original in one click and verify it yourself. Grounded in your data — not in what a model remembers.',
    },
    {
      n: '03',
      title: 'Permission-aware',
      body: 'The brain honors the access control you already have. People get answers only from what they were already cleared to see. Nothing is flattened into one index everyone can read.',
    },
    {
      n: '04',
      title: 'Air-gap capable',
      body: 'Deploy on a network with no internet route. Models, index and interface all run locally. Nothing in the system requires an outbound connection.',
    },
    {
      n: '05',
      title: 'Audit trail',
      body: 'Every question, every answer, every source consulted — logged in your systems, queryable by your auditors, retained on your schedule.',
    },
  ],
} as const

/**
 * PROOF — pre-launch, so there are NO traction numbers here.
 * Each of these is true BY CONSTRUCTION, i.e. it follows from how the system is
 * built rather than from how many people bought it. Do not add latency or
 * accuracy figures: they are unverifiable until there is a real deployment.
 */
export const proof = {
  label: 'Proof',
  headline: ['True by construction.'],
  body: 'We are pre-launch, so these are not customer counts. They are properties of the architecture — things that are true on day one of any deployment, because they follow from how it is built.',
  metrics: [
    {
      value: 0,
      suffix: ' bytes',
      label: 'Data egress',
      note: 'Nothing calls out. There is no outbound path to have a number greater than zero.',
    },
    {
      value: 12,
      suffix: '',
      label: 'Source formats',
      note: 'Ingest adapters implemented today, from .docx to .m4a to scanned .tiff.',
    },
    {
      value: 100,
      suffix: '%',
      label: 'Answers carrying a citation',
      note: 'Answers are assembled from retrieved spans. An uncited claim cannot be constructed.',
    },
    {
      value: 1,
      suffix: '',
      label: 'Deployment — yours',
      note: 'Single-tenant by design. No shared index, no pooled infrastructure, no neighbours.',
    },
  ],
} as const

export const homeCta = {
  // Pre-launch and honest about it: this is design-partner recruitment,
  // not a generic "join the waitlist" for a product that ships tomorrow.
  label: 'Design partners',
  headline: ['We are choosing', 'a few design partners.'],
  body: 'CompanyMind is being built with a small number of regulated teams who have this problem badly enough to help us solve it properly. If your knowledge is scattered and your data cannot leave, we should talk.',
  formLabel: 'Work email',
  formPlaceholder: 'you@company.com',
  submit: 'Start the conversation',
  fineprint: 'One reply from a human. No sequence, no drip, no newsletter.',
  success: 'Received. We will be in touch shortly.',
  error: 'That did not send. Email us directly at hello@companymind.ai.',
} as const

/* ---------------------------------------------------------------------------
 * TEXT EQUIVALENT for the canvas. The swarm is aria-hidden decoration; this is
 * the story it tells, for anyone who cannot see it. Required, not optional.
 * ------------------------------------------------------------------------- */
export const canvasAlt =
  'An animated diagram on warm paper. A drawn boundary marks the edge of your infrastructure. Inside it, scattered documents, chat messages, PDFs, images, emails, spreadsheets and voice notes drift in disorder — some duplicated, some faded and lost. As the page scrolls, they flow inward and organize into a single connected lattice: one brain. A question travels through it and returns an answer, with lines drawn from each part of the answer back to the exact source it came from. Nothing ever crosses the boundary.'

export const footer = {
  blurb:
    'One brain for everything your company knows. On your infrastructure, cited to the source.',
  status: 'data egress: 0 bytes',
  groups: [
    {
      title: 'Product',
      links: [
        { href: '/product', label: 'How it works' },
        { href: '/security', label: 'Security' },
        { href: '/pricing', label: 'Pricing' },
      ],
    },
    {
      title: 'Company',
      links: [
        { href: '/about', label: 'About' },
        { href: '/contact', label: 'Contact' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { href: '/privacy', label: 'Privacy' },
        { href: '/terms', label: 'Terms' },
      ],
    },
  ],
} as const
