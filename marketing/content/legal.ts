/**
 * ============================================================================
 * LEGAL (/privacy, /terms) + THE 404. ALL COPY FOR THOSE THREE PAGES.
 * ============================================================================
 * Same contract as content/site.ts: components import from here and never
 * inline their own strings.
 *
 * ⚠️ NOT LEGALLY REVIEWED. READ BEFORE LAUNCH. ⚠️
 * The privacy and terms pages below are deliberate STUBS, written to be TRUE
 * for a pre-launch marketing site whose only interactive surface is a contact
 * form. They are honest, not complete. Specifically, they deliberately do NOT:
 *
 *   - name a jurisdiction or governing law
 *   - name the legal entity, its registration, or its address
 *   - state warranties, liability caps, or indemnities
 *   - name subprocessors (hosting, email) — required for a real GDPR notice
 *   - describe retention periods in days
 *
 * Inventing any of those would be worse than omitting them: a regulated buyer
 * who catches one invented clause stops trusting every other claim on the site.
 * A lawyer must write the real versions before launch, and before any customer
 * data exists. The deployment agreement — not this site — is where binding
 * terms live.
 *
 * ⚠️ THE CLAIMS BELOW ARE ONLY TRUE WHILE THE SITE STAYS THIS SMALL. ⚠️
 * "No tracking cookies. No analytics. No ad networks." is a statement of fact
 * about the current build. The day anyone adds an analytics snippet, a pixel,
 * a font CDN, or an embedded video, this file becomes a lie. Change it in the
 * same commit, or do not add the script.
 */

export type LegalSection = {
  readonly heading: string
  readonly body: readonly string[]
  /** Rendered as a list. Used where plain prose would turn into a run-on. */
  readonly list?: readonly string[]
}

export type LegalDoc = {
  /** mono eyebrow */
  readonly label: string
  /** <title> — the layout template appends "— CompanyMind" */
  readonly title: string
  readonly description: string
  /** One <span> per line of the display headline. */
  readonly headline: readonly string[]
  readonly standfirst: string
  readonly sections: readonly LegalSection[]
  /** The callout: this page is a stub, the real terms arrive with a deployment. */
  readonly note: {
    readonly label: string
    readonly heading: string
    readonly body: string
  }
  readonly contact: {
    readonly heading: string
    readonly body: string
  }
}

/** Machine date + the human rendering of it. Bump BOTH when the copy changes. */
export const legalMeta = {
  updatedISO: '2026-07-17',
  updatedLabel: '17 July 2026',
  updatedPrefix: 'Last updated',
  email: 'hello@companymind.ai',
} as const

/* ---------------------------------------------------------------------------
 * PRIVACY
 * The angle is the honest one and it happens to be the brand: this site
 * collects almost nothing, which is the same argument the product makes.
 * ------------------------------------------------------------------------- */

// Annotated rather than `as const satisfies LegalDoc`: `as const` would narrow each
// section to its own literal type, and sections without a `list` would not have the
// optional key at all — so `section.list` would not typecheck at the call site.
export const privacyDoc: LegalDoc = {
  label: 'Privacy',
  title: 'Privacy',
  description:
    'What the CompanyMind website collects: your contact form submission, and nothing else. No tracking cookies, no ad networks, no data sale.',
  headline: ['This site collects', 'almost nothing.'],
  standfirst:
    'That is not a posture we adopted for this page. It is the same argument the product makes: data you never collect cannot leak, cannot be sold, and cannot be lost. We hold the marketing site to it too.',
  sections: [
    {
      heading: 'What this site collects',
      body: [
        'One thing: what you type into the contact form. Your work email, and anything you choose to write alongside it. That reaches us as a message, and a human reads it.',
        'Nothing else on this site asks you for anything. There is no account, no login, no profile, and no preference we store on your machine.',
      ],
    },
    {
      heading: 'What this site does not do',
      body: [
        'This is a static marketing site. It is small on purpose, and the list of things it does not do is longer than the list of things it does.',
      ],
      list: [
        'No tracking cookies. No consent banner, because there is nothing to consent to.',
        'No advertising networks, no pixels, no retargeting. We will not follow you around the internet.',
        'No behavioural analytics profile of you, and no session recording.',
        'Nothing written to local storage on your device.',
        'No sale of your data. Not to anyone, at any price, for any reason.',
        'No newsletter, no drip sequence, no list you did not ask to be on.',
      ],
    },
    {
      heading: 'What we do with what you send',
      body: [
        'We read it, and we reply. We keep the message so the conversation can continue — the same way any email you send to a company persists in that company’s inbox.',
        'If you would like it deleted, write to us and we will delete it. We would rather be asked than assume.',
      ],
    },
    {
      heading: 'Serving the page itself',
      body: [
        'A web page has to come from a server, and a server sees the request. Our hosting provider processes what is technically required to deliver this site to your browser, including ordinary request logs. We do not use those to build a picture of you, and we do not enrich them with anything.',
        'This is where a full privacy notice names its providers and its retention windows. We are pre-launch and that list is not final, so we are not going to publish a version of it we might have to quietly correct. Ask us and we will tell you exactly what is in place today.',
      ],
    },
    {
      heading: 'The product is a different thing entirely',
      body: [
        'Everything above is about this website. It is not about CompanyMind the product, because the two could not be further apart.',
        'CompanyMind deploys inside your infrastructure. Your data stays there. We have no access to it, no copy of it, and no route to it — there is no vendor cloud for it to sit in, because there is no vendor cloud. What happens to data inside your deployment is governed by your controls and by the agreement we sign with you, not by this page.',
      ],
    },
  ],
  note: {
    label: 'Read this part',
    heading: 'This page is short because the site is small.',
    body: 'It covers a pre-launch marketing site with a contact form on it, and it says what is actually true today rather than reciting clauses we have not earned. The full data-protection terms — subprocessors, retention, residency, deletion, audit rights — are negotiated with, and attached to, a deployment agreement. Those are the ones that bind.',
  },
  contact: {
    heading: 'Asking us about any of this',
    body: 'One address, and a person answers it. Ask what we hold, ask us to delete it, or ask a question this page does not cover.',
  },
}

