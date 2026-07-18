/**
 * ============================================================================
 * /security — every word of it. Nothing is inlined in the page component.
 * ============================================================================
 * Audience: a CISO at a bank or a hospital. They have read a hundred vendor
 * security pages and every one of them opened with a row of badges.
 *
 * POSITIONING (founder decision): ARCHITECTURE AS THE ARGUMENT.
 * We hold no certifications, so we do not gesture at any. Instead we make the
 * stronger claim that is true TODAY: software that runs entirely inside the
 * customer's perimeter inherits the customer's controls. Every property on this
 * page follows from WHERE THE SOFTWARE RUNS, which means the reader can verify
 * it on their own network instead of believing us.
 *
 * HONESTY RULES — inherited from content/site.ts, and this page is where they
 * matter most. Breaking one here does not just weaken the copy; it loses the
 * exact buyer the page exists for.
 *
 *   1. NEVER claim SOC 2 / HIPAA / ISO 27001 / FedRAMP or any certification.
 *      Frameworks appear ONLY as obligations the CUSTOMER already carries,
 *      which our deployment model helps THEM meet. See `inheritance.frameworks`.
 *   2. NEVER invent customers, logos, testimonials or named people.
 *   3. Security claims are architectural, never absolute:
 *        "there is no outbound code path"  ✓
 *        "unhackable" / "100% secure"      ✗
 *   4. Any number must be true BY CONSTRUCTION — it follows from the build,
 *      not from traction we do not have.
 *
 * The `verify` lines are the spine of the page: each one is a test the reader
 * can run themselves. Do not add a claim here that cannot be checked that way.
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make this sound more impressive. On this page especially,
 * restraint IS the pitch.
 */

export const securityMeta = {
  title: 'Security',
  description:
    'CompanyMind runs entirely inside your perimeter. No outbound path, no vendor access, no shared tenancy — and no certification claims we have not earned. The architecture is the argument.',
} as const

export const securityHero = {
  label: 'Security',
  headline: ['We built it so you', 'never have to trust us.'],
  sub: 'CompanyMind is software that runs inside your perimeter. There is no vendor cloud, no telemetry channel, no support tunnel. Every property on this page follows from where the software runs — which means you can test it on your own network before you believe a word of it.',
} as const

/**
 * The telemetry rail. Three facts, each true by construction on day one of any
 * deployment. Rendered as mono telemetry, deliberately NOT as badges — a
 * badge-shaped graphic on a pre-launch security page is a lie about a lie.
 */
export const securityRail = [
  { label: 'egress', value: '0 bytes' },
  { label: 'vendor access', value: 'none' },
  { label: 'tenancy', value: 'single — yours' },
] as const

export const perimeter = {
  label: 'The perimeter',
  headline: ['Your walls are', 'the security boundary.'],
  body: 'CompanyMind does not bring a security boundary of its own for you to evaluate. It inherits yours. Choose where it runs; everything else on this page is a consequence of that one choice.',
  modes: [
    {
      n: '01',
      name: 'Your datacenter',
      line: 'Bare metal or your own virtualization, on hardware you already own, already rack and already audit.',
    },
    {
      n: '02',
      name: 'Your VPC',
      line: 'Your cloud account, your subnets, your security groups, your keys. We are never issued a credential to any of it.',
    },
    {
      n: '03',
      name: 'Air-gapped',
      line: 'A network with no internet route at all. Models and index ship with the deployment and run offline.',
    },
  ],
} as const

/**
 * The data-flow diagram. Rendered as DOM + SVG from these strings — no image
 * asset, no canvas, so it stays selectable, translatable and legible to a
 * screen reader. The geometry says: three local stages inside one wall, and two
 * paths across that wall which do not exist.
 */
