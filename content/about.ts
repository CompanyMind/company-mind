/**
 * ============================================================================
 * /about — every word of copy on the About page lives here.
 * ============================================================================
 * Same contract as content/site.ts: components import from this file and never
 * inline their own strings.
 *
 * HONESTY RULES apply here harder than anywhere else on the site, because this
 * is the page where a company is most tempted to lie about itself. CompBrain is
 * pre-launch: no customers, no revenue, no certifications, and no team page.
 *
 *   1. NO named people. NO bios. NO headshots. NO initials-in-a-circle standing
 *      in for a human who does not exist. `lab.roles` describes the WORK, not
 *      the people doing it. Names go in only when there are real ones.
 *   2. NO certification claims — and no framework name-dropping either, not even
 *      in the negative. `stage.inventory` says we hold none, in plain language,
 *      without printing a list of acronyms a skimming reader could misread as a
 *      badge shelf.
 *   3. NO invented history. This page argues a POSITION, because a position is
 *      something a pre-launch company genuinely has. A story about our journey
 *      since 2019 is not.
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make the company sound bigger, older, or more validated.
 */

export const aboutMeta = {
  title: 'About',
  description:
    'The best AI arrives as an API — and the institutions holding the most sensitive data in the economy can never call it. Why CompBrain builds sovereign knowledge infrastructure, and an honest account of where we stand.',
} as const

/* ---------------------------------------------------------------------------
 * HERO — state the position in four lines. No company history, because there
 * isn't one worth reciting yet.
 * ------------------------------------------------------------------------- */
export const aboutHero = {
  eyebrow: 'About',
  // Short lines on purpose: display-lg is 2.5rem at 375px, so anything longer
  // than ~14 characters starts wrapping and the beat breaks.
  headline: ['The best AI', 'runs on', 'someone else’s', 'computer.'],
  sub: 'For a bank, a hospital, a defense supplier or a law firm, that is not a tradeoff to weigh. It is a non-starter. So the institutions holding the most consequential information in the economy are sitting out the most useful technology in a generation. That is the thing worth fixing.',
} as const

/* ---------------------------------------------------------------------------
 * THE POSITION — why sovereign knowledge infrastructure should exist at all.
 * ------------------------------------------------------------------------- */
export const position = {
  label: 'The position',
  headline: ['Capability arrived with', 'a condition attached.'],
  body: [
    'Every meaningful jump in AI over the last three years shipped the same way: as an endpoint. To use it, you send your data to a company you do not control, running on hardware you cannot inspect, under terms you did not write. For most businesses that is a fine trade. For some, it ends the conversation in the first meeting.',
    'It is not caution and it is not technophobia. It is the job. You cannot answer to a supervisor with a vendor’s privacy policy. You cannot put privileged material in someone else’s log. The rules these institutions operate under are not a preference they could be talked out of — they are the reason anyone trusts them with the data in the first place.',
  ],
  ledger: {
    colWho: 'Who is locked out',
    colWhy: 'Why',
    rows: [
      {
        who: 'A bank',
        why: 'Customer records it answers to a regulator for, on a schedule, in writing.',
      },
      {
        who: 'A hospital',
        why: 'Patient data it is obligated to protect, under rules it does not get to reinterpret.',
      },
      {
        who: 'A defense supplier',
        why: 'Programs that are not permitted to touch a public network at all.',
      },
      {
        who: 'A law firm',
        why: 'Client material it holds under privilege and cannot hand to a third party.',
      },
    ],
  },
  closer: 'The technology works for them. The delivery model does not.',
  closerBody:
    'Nobody is going to fix that from the outside, because the incentive runs the other way: a hosted endpoint is easier to build, easier to meter, and easier to sell. So we are building the other option — the same class of system, delivered inside the wall instead of across it.',
} as const

/* ---------------------------------------------------------------------------
 * BELIEFS — the three things the product refuses to compromise on. Each one is
 * a design constraint we already live with, not an aspiration.
 * ------------------------------------------------------------------------- */
export const beliefs = {
  label: 'What we believe',
  headline: ['Three things we are', 'not flexible about.'],
  items: [
    {
      n: '01',
      title: 'An answer without a source is a rumor.',
      body: 'In a regulated business, an unattributed answer is not an answer — it is work. Somebody now has to go find out whether it is true. CompBrain builds answers out of retrieved spans and cites every clause back to the artifact it came from, because an answer you cannot check is worth less than no answer at all.',
    },
    {
      n: '02',
      title: 'Software should run where the data already lives.',
      body: 'Moving sensitive data is the risky part of most architectures, and most vendors resolve it by asking you to do it anyway. We think the deployment bends to the institution: your datacenter, your VPC, your air-gapped rack. Your controls already cover that boundary. We do not ask you to draw a new one around us.',
    },
    {
      n: '03',
      title: 'Control is not the price of capability.',
      body: 'Choosing between capable AI and custody of your own information is an artifact of how this industry decided to ship, not a property of the technology. Run the models on your hardware and keep the index on your disks and the tradeoff stops existing. Harder to build. Not impossible.',
    },
  ],
} as const

