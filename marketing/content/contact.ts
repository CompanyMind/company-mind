/**
 * ============================================================================
 * /contact — DESIGN-PARTNER RECRUITMENT. EVERY WORD ON THE PAGE LIVES HERE.
 * ============================================================================
 * Components import from this file and never inline their own strings, so copy
 * can be rewritten without touching a component. See README §"Editing copy".
 *
 * HONESTY RULES — inherited from content/site.ts, load-bearing, not stylistic.
 * CompanyMind is pre-launch: no customers, no revenue, no certifications.
 *
 *   1. NEVER claim SOC 2 / HIPAA / ISO 27001 / FedRAMP or any certification.
 *      Frameworks may appear ONLY as obligations the CUSTOMER already has,
 *      which our deployment model helps them meet.
 *   2. NEVER invent customer counts, logos, testimonials, or named people.
 *      This page therefore does NOT say "join 40 teams already on the list",
 *      does NOT name whoever answers the mail, and does NOT quote anyone.
 *      There is no number to give and no bio to give.
 *   3. Trust claims are verifiable, never absolute.
 *   4. Security claims are architectural, never absolute.
 *
 * ONE EXTRA RULE, SPECIFIC TO THIS PAGE:
 *   Every promise below is one a small team's inbox can actually keep — one
 *   human reply, no sequence, no newsletter. Do not add a turnaround time
 *   ("within 24 hours") unless someone is genuinely on the hook for it. A
 *   broken promise on the first touch is worse than no promise.
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make the copy sound more impressive.
 */

export const contactMeta = {
  title: 'Contact',
  description:
    'CompanyMind is choosing a small number of regulated teams to build with. If your knowledge is scattered and your data cannot leave your infrastructure, start the conversation.',
} as const

export const contactHero = {
  eyebrow: 'Design partners',
  headline: ['We are choosing', 'a few teams to', 'build this with.'],
  // States the stage plainly. A regulated buyer finds out we are pre-launch in
  // the first meeting anyway — saying it first is the only version that earns
  // anything.
  lede: 'CompanyMind is pre-launch. No customers yet, no certifications, no sales motion. What we have is an architecture we will defend and a product still soft enough to bend around the teams who help us build it.',
} as const

export const contactFit = {
  label: 'The fit',
  title: 'Who this is for',
  body: 'A bank, a hospital group, a law firm, a defense supplier. Somewhere the data genuinely cannot leave, and that is a regulator’s line rather than a preference. If you are curious about AI in general, we are the wrong call. If you have one specific pile of knowledge that nobody can search and nobody is allowed to upload, we are the right one.',
  points: [
    {
      label: 'On-prem is not negotiable',
      line: 'Your data cannot leave your infrastructure, and someone above you has already written that down.',
    },
    {
      label: 'The mess is real',
      line: 'A decade of files, threads, recordings and scans. You already know the answer is in there.',
    },
    {
      label: 'You can deploy',
      line: 'Someone on your side can give us hardware and a network to run inside.',
    },
    {
      label: 'You will argue with us',
      line: 'Design partners bend the roadmap. That only works if you tell us when we are wrong.',
    },
  ],
  // The trade, stated honestly in both directions. Early access is not a gift.
  trade:
    'The trade is plain. You get the product shaped around your problem and direct access to the people building it. You also get an unfinished product, and every bug that comes with being first.',
} as const

export const contactNext = {
  label: 'After you send',
  title: 'What happens next',
  steps: [
    { n: '01', line: 'A person reads it. Not a scoring model, not an SDR queue.' },
    { n: '02', line: 'You get one reply. If it is not a fit we say so, instead of going quiet.' },
    { n: '03', line: 'If it is, we propose a call and show you the system running.' },
  ],
  promise:
    'One reply from a human. No sequence, no drip, no newsletter. We do not sell your address, share it, or add you to a list.',
} as const

export const contactForm = {
  title: 'Start the conversation',
  intro: 'Four fields. Only the first one is required.',
  fields: {
    email: {
      label: 'Work email',
      hint: 'Required. We only use it to reply.',
      placeholder: 'you@company.com',
    },
    company: {
      label: 'Company',
      hint: 'Optional.',
      placeholder: 'Where you work',
    },
    role: {
      label: 'Role',
      hint: 'Optional.',
      placeholder: 'What you do there',
    },
    scattered: {
      label: 'What is scattered?',
      hint: 'Optional. Where does your company’s knowledge actually live right now? Two lines is plenty.',
      placeholder:
        'Ten years of contracts across three systems, and the person who wrote them left.',
    },
  },
  submit: 'Send it',
  sending: 'Sending',
  errors: {
    emailRequired: 'Enter a work email so we have somewhere to reply.',
    emailInvalid: 'That does not look like an email address.',
  },
  success: {
    title: 'Received.',
    body: 'One of us will read it and reply. Nothing else follows this — no sequence, no newsletter.',
  },
  // Shown when the request fails. Never leave someone holding a form that will
  // not send: the fallback below is a real address a real person reads.
  failure: {
    title: 'That did not send.',
    body: 'The fault is ours, not yours. Mail us directly and it lands in exactly the same place:',
  },
  fallback: {
    lead: 'Rather just email?',
    address: 'hello@companymind.ai',
    subject: 'Design partner',
  },
} as const