export const dataflow = {
  label: 'Data flow',
  headline: ['Everything happens', 'inside the wall.'],
  body: 'Ingest, index and answer are all local processes. No step in this diagram requires a packet to leave your network, and no code path exists that would send one.',
  wallLabel: 'Your infrastructure',
  stages: [
    {
      label: 'Ingest',
      title: 'Your sources',
      line: 'Files, chat, email, images, audio, spreadsheets — read from where they already live.',
    },
    {
      label: 'Index',
      title: 'One brain',
      line: 'Parsed, embedded and connected locally. The access control of each source travels with it.',
    },
    {
      label: 'Answer',
      title: 'Cited back',
      line: 'Assembled from retrieved spans, each one traceable to the artifact it came from.',
    },
  ],
  audit: {
    label: 'Audit',
    line: 'Every question, every answer, every source consulted — written to your logging stack as it happens.',
  },
  barriers: [
    {
      dir: 'outbound' as const,
      label: 'No outbound path',
      target: 'Model APIs · vendor cloud · telemetry',
      note: 'Not a setting that is switched off. There is no code that dials out.',
    },
    {
      dir: 'inbound' as const,
      label: 'No inbound path',
      target: 'CompanyMind',
      note: 'No tunnel, no backdoor, no remote support session. We cannot reach your deployment.',
    },
  ],
  caption:
    'All ingest, indexing and answering happen inside your perimeter. The two paths that would cross it — outbound to a vendor, inbound from us — are absent from the build, not disabled in a config.',
} as const

export const directions = {
  label: 'The three directions',
  headline: ['Egress is zero', 'by construction.'],
  body: 'Zero is not a target we hit or a default we set. It is the only number the architecture can produce, because the thing that would make it larger was never built.',
  items: [
    {
      label: 'Outbound',
      title: 'Nothing calls home.',
      body: 'No telemetry, no usage analytics, no license check, no crash reporting, no external model API. This is not a checkbox in an admin panel that a future release could quietly flip back. There is no outbound code path to disable, which means there is nothing to leave switched on by mistake and nothing to regress in version four.',
      verify: 'Put it behind a default-deny egress rule and watch nothing break.',
    },
    {
      label: 'Inbound',
      title: 'We have no way in.',
      body: 'We hold no credentials to your deployment. There is no support tunnel, no listening service pointed at us, no vendor account provisioned at install. If you want us in the room during an incident, you bring us in through your own access process, like any other contractor — and you revoke it the same way, without asking us to cooperate.',
      verify: 'Check your directory after install. There is no account of ours in it.',
    },
    {
      label: 'Air-gap',
      title: 'Offline is the same build.',
      body: 'Models, index and interface ship together and run with no internet route at all. The air-gapped deployment is not a stripped edition with features quietly missing — it is the same software, because nothing in it wanted the internet in the first place. Updates arrive the way everything else arrives on that network: as a signed artifact you carry in, inspect, and choose to install.',
      verify: 'Pull the cable. Ask it a question. It answers.',
    },
  ],
} as const

export const permissions = {
  label: 'Access control',
  headline: ['Your permissions,', 'not a new set of ours.'],
  body: 'The failure mode of every knowledge tool is the flattened index: everything vacuumed into one searchable pool, and now a question from the wrong desk returns the board deck. CompanyMind does not build that pool.',
  points: [
    'Every indexed span carries the access control of the artifact it came from.',
    'Retrieval filters on the asker’s identity before a single span reaches the model.',
    'Identity comes from your directory — your groups, your roles, your revocations, resolved at query time rather than copied at install.',
    'A person who could not open the file cannot get an answer built from it. It does not surface in the citations, because it was never retrieved.',
  ],
  // Split deliberately: the display line is the claim, the note is the proof.
  // Set the whole thing in display type and it stops being a punch and starts
  // being a wall.
  close: 'Nothing is widened. Nothing is flattened.',
  closeNote:
    'A user’s view of the brain is exactly the view they already had of the underlying systems. Revoke someone in your directory on Friday and the brain has forgotten them by the next question.',
  // A schematic, not a screenshot. Illustrative file names only — there is no
  // customer here, and there is no product metric being implied.
  trace: {
    label: 'Retrieval · filtered by asker',
    asker: 'asker: j.reyes · group: analysts',
    rows: [
      { ok: true, file: 'q3_pricing_memo.docx', state: 'retrieved' },
      { ok: true, file: 'risk_committee_notes.md', state: 'retrieved' },
      { ok: false, file: 'board_deck_2026.pptx', state: 'not cleared · never read' },
    ],
  },
} as const

export const audit = {
  label: 'Audit',
  headline: ['Every question is', 'a logged event.'],
  body: 'Ask, answer, sources, identity, timestamp. Written into your logging stack, in your format, on your schedule — queryable by your auditors without filing a request with us.',
  rows: [
    {
      k: 'What is logged',
      v: 'The question asked, the answer returned, every source span retrieved to build it, the identity that asked, and when.',
    },
    {
      k: 'Where it lands',
      v: 'Your SIEM, your log pipeline, your storage. It is your data on your disk from the moment it is written.',
    },
    {
      k: 'How long it lives',
      v: 'Your retention schedule. We have no opinion about it and no mechanism to enforce one.',
    },
    {
      k: 'Who can read it',
      v: 'Whoever your policy says. We are not on that list, and there is no path by which we could add ourselves.',
    },
  ],
} as const

