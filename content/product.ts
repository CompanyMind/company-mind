/**
 * ============================================================================
 * COPY FOR /product — the "how it works" page.
 * ============================================================================
 * Same contract as content/site.ts: components import from here and never
 * inline their own strings. Read the honesty rules at the top of site.ts first.
 * They apply to every word below and they are load-bearing, not stylistic.
 *
 * Three rules worth restating here, because this page is the one most tempted
 * to break them:
 *
 *   1. CAPABILITY, NOT CERTIFICATION. This page describes what the system does
 *      and how it is built. It never claims an audit, a framework, or a badge.
 *   2. NO INVENTED CUSTOMERS. The filenames below (meridian_msa_executed.pdf,
 *      contract_terms_tracker.xlsx, ...) are ILLUSTRATIVE UI EXAMPLES of files
 *      a customer would have in their OWN deployment. They are not a case
 *      study, not a real account, and must never be presented as one. The
 *      `caption` under the demo says so on the page itself — do not remove it.
 *   3. VERIFIABLE, NOT ABSOLUTE. "every clause carries a citation" is true by
 *      construction (answers are assembled from retrieved spans). "always
 *      right" is not. Do not upgrade the former into the latter.
 */

/** The eight artifact kinds the swarm and the glyphs both know about. */
export type ArtifactKind = 'doc' | 'sheet' | 'pdf' | 'scan' | 'email' | 'chat' | 'image' | 'audio'

type IngestSource = { kind: ArtifactKind; name: string; note: string }
type Beat = { title: string; body: string }
type PipelineStep = { title: string; body: string }
type AnswerClause = { text: string; cite: number }
type DemoSource = { id: number; kind: ArtifactKind; name: string; detail: string }

export const productMeta = {
  title: 'Product',
  description:
    'How CompBrain works: every source your company owns, ingested and organized into one index you can ask — with every clause cited to the artifact it came from.',
} as const

/* ---------------------------------------------------------------------------
 * HERO — three beats that also happen to be the three chapters of the page.
 * ------------------------------------------------------------------------- */

export const productHero = {
  eyebrow: 'How it works',
  headline: ['Everything in.', 'One answer out.', 'Nothing uncited.'],
  sub: 'CompBrain reads every source your company already owns, organizes it into one connected index, and answers out of it. Each clause in the answer keeps a pointer back to the artifact it came from. All of it runs on your hardware.',
  pipeline: ['ingest', 'organize', 'ask', 'cite'],
} as const

/* ---------------------------------------------------------------------------
 * CHAPTER 01 — INGEST. Breadth has to feel concrete, so every claim here is
 * pinned to a file extension and a specific thing that happens to it.
 * ------------------------------------------------------------------------- */

export const ingest = {
  chapter: '01',
  label: 'Ingest',
  headline: ['Everything you own.', 'Not just the tidy parts.'],
  body: 'Point CompBrain at a share, a mailbox, a chat export, a folder of scans. It reads what it finds. A contract, a forgotten spreadsheet tab, a photographed whiteboard and an hour-long call all arrive as the same thing: text the brain can reason over, with a path back to the original.',
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
  ] satisfies readonly IngestSource[],
  // 12 is the adapter count from content/site.ts `proof` — true by construction,
  // not a traction number. Keep the two in sync if the count ever changes.
  footnote: '12 ingest adapters implemented today, from .docx to .m4a to a scanned .tiff.',
} as const

/* ---------------------------------------------------------------------------
 * CHAPTER 02 — ORGANIZE. The half that turns a pile into a brain.
 * ------------------------------------------------------------------------- */

export const organize = {
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
  ] satisfies readonly Beat[],
  /**
   * Pulled out of the grid deliberately. For a regulated buyer this is the
   * first question and the last objection — it deserves its own weight.
   */
  permission: {
    label: 'The part that decides it',
    title: 'Permission-aware from the start',
    body: 'Access control comes in with the data and stays attached to it. Someone who could never open the file cannot retrieve a sentence out of it, and cannot see it cited in an answer.',
    emphasis:
      'Permissions are not a filter bolted on at the end. They are a property of the index. Nothing is ever flattened into one pile everybody can read.',
  },
} as const

/* ---------------------------------------------------------------------------
 * CHAPTER 03 — ASK. The centrepiece: a question, an answer, and four markers
 * that resolve to four real locations inside four artifacts.
 * ------------------------------------------------------------------------- */

export const askDeep = {
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
    ] satisfies readonly AnswerClause[],
    // Read as telemetry, not marketing. Every figure here is a count of what the
    // system actually did for this query. egress is an architectural constant.
    telemetry: ['retrieved: 4 spans', 'cited: 4 artifacts', 'egress: 0 bytes'],
    sourcesLabel: 'Sources',
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
      { id: 4, kind: 'audio', name: 'meridian_call_14mar.m4a', detail: 'Transcript · 00:41:12' },
    ] satisfies readonly DemoSource[],
    backLabel: 'Back to the claim',
    // HONESTY: this caption is not decoration. It is what keeps the example from
    // reading as a customer story. Do not delete it.
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
  ] satisfies readonly PipelineStep[],
  construction:
    'Every answer carries a citation because there is no other way to build one. The answer is assembled from retrieved spans, so a sentence with no source has nothing to be made of.',
  empty: {
    title: 'When the answer is not there',
    body: 'CompBrain says so, and shows you where it looked. In a regulated file a confident guess is worse than silence.',
  },
  footnote: 'No source, no claim. If your data does not say it, CompBrain does not say it either.',
} as const

/* ---------------------------------------------------------------------------
 * CLOSE — hand off to /security, then ask for the conversation.
 * ------------------------------------------------------------------------- */

export const productClose = {
  label: 'Next',
  headline: ['None of this', 'ever leaves.'],
  body: 'Every step on this page — the ingest, the index, the model, the answer, the audit log — runs on hardware you control. There is no vendor cloud in the path, because there is no vendor cloud. How that is built, and what it means for the obligations you already carry, is its own page.',
  primary: { label: 'See the architecture', href: '/security' },
  secondary: { label: 'Become a design partner', href: '/contact' },
} as const
