/**
 * ============================================================================
 * PRICING PAGE COPY — every word rendered at /pricing lives here.
 * ============================================================================
 * Same contract as content/site.ts: components import from this file and never
 * inline their own strings. See README §"Editing copy".
 *
 * HONESTY RULES apply here with extra force, because a pricing page is where a
 * company is most tempted to lie. CompanyMind is pre-launch: no customers, no
 * revenue, no certifications. Therefore, on this page specifically:
 *
 *   1. NO dollar amounts, seat counts, discounts, or "starting at" figures.
 *      There is no price book yet, so any number would be fiction. The absence
 *      is a POSITION — on-prem is scoped, not shrink-wrapped — and the copy
 *      states that position instead of hiding behind "contact sales".
 *   2. NO certification claims (SOC 2 / HIPAA / ISO 27001 / FedRAMP). The FAQ
 *      says "no" out loud. Frameworks appear ONLY as the customer's own
 *      obligations, which our deployment model helps THEM keep.
 *   3. NO SLAs, uptime figures, response times, or deployment durations. We
 *      have never run a production deployment; every such number would be made
 *      up. "Dedicated support" is a commitment we can keep. "99.9%" is not.
 *   4. NO social proof of any kind — no customer counts, logos, testimonials.
 *      The featured tier is marked "Company-wide" (a description of scope), NOT
 *      "Most popular" (a claim about customers we do not have).
 *   5. Feature lines describe ARCHITECTURE, which is knowable today. They never
 *      describe outcomes, which are not.
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make the page convert harder.
 */

export const pricingMeta = {
  title: 'Pricing',
  description:
    'Three ways to run CompanyMind — a guided pilot, a company-wide deployment, or a fully air-gapped install on your own hardware. On-prem is quoted against your estate, not printed on a page.',
} as const

export const pricingHero = {
  label: 'Pricing',
  // The no-price is the headline, said in the affirmative. It is a statement
  // about how on-prem software is bought, not an apology for a missing number.
  headline: ['Scoped, not', 'shrink-wrapped.'],
  sub: 'Three ways to run CompanyMind, from one team to a room with no internet route. What it costs depends on what it runs on — so we quote it, we do not print it.',
} as const

/**
 * The three tiers. `price` occupies the slot where a dollar figure would sit on
 * anyone else's pricing page. It is deliberately specific about WHAT gets
 * scoped, so it reads as an answer rather than a dodge.
 */
export const tiers = [
  {
    id: '01',
    name: 'Pilot',
    badge: null,
    who: 'For one team that wants to prove it on their own data before the company commits to anything.',
    priceLabel: 'What it costs',
    price:
      'Quoted against a scope you set: which team, which sources, which machine. Nothing to sign beyond the pilot itself.',
    features: [
      'One team, one deployment, one clearly drawn scope.',
      'Runs inside your infrastructure from the first day. Nothing is uploaded to us.',
      'Guided onboarding — we connect your first sources alongside your people.',
      'Your real corpus, not a demo dataset. The messy files are the point.',
      'Cited answers from day one. Every claim opens the source it came from.',
    ],
    cta: 'Scope a pilot',
  },
  {
    id: '02',
    // The emphasized tier. Emphasis is carried by --brain and a solid button,
    // never by --sovereign (reserved for the perimeter pulse and the home CTA).
    name: 'Deployment',
    badge: 'Company-wide',
    who: 'For a company ready to put the brain in front of everyone who needs to ask it something.',
    priceLabel: 'What it costs',
    price:
      'Quoted against your estate: how much you ingest, how many people ask, and what it runs on.',
    features: [
      'Everything in the pilot, opened to the whole company.',
      'Runs in your VPC, behind the network controls you already operate.',
      'SSO through your identity provider. No second set of passwords.',
      'Permission sync — each person is answered only from what they were already cleared to see.',
      'Audit export — every question, answer and source, into your logging.',
      'Upgrades applied by your team, on your schedule.',
    ],
    cta: 'Scope a deployment',
  },
  {
    id: '03',
    name: 'Sovereign',
    badge: null,
    who: 'For rooms with no internet route and no exceptions — classified, clinical, or contractual.',
    priceLabel: 'What it costs',
    price:
      'Quoted against the environment: your hardware, your models, your constraints. Every sovereign install is its own engagement.',
    features: [
      'Everything in a deployment, with no outbound path at all.',
      'Air-gapped install. Models, index and interface ship together.',
      'Your hardware, your racks, your physical control.',
      'Custom models tuned on your domain, trained inside your boundary.',
      'Offline updates. Media in, nothing out.',
      'Dedicated support — a direct line to the engineers who built it.',
    ],
    // "Scope a sovereign install" wrapped to two lines and broke the CTA row.
    // The card is already titled Sovereign, so the word was redundant anyway.
    cta: 'Scope an install',
  },
] as const