export const inheritance = {
  label: 'Inheritance',
  headline: ['Your controls', 'already cover it.'],
  body: 'Software running inside your environment falls under the controls you already run that environment with. There is very little new to evaluate here — which is the entire point of building it this way.',
  rows: [
    {
      control: 'Identity & access',
      line: 'Your IdP, your SSO, your groups, your joiner-mover-leaver process. CompanyMind authenticates against what you already run instead of standing up a user store beside it.',
    },
    {
      control: 'Network policy',
      line: 'Your segmentation, your firewall rules, your default-deny egress. It sits inside them like any other internal service, and it does not ask for an exception.',
    },
    {
      control: 'Key management',
      line: 'Your KMS or HSM. Data at rest is encrypted with keys you hold and rotate on your cadence. We never see them and could not use them if we did.',
    },
    {
      control: 'Logging & monitoring',
      line: 'Your SIEM ingests its logs. Your alerting covers it. Your on-call sees it on the same board as everything else you run.',
    },
    {
      control: 'Backup & recovery',
      line: 'It is your VMs and your volumes. Your existing backup, restore and DR runbooks apply to it unchanged.',
    },
    {
      control: 'Change management',
      line: 'Releases are artifacts you accept, stage and roll out on your schedule. Nothing updates itself, because nothing can reach out to find an update.',
    },
  ],
  /**
   * FRAMEWORKS — the one place they are named. Read the shape of this sentence
   * carefully before editing it: every framework here is an obligation the
   * READER already carries. Not one of them is described as something CompanyMind
   * has been audited against, because CompanyMind has not been audited at all.
   */
  frameworks: {
    label: 'On your obligations',
    body: 'If your obligations run through HIPAA, GLBA, DORA, PCI DSS or a regulator’s own residency rules, they attach to the environment you already operate and already evidence. Running CompanyMind inside that environment keeps it within the boundary those obligations already cover, instead of opening a second boundary that needs its own answer, its own vendor questionnaire and its own exception. The obligation stays yours. The deployment model is built so that meeting it does not require you to make a special case for us.',
  },
} as const

/**
 * The honesty block. This is not a legal disclaimer bolted on at the bottom —
 * it is a trust signal, placed where a CISO is already reaching for the
 * objection. Saying it first, unprompted and in plain type, is worth more than
 * the badge row we are refusing to fake.
 */
export const notClaiming = {
  label: 'Disclosure',
  headline: ['What we are', 'not claiming.'],
  body: 'You are going to ask. So here it is first, in our own words, before you have to drag it out of us on a call.',
  items: [
    {
      claim: 'We hold no certifications.',
      line: 'No SOC 2, no ISO 27001, no HIPAA attestation, no FedRAMP authorization. CompanyMind is pre-launch. A vendor page that implies otherwise this early is telling you something about the vendor.',
    },
    {
      claim: 'We have no customers to point at.',
      line: 'No logos, no case studies, no testimonials, no anonymous “leading global bank”. We are recruiting our first design partners now. When there are references, they will be real and named with permission.',
    },
    {
      claim: 'We will not call it unbreakable.',
      line: 'Software has bugs and ours will too. The honest claim is narrower and more useful: there is no outbound path, no vendor access and no shared tenancy — so the blast radius of our mistakes stops at your perimeter, where your controls are already standing.',
    },
    {
      claim: 'None of this is a benchmark.',
      line: 'No accuracy percentage, no latency figure, no retrieval score. We have not earned those numbers, and the ones published before a first deployment are marketing arithmetic.',
    },
  ],
  // The line the whole page has been walking toward. Short enough to land.
  close:
    'A certification is a statement about a company. An architecture is a statement about a system.',
  closeNote:
    'We would rather hand you the second one and let you check it yourself — and when the audits do come, they will describe a system that already worked this way.',
} as const

export const securityCta = {
  label: 'Design partners',
  headline: ['Send us your', 'security questionnaire.'],
  body: 'We would rather answer the hard version early. If you are working out whether this could survive your review, bring the review — the topology, the threat model, the questions your auditors will ask in month nine. We are choosing a small number of design partners in regulated environments, and this is exactly the conversation we want to be in.',
  fineprint: 'A reply from an engineer, not a sales sequence.',
} as const