/* ---------------------------------------------------------------------------
 * TERMS
 * The honest frame: this site is not the product, so its terms are not the
 * contract. Do not invent a jurisdiction to sound more official.
 * ------------------------------------------------------------------------- */

export const termsDoc: LegalDoc = {
  label: 'Terms',
  title: 'Terms',
  description:
    'Terms for the CompanyMind website: what is on it, what the contact form does and does not mean, and where the terms that actually bind live.',
  headline: ['This site is', 'not the product.'],
  standfirst:
    'CompanyMind is pre-launch. Here you can read about what we are building and ask to talk to us. These terms cover exactly that, and nothing more.',
  sections: [
    {
      heading: 'What these terms cover',
      body: [
        'Your use of this website. That is the entire scope.',
        'No software is offered, licensed, sold, or delivered from this site. So this is not a software agreement, and reading it does not put you in one.',
      ],
    },
    {
      heading: 'What is written here',
      body: [
        'A description of a product being built for regulated organizations, deployed on their own infrastructure. We have worked hard to describe it precisely, to claim nothing we cannot support, and to hold no certification we do not have.',
        'It is still a description of software in development. What it does, what it costs, and when it ships can all change before there is anything for either of us to sign. Treat it as our current intent, stated plainly — not as a commitment.',
      ],
    },
    {
      heading: 'What we ask of you',
      body: [
        'Read it, link to it, quote it, send it to a colleague. None of that needs our permission.',
        'The words, the design and the code are ours. Do not pass them off as yours, and do not attack the site or scrape it into the ground. That is the whole list.',
      ],
    },
    {
      heading: 'The contact form',
      body: [
        'Send us a work email if you would like to talk. Sending it does not create an agreement, reserve anything, lock a price, or oblige either of us to do a thing. It starts a conversation with a person.',
        'Do not send confidential material through it. It is a form on a marketing site, and it is not a channel built for anything sensitive. If you need one, ask, and we will arrange it properly.',
      ],
    },
    {
      heading: 'Where the binding terms live',
      body: [
        'Not here. If we work together, a deployment agreement governs the software, the data, the security commitments, support, liability, and every other thing that actually matters. It is negotiated, it is signed, and it is specific to you.',
        'Until that exists, everything on this site is marketing. We would rather say so than dress a web page up as a contract.',
      ],
    },
  ],
  note: {
    label: 'Read this part',
    heading: 'These are deliberately not full terms.',
    body: 'You will not find a governing law clause, a liability cap, a warranty, or a disclaimer in capital letters. That is not an oversight. There is nothing here to warrant yet, and naming a jurisdiction for a site that only hosts a contact form would be theatre. The real terms are drafted for the real thing, and they arrive with a deployment agreement.',
  },
  contact: {
    heading: 'Questions about any of this',
    body: 'Ask before you assume. If something here reads as a promise we did not intend to make, we want to know — and we will fix the wording.',
  },
}

/* ---------------------------------------------------------------------------
 * 404
 * The brand metaphor, played straight: an artifact that is not in the index.
 * The product's rule is "no source, no claim" — so this page does not guess.
 * No exclamation marks, no cartoon, no apology.
 * ------------------------------------------------------------------------- */

export const notFoundCopy = {
  label: '404 · no source found',
  title: 'Not in the index',
  description: 'That page is not part of this site.',
  headline: ['Not in', 'the index.'],
  body: 'The page you asked for is not part of this site. It may have moved, it may never have existed, and we are not going to guess which.',
  footnote:
    'No source, no claim. That rule runs the product, so it runs this page too. Everything else is one link away.',
  artifact: {
    /** Reads under the ghost card. Mono — it is telemetry, not prose. */
    caption: 'requested artifact',
    status: 'not indexed · 0 sources',
  },
  home: 'Back to the homepage',
  linksLabel: 'Or go straight to',
  contactLink: { href: '/contact', label: 'Contact' },
} as const