/**
 * The constants. These are true in every tier because they follow from the
 * architecture, not from the contract — which is the whole argument of the
 * product, restated where a competitor would put a feature-comparison matrix.
 */
export const everyTier = {
  label: 'In every tier',
  headline: ['True in every', 'tier, by construction.'],
  items: [
    {
      label: 'Deployment',
      value: 'Every tier is on-prem. What changes between them is scale, never exposure.',
    },
    {
      label: 'Egress',
      value: 'Nothing calls home. No telemetry, no phone-home, no model API in the loop.',
    },
    {
      label: 'Citations',
      value: 'Every claim traces to the artifact it came from. No source, no claim.',
    },
    {
      label: 'Audit trail',
      value: 'Questions, answers and sources logged in your systems, on your retention schedule.',
    },
  ],
} as const

export const faq = {
  label: 'Straight answers',
  headline: 'The questions a price list would dodge.',
  items: [
    {
      q: 'Why are there no prices on this page?',
      a: 'Because on-prem software is not shrink-wrapped. What it costs depends on how much you ingest, how many people ask it questions, and whose hardware it runs on. A price list would be a guess set in a large font. We would rather quote you something true after one conversation.',
    },
    {
      q: 'What does "on-prem" mean here, exactly?',
      a: 'That the software runs where your data already lives — your datacenter, your VPC, or a machine with no route to the internet. There is no vendor cloud behind it quietly doing the real work. We have no access to your deployment and no path to your data.',
    },
    {
      q: 'What actually happens in a pilot?',
      a: 'We install CompanyMind in your environment and connect a real set of your sources alongside your team. Then your people ask it real questions and check the citations against the originals. You are testing it on your own corpus, on your own hardware, with your own mess — which is the only test that tells you anything.',
    },
    {
      q: 'What does a deployment involve on our side?',
      a: 'Somewhere to run it, credentials to the sources you want ingested, and your identity provider for SSO. Your team performs the install and we do it with them, rather than throwing a tarball over the wall. Sizing depends on your corpus, so it belongs in the scoping conversation and not in a footnote here.',
    },
    {
      // The load-bearing honest answer. A regulated buyer asks this first, and
      // any hedge here costs the deal permanently. Say no, then say why the
      // architecture is the better answer than a badge would be.
      q: 'Are you SOC 2 or HIPAA certified?',
      a: 'No. CompanyMind holds no certifications, and we will not imply otherwise with a badge. What we offer is architectural: the software runs inside the boundary your obligations already cover, so your controls, your logging and your auditors reach it exactly the way they reach everything else in your estate. The certifications are yours. Our job is to not make them harder to keep.',
    },
    {
      q: 'Can we start with a pilot and grow into a deployment?',
      a: 'Yes. A pilot runs the same software as a full deployment — it is not a demo build with the interesting parts removed. Growing means widening the scope: more sources, more people, more hardware. It is not a migration.',
    },
  ],
} as const

export const pricingCta = {
  label: 'Design partners',
  headline: ['Every tier starts', 'with the same call.'],
  // Says the quiet part out loud: we are pre-launch. A regulated buyer will
  // find out in the first five minutes anyway, and finding out from us is worth
  // more than the impression of momentum we would trade it for.
  body: 'CompanyMind is pre-launch. We are building it with a small number of regulated teams who have this problem badly enough to help us solve it properly. Tell us what is scattered and where it is not allowed to go, and we will tell you what a deployment would look like.',
  submit: 'Start the conversation',
  href: '/contact',
  fineprint: 'One reply from a human. No sequence, no drip, no newsletter.',
} as const