/* ---------------------------------------------------------------------------
 * STAGE — the honest inventory. Pre-launch stated plainly, because a regulated
 * buyer can smell a company overselling its maturity from across the room, and
 * that is the first thing that costs you the deal.
 *
 * NOTE on `inventory[1]`: it says we hold no certifications WITHOUT naming any
 * framework. Naming them — even to deny them — puts the acronyms on the page
 * for a skimming reader to misattribute. Say the true thing; don't decorate it.
 * ------------------------------------------------------------------------- */
export const stage = {
  label: 'Stage',
  headline: ['Pre-launch.', 'We will say so plainly.'],
  body: 'CompBrain is being built with a small number of regulated teams who have this problem badly enough to help us solve it properly. Everything else about our stage is on this page, in the plainest terms we can manage, because the alternative is asking you to discover it later.',
  inventory: [
    {
      k: 'Customers',
      v: 'None yet. There is no logo strip on this site because there is nothing honest to put in one.',
    },
    {
      k: 'Certifications',
      v: 'None. We hold no security certifications today and we will not imply otherwise with a badge. When we have been audited, we will say so, and you will be able to check it.',
    },
    {
      k: 'Case studies',
      v: 'None. Pre-launch means there is nothing deployed long enough to write one worth reading.',
    },
    {
      k: 'Revenue',
      v: 'None. We are not selling seats yet. We are choosing partners.',
    },
  ],
  have: 'What we do have: a position we can defend line by line, and an architecture whose properties are true on day one of any deployment because they follow from how it is built rather than from how many people bought it.',
} as const

/* ---------------------------------------------------------------------------
 * THE LAB — roles, not people.
 *
 * ⚠️ THERE ARE NO NAMES IN THIS FILE AND THERE MUST NOT BE ANY UNTIL THEY ARE
 * REAL. Each role describes work that genuinely has to be done to ship sovereign
 * software. When there are real humans to attach, add `name` (and only then) to
 * a role below — app/about/page.tsx marks exactly where it renders.
 * ------------------------------------------------------------------------- */
export const lab = {
  label: 'The lab',
  headline: ['A small lab,', 'on purpose.'],
  body: 'Sovereign software is an engineering problem long before it is a sales problem. It has to install into a building we have never entered, on hardware we do not control, with no route home and nobody from CompBrain in the room. That work rewards a small team that can hold the whole system in its head. Below is how it divides.',
  note: 'Roles, not headshots. The names go up when there are real ones.',
  roles: [
    {
      n: '01',
      title: 'Founder / ML',
      focus: 'position · retrieval · grounding',
      nameSlot: 'name to follow',
      body: 'Owns the model layer: retrieval, grounding, and the post-training work that keeps an answer inside the source material it was built from. Decides what CompBrain refuses to do. Also the person who replies to your first email.',
    },
    {
      n: '02',
      title: 'Systems',
      focus: 'deployment · inference · air gap',
      nameSlot: 'name to follow',
      body: 'Owns the install. Packages CompBrain so it lands in a datacenter we have never seen, runs inference on the customer’s own GPUs, and takes upgrades across an air gap without a support engineer standing next to the rack.',
    },
    {
      n: '03',
      title: 'Applied research',
      focus: 'ingestion · retrieval quality · evaluation',
      nameSlot: 'name to follow',
      body: 'Works the hostile end of the problem: scans that are pictures of text, recordings nobody transcribed, spreadsheets that are secretly databases. Builds the evaluation harness that measures quality inside the customer’s boundary, because we never get to look at their data ourselves.',
    },
    {
      n: '04',
      title: 'Security engineering',
      focus: 'perimeter · audit trail · review',
      nameSlot: 'name to follow',
      body: 'Reads our architecture the way a customer’s auditor is going to read it, then builds what that auditor will ask for: data-flow documentation, deployment topology, an audit trail that lands in the customer’s own systems. Their controls do the verifying. Our job is to leave them nothing to guess about.',
    },
  ],
} as const

/* ---------------------------------------------------------------------------
 * CTA — design-partner recruitment, not a waitlist. Distinct from the
 * homepage's `homeCta` on purpose: this one closes an argument.
 * ------------------------------------------------------------------------- */
export const aboutCta = {
  label: 'Design partners',
  headline: ['If your data cannot', 'leave, we should talk.'],
  body: 'We are choosing a small number of regulated teams to build this with. You get the system inside your walls and real influence over what it becomes. We get the only thing worth having before launch: the truth about whether it works.',
  fineprint: 'One reply from a human. No sequence, no drip.',
} as const
