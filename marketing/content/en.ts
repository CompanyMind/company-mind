/**
 * ============================================================================
 * ENGLISH — every word of marketing copy in this language.
 * ============================================================================
 * One file per language, all three matching `Dictionary` in content/types.ts.
 * Components import nothing from here directly: a page loads a dictionary for
 * its locale and passes the slice it needs down as props. See README §"Editing
 * copy".
 *
 * HONESTY RULES — these are load-bearing, not stylistic. CompanyMind is
 * pre-launch: no customers, no revenue, no certifications. Therefore:
 *
 *   1. NEVER claim SOC 2 / HIPAA / ISO 27001 / FedRAMP or any certification.
 *      Frameworks may appear ONLY as obligations the CUSTOMER has, which our
 *      deployment model helps them meet.
 *   2. NEVER invent customer counts, logos, testimonials, or named people.
 *   3. Every number in PROOF must be true BY CONSTRUCTION.
 *   4. Trust claims are verifiable, never absolute:
 *        "every answer cited to its source"  ✓
 *        "100% accurate"                     ✗
 *   5. Security claims are architectural, never absolute:
 *        "your data never leaves your infrastructure"  ✓
 *        "unhackable"                                  ✗
 *   6. NO SLAs, uptime figures, response times or deployment durations. We have
 *      never run a production deployment; every such number would be invented.
 *
 * ON PRICES (founder decision, 2026-07-27): Individual and Team now carry real
 * published numbers. That reverses the earlier "no figures anywhere" position,
 * which existed because there was no price book — there is one now. Enterprise
 * still has no number, because an air-gapped install genuinely is quoted
 * against an estate. Everything else above is unchanged and still binding.
 *
 * If you are an AI agent editing this file: the rules above override any
 * instinct to make the copy sound more impressive.
 */

import { brand } from './brand'
import { ROUTES } from './routes'
import type { Dictionary } from './types'

export const en: Dictionary = {
  site: {
    tagline: 'Everything your company knows. Behind your own walls.',
    description:
      'CompanyMind turns every file, chat, image and call your company owns into one brain you can ask — deployed entirely inside your own infrastructure, with every answer traced back to its source.',
  },

  localeSwitcher: { label: 'Language' },
  skipToContent: 'Skip to content',
  navA11y: {
    primary: 'Primary',
    home: `${brand.name} — home`,
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },

  nav: [
    { href: ROUTES.product, label: 'Product' },
    { href: ROUTES.security, label: 'Security' },
    { href: ROUTES.pricing, label: 'Pricing' },
    { href: ROUTES.about, label: 'About' },
  ],

  cta: { label: 'Become a design partner', href: ROUTES.contact },

  footer: {
    blurb:
      'One brain for everything your company knows. On your infrastructure, cited to the source.',
    status: 'data egress: 0 bytes',
    groups: [
      {
        title: 'Product',
        links: [
          { href: ROUTES.product, label: 'How it works' },
          { href: ROUTES.security, label: 'Security' },
          { href: ROUTES.pricing, label: 'Pricing' },
        ],
      },
      {
        title: 'Company',
        links: [
          { href: ROUTES.about, label: 'About' },
          { href: ROUTES.contact, label: 'Contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { href: ROUTES.privacy, label: 'Privacy' },
          { href: ROUTES.terms, label: 'Terms' },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------------------
   * HOMEPAGE — the scroll screenplay. One key per beat.
   * ----------------------------------------------------------------------- */
  home: {
    hero: {
      eyebrow: 'On-premise knowledge infrastructure',
      // The swarm SHOWS the chaos, so the headline never has to describe it.
      // It states the product and the differentiator in one breath.
      headline: ['Everything your', 'company knows.', 'Behind your own walls.'],
      sub: 'One brain for every file, chat, image and call — deployed entirely inside your infrastructure.',
      scrollCue: 'Scroll',
      systemOnline: 'system online',
      egressLabel: 'data egress:',
      egressValue: '0 bytes',
    },

    problem: {
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
    },

    turn: {
      label: 'The turn',
      headline: ['One brain.', 'Everything in it.'],
      body: 'CompanyMind ingests every source your company owns and organizes it into a single connected index. Duplicates merge. Formats stop mattering. What was scattered becomes one thing you can ask.',
      // Fires when the ingestion completes and the perimeter pulses.
      seal: 'And none of it left your walls.',
    },

    ask: {
      label: 'Trustworthy',
      headline: ['Ask anything.', 'Trace every word back.'],
      body: 'Answers are constructed from what your data actually says. Every clause carries a citation to the artifact it came from — click it and you are looking at the source.',
      question: 'What did we commit to on data residency in the Meridian contract?',
      answer: [
        { text: 'All customer data stays in-region with no cross-border transfer', cite: 1 },
        { text: 'and the retention window was negotiated down to 18 months', cite: 2 },
        { text: 'after Legal flagged the original 36-month term.', cite: 3 },
      ],
      sources: [
        {
          id: 1,
          kind: 'pdf',
          name: 'meridian_msa_executed.pdf',
          detail: 'Schedule 2 · §4.1 · p.14',
        },
        {
          id: 2,
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          detail: 'Row 87 · "Retention (mo)"',
        },
        { id: 3, kind: 'email', name: 're: Meridian redlines', detail: 'Legal · 12 Mar · 09:41' },
      ],
      sourceAria: 'Source {n}: {name}',
      footnote: 'No source, no claim. If the data does not say it, CompanyMind does not either.',
    },

    sovereign: {
      label: 'Sovereign',
      headline: ['Nothing leaves.', 'Nothing foreign enters.'],
      body: 'CompanyMind runs where your data already lives — your datacenter, your VPC, or a machine with no route to the internet at all. There is no vendor cloud to trust, because there is no vendor cloud.',
      beats: [
        {
          label: 'Outbound',
          value: 'Nothing calls home. No telemetry, no phone-home, no model API.',
        },
        {
          label: 'Inbound',
          value: 'No inbound path from us. We have no access to your deployment.',
        },
        {
          label: 'Air-gap',
          value: 'Runs fully offline. Models and index ship with the deployment.',
        },
      ],
    },

    features: {
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
    },

    /**
     * PROOF — pre-launch, so there are NO traction numbers here. Each of these
     * is true BY CONSTRUCTION: it follows from how the system is built rather
     * than from how many people bought it. Do not add latency or accuracy
     * figures — they are unverifiable until there is a real deployment.
     */
    proof: {
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
    },

    pricing: {
      label: 'Pricing',
      headline: ['Three plans.', 'Two of them priced here.'],
      body: 'Individual and Team are priced in the open, because they are the same software at two sizes. Enterprise runs on your own hardware behind your own walls, so it is quoted against your estate instead of printed on a page.',
      more: 'See what is in each plan',
    },

    cta: {
      // Pre-launch and honest about it: this is design-partner recruitment,
      // not a generic "join the waitlist" for a product that ships tomorrow.
      label: 'Design partners',
      headline: ['We are choosing', 'a few design partners.'],
      body: 'CompanyMind is being built with a small number of regulated teams who have this problem badly enough to help us solve it properly. If your knowledge is scattered and your data cannot leave, we should talk.',
      formLabel: 'Work email',
      formPlaceholder: 'you@company.com',
      submit: 'Start the conversation',
      sending: 'Sending…',
      fineprint: 'One reply from a human. No sequence, no drip, no newsletter.',
      success: 'Received. We will be in touch shortly.',
      error: `That did not send. Email us directly at ${brand.email}.`,
    },

    telemetry: {
      artifacts: 'artifacts',
      sourcesCited: 'sources cited',
      queries: 'queries',
      dataEgress: 'data egress',
      egressValue: '0 bytes',
      state: 'state',
      scenes: {
        hero: 'scattered',
        problem: 'unindexed',
        turn: 'ingesting',
        ask: 'answering',
        sovereign: 'sealed',
        features: 'assembling',
        proof: 'at rest',
        pricing: 'priced',
        cta: 'secured',
      },
    },

    /* TEXT EQUIVALENT for the canvas. The swarm is aria-hidden decoration; this
       is the story it tells, for anyone who cannot see it. Required. */
    canvasAlt:
      'An animated diagram on warm paper. A drawn boundary marks the edge of your infrastructure. Inside it, scattered documents, chat messages, PDFs, images, emails, spreadsheets and voice notes drift in disorder — some duplicated, some faded and lost. As the page scrolls, they flow inward and organize into a single connected lattice: one brain. A question travels through it and returns an answer, with lines drawn from each part of the answer back to the exact source it came from. Nothing ever crosses the boundary.',
  },

  /* -------------------------------------------------------------------------
   * /product — the "how it works" page.
   *
   * CAPABILITY, NOT CERTIFICATION. NO INVENTED CUSTOMERS: the filenames below
   * are ILLUSTRATIVE examples of files a customer would have in their OWN
   * deployment. The `caption` under the demo says so on the page itself — do
   * not remove it.
   * ----------------------------------------------------------------------- */
  product: {
    meta: {
      title: 'Product',
      description:
        'How CompanyMind works: every source your company owns, ingested and organized into one index you can ask — with every clause cited to the artifact it came from.',
    },
    chapterLabel: 'Chapter',

    hero: {
      eyebrow: 'How it works',
      headline: ['Everything in.', 'One answer out.', 'Nothing uncited.'],
      sub: 'CompanyMind reads every source your company already owns, organizes it into one connected index, and answers out of it. Each clause in the answer keeps a pointer back to the artifact it came from. All of it runs on your hardware.',
      pipeline: ['ingest', 'organize', 'ask', 'cite'],
    },

    ingest: {
      chapter: '01',
      label: 'Ingest',
      headline: ['Everything you own.', 'Not just the tidy parts.'],
      body: 'Point CompanyMind at a share, a mailbox, a chat export, a folder of scans. It reads what it finds. A contract, a forgotten spreadsheet tab, a photographed whiteboard and an hour-long call all arrive as the same thing: text the brain can reason over, with a path back to the original.',
      sources: [
        {
          kind: 'doc',
          name: 'q3_risk_review.docx',
          note: 'Read with its structure intact. Headings, tables and footnotes stay attached to the meaning they carry.',
        },
        {
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          note: 'Every tab, every row, every cell. Including the tab nobody has opened since the person who made it left.',
        },
        {
          kind: 'pdf',
          name: 'meridian_msa_executed.pdf',
          note: 'Parsed clause by clause, so a citation can point at Schedule 2 §4.1 rather than at page fourteen, somewhere.',
        },
        {
          kind: 'scan',
          name: 'scan_0042.tiff',
          note: 'A photographed page is a picture until something reads it. OCR turns it into text you can search and cite.',
        },
        {
          kind: 'email',
          name: 're_meridian_redlines.eml',
          note: 'The thread in order, attachments included, with the date the decision actually landed.',
        },
        {
          kind: 'chat',
          name: 'deal_desk_export.json',
          note: 'Messages in sequence, with who wrote them and when. The thread from March stops being folklore.',
        },
        {
          kind: 'image',
          name: 'whiteboard_2026-03-12.jpg',
          note: 'Screenshots, diagrams, photos of a board. The text inside them is read, and the image is indexed next to it.',
        },
        {
          kind: 'audio',
          name: 'meridian_call_14mar.m4a',
          note: 'An hour of call becomes a timestamped transcript. What was agreed at 00:41 stops being something two people half-remember.',
        },
      ],
      // 12 is the adapter count in `proof` — true by construction, not traction.
      // Keep the two in sync if the count ever changes.
      footnote: '12 ingest adapters implemented today, from .docx to .m4a to a scanned .tiff.',
    },

    organize: {
      chapter: '02',
      label: 'Organize',
      headline: ['Scattered goes in.', 'Connected comes out.'],
      body: 'Reading the files is the easy half. What makes it a brain is what happens next: the copies collapse, the formats disappear, and everything that talks about the same thing ends up next to it.',
      beats: [
        {
          title: 'Duplicates collapse',
          body: 'Four files called final become one document with a history. The version that was actually executed is the one that answers.',
        },
        {
          title: 'One connected index',
          body: 'The contract, the tracker row that summarizes it, and the call where it was argued stop being three systems. They become three neighbours.',
        },
        {
          title: 'Formats stop mattering',
          body: 'A sentence is a sentence whether it arrived as a slide, a scan, or a voice note. Retrieval works on meaning, not on file extension.',
        },
      ],
      permission: {
        label: 'The part that decides it',
        title: 'Permission-aware from the start',
        body: 'Access control comes in with the data and stays attached to it. Someone who could never open the file cannot retrieve a sentence out of it, and cannot see it cited in an answer.',
        emphasis:
          'Permissions are not a filter bolted on at the end. They are a property of the index. Nothing is ever flattened into one pile everybody can read.',
      },
    },

    ask: {
      chapter: '03',
      label: 'Ask',
      headline: ['A question in.', 'An answer you can check.'],
      body: 'Answers are built out of what your data says, not out of what a model remembers reading somewhere else. Every clause keeps a pointer to the span it was made from, and the pointer is in the answer itself — not in a footnote you are asked to trust.',
      demo: {
        label: 'Worked example',
        question: 'What did we commit to on data residency in the Meridian contract?',
        answerLabel: 'Answer',
        answer: [
          {
            text: 'All customer data stays in-region, with no cross-border transfer and no offshore replica.',
            cite: 1,
          },
          { text: 'Retention was negotiated down to 18 months from the original 36.', cite: 2 },
          {
            text: 'Legal drove that change after flagging the 36-month term as outside policy.',
            cite: 3,
          },
          {
            text: 'The customer accepted on the 14 March call, on the condition that deletion is evidenced every quarter.',
            cite: 4,
          },
        ],
        // Read as telemetry, not marketing. Every figure is a count of what the
        // system actually did for this query. Egress is an architectural constant.
        telemetry: ['retrieved: 4 spans', 'cited: 4 artifacts', 'egress: 0 bytes'],
        sourcesLabel: 'Sources',
        sourcesCount: '{n} artifacts',
        sources: [
          {
            id: 1,
            kind: 'pdf',
            name: 'meridian_msa_executed.pdf',
            detail: 'Schedule 2 · §4.1 · p.14',
          },
          {
            id: 2,
            kind: 'sheet',
            name: 'contract_terms_tracker.xlsx',
            detail: 'Row 87 · "Retention (mo)"',
          },
          { id: 3, kind: 'email', name: 're: Meridian redlines', detail: 'Legal · 12 Mar · 09:41' },
          {
            id: 4,
            kind: 'audio',
            name: 'meridian_call_14mar.m4a',
            detail: 'Transcript · 00:41:12',
          },
        ],
        backLabel: 'Back to the claim',
        sourceAria: 'Source {n}',
        // HONESTY: this caption is not decoration. It is what keeps the example
        // from reading as a customer story. Do not delete it.
        caption:
          'Illustrative. The artifacts are the customer’s own files, and the answer is assembled only from them. Each marker resolves to a location inside a specific artifact — a page, a row, a timestamp — and opens the original there.',
      },
      pipelineLabel: 'How that happened',
      pipeline: [
        {
          title: 'Read',
          body: 'The question is interpreted against your index, by a model running on your hardware. It never leaves the building to be understood.',
        },
        {
          title: 'Retrieve',
          body: 'Candidate spans are pulled from the artifacts this person is already cleared to see. Nothing else is a candidate.',
        },
        {
          title: 'Assemble',
          body: 'The answer is written out of those spans. Each clause carries the pointer to the span that produced it.',
        },
        {
          title: 'Cite',
          body: 'Pointers resolve to artifacts and to locations inside them. Open the original and read it yourself. That is the whole point.',
        },
        {
          title: 'Log',
          body: 'The question, the answer and every source consulted land in your audit trail, in your systems, on your retention schedule.',
        },
      ],
      construction:
        'Every answer carries a citation because there is no other way to build one. The answer is assembled from retrieved spans, so a sentence with no source has nothing to be made of.',
      empty: {
        title: 'When the answer is not there',
        body: 'CompanyMind says so, and shows you where it looked. In a regulated file a confident guess is worse than silence.',
      },
      footnote:
        'No source, no claim. If your data does not say it, CompanyMind does not say it either.',
    },

    close: {
      label: 'Next',
      headline: ['None of this', 'ever leaves.'],
      body: 'Every step on this page — the ingest, the index, the model, the answer, the audit log — runs on hardware you control. There is no vendor cloud in the path, because there is no vendor cloud. How that is built, and what it means for the obligations you already carry, is its own page.',
      primary: { label: 'See the architecture', href: ROUTES.security },
      secondary: { label: 'Become a design partner', href: ROUTES.contact },
    },
  },

  /* -------------------------------------------------------------------------
   * /security — audience: a CISO at a bank or a hospital.
   *
   * POSITIONING: ARCHITECTURE AS THE ARGUMENT. We hold no certifications, so we
   * do not gesture at any. Every property follows from WHERE THE SOFTWARE RUNS,
   * which means the reader can verify it on their own network. The `verify`
   * lines are the spine of the page — do not add a claim that cannot be checked
   * that way.
   * ----------------------------------------------------------------------- */
  security: {
    meta: {
      title: 'Security',
      description:
        'CompanyMind runs entirely inside your perimeter. No outbound path, no vendor access, no shared tenancy — and no certification claims we have not earned. The architecture is the argument.',
    },

    hero: {
      label: 'Security',
      headline: ['We built it so you', 'never have to trust us.'],
      sub: 'CompanyMind is software that runs inside your perimeter. There is no vendor cloud, no telemetry channel, no support tunnel. Every property on this page follows from where the software runs — which means you can test it on your own network before you believe a word of it.',
    },

    // Rendered as mono telemetry, deliberately NOT as badges — a badge-shaped
    // graphic on a pre-launch security page is a lie about a lie.
    rail: [
      { label: 'egress', value: '0 bytes' },
      { label: 'vendor access', value: 'none' },
      { label: 'tenancy', value: 'single — yours' },
    ],

    perimeter: {
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
    },

    dataflow: {
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
          dir: 'outbound',
          label: 'No outbound path',
          target: 'Model APIs · vendor cloud · telemetry',
          note: 'Not a setting that is switched off. There is no code that dials out.',
        },
        {
          dir: 'inbound',
          label: 'No inbound path',
          target: 'CompanyMind',
          note: 'No tunnel, no backdoor, no remote support session. We cannot reach your deployment.',
        },
      ],
      caption:
        'All ingest, indexing and answering happen inside your perimeter. The two paths that would cross it — outbound to a vendor, inbound from us — are absent from the build, not disabled in a config.',
    },

    directions: {
      label: 'The three directions',
      headline: ['Egress is zero', 'by construction.'],
      body: 'Zero is not a target we hit or a default we set. It is the only number the architecture can produce, because the thing that would make it larger was never built.',
      verifyLabel: 'Verify',
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
    },

    permissions: {
      label: 'Access control',
      headline: ['Your permissions,', 'not a new set of ours.'],
      body: 'The failure mode of every knowledge tool is the flattened index: everything vacuumed into one searchable pool, and now a question from the wrong desk returns the board deck. CompanyMind does not build that pool.',
      points: [
        'Every indexed span carries the access control of the artifact it came from.',
        'Retrieval filters on the asker’s identity before a single span reaches the model.',
        'Identity comes from your directory — your groups, your roles, your revocations, resolved at query time rather than copied at install.',
        'A person who could not open the file cannot get an answer built from it. It does not surface in the citations, because it was never retrieved.',
      ],
      close: 'Nothing is widened. Nothing is flattened.',
      closeNote:
        'A user’s view of the brain is exactly the view they already had of the underlying systems. Revoke someone in your directory on Friday and the brain has forgotten them by the next question.',
      // A schematic, not a screenshot. Illustrative file names only.
      trace: {
        label: 'Retrieval · filtered by asker',
        asker: 'asker: j.reyes · group: analysts',
        rows: [
          { ok: true, file: 'q3_pricing_memo.docx', state: 'retrieved' },
          { ok: true, file: 'risk_committee_notes.md', state: 'retrieved' },
          { ok: false, file: 'board_deck_2026.pptx', state: 'not cleared · never read' },
        ],
      },
    },

    audit: {
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
    },

    inheritance: {
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
      // FRAMEWORKS — the one place they are named, and every one of them is an
      // obligation the READER already carries. Not one is described as
      // something CompanyMind has been audited against.
      frameworks: {
        label: 'On your obligations',
        body: 'If your obligations run through HIPAA, GLBA, DORA, PCI DSS or a regulator’s own residency rules, they attach to the environment you already operate and already evidence. Running CompanyMind inside that environment keeps it within the boundary those obligations already cover, instead of opening a second boundary that needs its own answer, its own vendor questionnaire and its own exception. The obligation stays yours. The deployment model is built so that meeting it does not require you to make a special case for us.',
      },
    },

    notClaiming: {
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
      close:
        'A certification is a statement about a company. An architecture is a statement about a system.',
      closeNote:
        'We would rather hand you the second one and let you check it yourself — and when the audits do come, they will describe a system that already worked this way.',
    },

    cta: {
      label: 'Design partners',
      headline: ['Send us your', 'security questionnaire.'],
      body: 'We would rather answer the hard version early. If you are working out whether this could survive your review, bring the review — the topology, the threat model, the questions your auditors will ask in month nine. We are choosing a small number of design partners in regulated environments, and this is exactly the conversation we want to be in.',
      fineprint: 'A reply from an engineer, not a sales sequence.',
    },
  },

  /* -------------------------------------------------------------------------
   * /pricing
   *
   * Individual and Team carry printed numbers. Enterprise does not, and the
   * page says why in one sentence rather than hiding behind "contact sales".
   *
   * STILL FORBIDDEN HERE: certification claims, SLAs and uptime figures,
   * deployment durations, and social proof of any kind. The emphasized plan is
   * badged "Most companies" — a statement about SIZE, not about customers we
   * do not have.
   * ----------------------------------------------------------------------- */
  pricing: {
    meta: {
      title: 'Pricing',
      description:
        'Three ways to run CompanyMind: $15 a month for one person, $1,300 a month for a team of up to 100, and a quoted Enterprise install for air-gapped and on-premise estates.',
    },

    hero: {
      label: 'Pricing',
      headline: ['Three plans,', 'two of them priced here.'],
      sub: 'Individual and Team are the same software at two sizes, so both carry a number. Enterprise runs on your hardware inside your own walls — what that costs depends on the estate, so we quote it rather than print it.',
    },

    plans: [
      {
        id: '01',
        name: 'Individual',
        badge: null,
        who: 'For one person whose own work has outgrown search — a consultant, an analyst, a partner, a founder.',
        price: '$15',
        period: '/ month',
        priceNote: 'One person, one private workspace. Monthly, cancel whenever you like.',
        features: [
          'One private workspace nobody else can reach.',
          'Up to 2,000 documents and 20 GB of source material.',
          'Every ingest format: documents, spreadsheets, PDFs, email, chat, images and audio.',
          'Cited answers. Every claim opens the artifact it came from.',
          'Ask from Telegram as well as the browser.',
          'Email support.',
        ],
        cta: 'Start with one seat',
      },
      {
        id: '02',
        // The emphasized plan. Emphasis is carried by --brain and a solid ink
        // button, never by --sovereign (reserved for the perimeter pulse and
        // the home CTA).
        name: 'Team',
        badge: 'Up to 100 people',
        who: 'For a company ready to put the brain in front of everyone who needs to ask it something.',
        price: '$1,300',
        period: '/ month',
        priceNote:
          'Up to 100 people — $13 a head, less than a single seat costs on its own, and nobody counting them. Beyond 100, you are in Enterprise.',
        features: [
          'Everything in Individual, opened to the whole company.',
          'Access groups: each person is answered only from what they were already cleared to see.',
          'An owner console — add staff, assign groups, see what is over-exposed.',
          'One Telegram bot for the workspace, with approvals and per-person groups.',
          'Audit export: every question, answer and source, into your logging.',
          'Hosted by us, or installed in your own VPC at no different price.',
          'Up to 100,000 documents and 1 TB of source material.',
        ],
        cta: 'Scope a team deployment',
      },
      {
        id: '03',
        name: 'Enterprise',
        badge: null,
        who: 'For a bank, a hospital group, a law firm or a defense supplier — where on-prem is a regulator’s line rather than a preference.',
        price: 'Discussed',
        period: '',
        priceNote:
          'Quoted against the estate: how much you ingest, how many people ask, and whose hardware it runs on. Air-gapped installs are their own engagement.',
        features: [
          'Everything in Team, with no outbound path at all.',
          'Unlimited people, unlimited documents.',
          'Air-gapped install. Models, index and interface ship together and run offline.',
          'Your hardware, your racks, your physical control.',
          'SSO through your identity provider, with permissions resolved at query time.',
          'Custom models tuned on your domain, trained inside your boundary.',
          'Offline updates: a signed artifact you carry in and choose to install.',
          'Dedicated support — a direct line to the engineers who built it.',
        ],
        cta: 'Talk to us',
      },
    ],

    plansNote:
      'Prices are in US dollars, per month, billed monthly. Annual billing takes two months off. Local taxes are not included. Nothing here is a contract — the terms that bind arrive with a deployment agreement.',

    /**
     * The constants. True in every plan because they follow from the
     * architecture, not from the contract — which is the whole argument of the
     * product, restated where a competitor would put a comparison matrix.
     */
    everyTier: {
      label: 'In every plan',
      headline: ['True in every', 'plan, by construction.'],
      items: [
        {
          label: 'Deployment',
          value:
            'The same software at every size. What changes between plans is scale, never exposure.',
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
          value:
            'Questions, answers and sources logged in your systems, on your retention schedule.',
        },
      ],
    },

    faq: {
      label: 'Straight answers',
      headline: 'The questions a price list would dodge.',
      items: [
        {
          q: 'Why does Enterprise not have a number?',
          a: 'Because an on-premise install is not shrink-wrapped. What it costs depends on how much you ingest, how many people ask it questions, and whose hardware it runs on — and an air-gapped rack in a hospital is a different engagement from a VPC. Individual and Team are the same software at a known size, so they carry a printed price. Enterprise is quoted after one conversation, and the quote is true.',
        },
        {
          q: 'Is Team really just Individual times a hundred?',
          a: 'It is less than that. A hundred times would be $1,500; Team is $1,300, which is $13 a head — cheaper per person than a single seat. The software is not a multiple either: a hundred people need access groups, an owner who can assign them, and an audit trail, and those only exist above one person. What you are not paying for is a per-seat meter. Add somebody on a Tuesday and nothing changes on the invoice.',
        },
        {
          q: 'What does "on-prem" mean here, exactly?',
          a: 'That the software runs where your data already lives — your datacenter, your VPC, or a machine with no route to the internet. There is no vendor cloud behind it quietly doing the real work. We have no access to your deployment and no path to your data.',
        },
        {
          q: 'What does a deployment involve on our side?',
          a: 'Somewhere to run it, credentials to the sources you want ingested, and your identity provider for SSO. Your team performs the install and we do it with them, rather than throwing a tarball over the wall. Sizing depends on your corpus, so it belongs in the scoping conversation and not in a footnote here.',
        },
        {
          // The load-bearing honest answer. A regulated buyer asks this first,
          // and any hedge here costs the deal permanently. Say no, then say why
          // the architecture is the better answer than a badge would be.
          q: 'Are you SOC 2 or HIPAA certified?',
          a: 'No. CompanyMind holds no certifications, and we will not imply otherwise with a badge. What we offer is architectural: the software runs inside the boundary your obligations already cover, so your controls, your logging and your auditors reach it exactly the way they reach everything else in your estate. The certifications are yours. Our job is to not make them harder to keep.',
        },
        {
          q: 'Can we start small and grow?',
          a: 'Yes, and nothing is migrated on the way. Every plan runs the same software — a smaller one is not a demo build with the interesting parts removed. Growing means widening the scope: more people, more sources, and eventually your own hardware.',
        },
      ],
    },

    cta: {
      label: 'Design partners',
      headline: ['Every plan starts', 'with the same call.'],
      // Says the quiet part out loud: we are pre-launch. A regulated buyer will
      // find out in the first five minutes anyway, and finding out from us is
      // worth more than the impression of momentum we would trade it for.
      body: 'CompanyMind is pre-launch. We are building it with a small number of regulated teams who have this problem badly enough to help us solve it properly. Tell us what is scattered and where it is not allowed to go, and we will tell you what a deployment would look like.',
      submit: 'Start the conversation',
      href: ROUTES.contact,
      fineprint: 'One reply from a human. No sequence, no drip, no newsletter.',
    },
  },

  /* -------------------------------------------------------------------------
   * /about — an argument, not a company history.
   *
   * NO named people, bios, headshots, or initials-in-a-circle. `lab.roles`
   * describes the WORK. NO invented history. Names go in only when real.
   * ----------------------------------------------------------------------- */
  about: {
    meta: {
      title: 'About',
      description:
        'The best AI arrives as an API — and the institutions holding the most sensitive data in the economy can never call it. Why CompanyMind builds sovereign knowledge infrastructure, and an honest account of where we stand.',
    },

    hero: {
      eyebrow: 'About',
      // Short lines on purpose: display-lg is 2.5rem at 375px, so anything
      // longer than ~14 characters starts wrapping and the beat breaks.
      headline: ['The best AI', 'runs on', 'someone else’s', 'computer.'],
      sub: 'For a bank, a hospital, a defense supplier or a law firm, that is not a tradeoff to weigh. It is a non-starter. So the institutions holding the most consequential information in the economy are sitting out the most useful technology in a generation. That is the thing worth fixing.',
    },

    position: {
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
    },

    beliefs: {
      label: 'What we believe',
      headline: ['Three things we are', 'not flexible about.'],
      items: [
        {
          n: '01',
          title: 'An answer without a source is a rumor.',
          body: 'In a regulated business, an unattributed answer is not an answer — it is work. Somebody now has to go find out whether it is true. CompanyMind builds answers out of retrieved spans and cites every clause back to the artifact it came from, because an answer you cannot check is worth less than no answer at all.',
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
    },

    stage: {
      label: 'Stage',
      headline: ['Pre-launch.', 'We will say so plainly.'],
      body: 'CompanyMind is being built with a small number of regulated teams who have this problem badly enough to help us solve it properly. Everything else about our stage is on this page, in the plainest terms we can manage, because the alternative is asking you to discover it later.',
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
    },

    lab: {
      label: 'The lab',
      headline: ['A small lab,', 'on purpose.'],
      body: 'Sovereign software is an engineering problem long before it is a sales problem. It has to install into a building we have never entered, on hardware we do not control, with no route home and nobody from CompanyMind in the room. That work rewards a small team that can hold the whole system in its head. Below is how it divides.',
      note: 'Roles, not headshots. The names go up when there are real ones.',
      roles: [
        {
          n: '01',
          title: 'Founder / ML',
          focus: 'position · retrieval · grounding',
          nameSlot: 'name to follow',
          body: 'Owns the model layer: retrieval, grounding, and the post-training work that keeps an answer inside the source material it was built from. Decides what CompanyMind refuses to do. Also the person who replies to your first email.',
        },
        {
          n: '02',
          title: 'Systems',
          focus: 'deployment · inference · air gap',
          nameSlot: 'name to follow',
          body: 'Owns the install. Packages CompanyMind so it lands in a datacenter we have never seen, runs inference on the customer’s own GPUs, and takes upgrades across an air gap without a support engineer standing next to the rack.',
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
    },

    cta: {
      label: 'Design partners',
      headline: ['If your data cannot', 'leave, we should talk.'],
      body: 'We are choosing a small number of regulated teams to build this with. You get the system inside your walls and real influence over what it becomes. We get the only thing worth having before launch: the truth about whether it works.',
      fineprint: 'One reply from a human. No sequence, no drip.',
    },
  },

  /* -------------------------------------------------------------------------
   * /contact — DESIGN-PARTNER RECRUITMENT.
   *
   * Every promise below is one a small team's inbox can actually keep — one
   * human reply, no sequence, no newsletter. Do not add a turnaround time
   * unless someone is genuinely on the hook for it.
   * ----------------------------------------------------------------------- */
  contact: {
    meta: {
      title: 'Contact',
      description:
        'CompanyMind is choosing a small number of regulated teams to build with. If your knowledge is scattered and your data cannot leave your infrastructure, start the conversation.',
    },

    hero: {
      eyebrow: 'Design partners',
      headline: ['We are choosing', 'a few teams to', 'build this with.'],
      lede: 'CompanyMind is pre-launch. No customers yet, no certifications, no sales motion. What we have is an architecture we will defend and a product still soft enough to bend around the teams who help us build it.',
    },

    fit: {
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
      trade:
        'The trade is plain. You get the product shaped around your problem and direct access to the people building it. You also get an unfinished product, and every bug that comes with being first.',
    },

    next: {
      label: 'After you send',
      title: 'What happens next',
      steps: [
        { n: '01', line: 'A person reads it. Not a scoring model, not an SDR queue.' },
        {
          n: '02',
          line: 'You get one reply. If it is not a fit we say so, instead of going quiet.',
        },
        { n: '03', line: 'If it is, we propose a call and show you the system running.' },
      ],
      promise:
        'One reply from a human. No sequence, no drip, no newsletter. We do not sell your address, share it, or add you to a list.',
    },

    form: {
      title: 'Start the conversation',
      intro: 'Four fields. Only the first one is required.',
      fields: {
        email: {
          label: 'Work email',
          hint: 'Required. We only use it to reply.',
          placeholder: 'you@company.com',
        },
        company: { label: 'Company', hint: 'Optional.', placeholder: 'Where you work' },
        role: { label: 'Role', hint: 'Optional.', placeholder: 'What you do there' },
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
      failure: {
        title: 'That did not send.',
        body: 'The fault is ours, not yours. Mail us directly and it lands in exactly the same place:',
      },
      fallback: { lead: 'Rather just email?', address: brand.email, subject: 'Design partner' },
    },
  },

  /* -------------------------------------------------------------------------
   * /privacy, /terms
   *
   * ⚠️ NOT LEGALLY REVIEWED. READ BEFORE LAUNCH. ⚠️
   * Deliberate STUBS, written to be TRUE for a pre-launch marketing site whose
   * only interactive surface is a contact form. They deliberately do NOT name a
   * jurisdiction, the legal entity, warranties, liability caps, subprocessors,
   * or retention periods in days. Inventing any of those would be worse than
   * omitting them.
   *
   * ⚠️ THE CLAIMS BELOW ARE ONLY TRUE WHILE THE SITE STAYS THIS SMALL. ⚠️
   * "No tracking cookies. No analytics. No ad networks." is a statement of fact
   * about the current build. The day anyone adds an analytics snippet, a pixel,
   * a font CDN, or an embedded video, this section becomes a lie. Change it in
   * the same commit, or do not add the script.
   *
   * (The language preference cookie the switcher writes is not tracking and is
   * disclosed below — keep that disclosure in step with the code.)
   * ----------------------------------------------------------------------- */
  legal: {
    meta: {
      updatedISO: '2026-07-27',
      updatedLabel: '27 July 2026',
      updatedPrefix: 'Last updated',
    },

    privacy: {
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
            'Nothing else on this site asks you for anything. There is no account, no login, no profile.',
          ],
        },
        {
          heading: 'What this site does not do',
          body: [
            'This is a static marketing site. It is small on purpose, and the list of things it does not do is longer than the list of things it does.',
          ],
          list: [
            'No tracking cookies. The only cookie this site can write is the language you picked, so the site opens in it next time.',
            'No advertising networks, no pixels, no retargeting. We will not follow you around the internet.',
            'No behavioural analytics profile of you, and no session recording.',
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
    },

    terms: {
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
            'It is still a description of software in development. What it does, what it costs, and when it ships can all change before there is anything for either of us to sign. The prices on the pricing page are our current intent, stated plainly — not a locked quote.',
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
    },
  },

  /* -------------------------------------------------------------------------
   * 404 — the brand metaphor, played straight: an artifact that is not in the
   * index. The product's rule is "no source, no claim", so this page does not
   * guess. No exclamation marks, no cartoon, no apology.
   * ----------------------------------------------------------------------- */
  notFound: {
    label: '404 · no source found',
    title: 'Not in the index',
    description: 'That page is not part of this site.',
    headline: ['Not in', 'the index.'],
    body: 'The page you asked for is not part of this site. It may have moved, it may never have existed, and we are not going to guess which.',
    footnote:
      'No source, no claim. That rule runs the product, so it runs this page too. Everything else is one link away.',
    artifact: { caption: 'requested artifact', status: 'not indexed · 0 sources' },
    home: 'Back to the homepage',
    linksLabel: 'Or go straight to',
    sectionsAria: 'Sections',
  },
}
