// English is the source dictionary: every other locale's key set is checked
// against this one (see i18n.test.ts). Keep this file's shape canonical.

export const en = {
  tour: {
    welcome: {
      heading: "This is your company's memory.",
      body: 'Upload documents, ask a question in plain language, and get an answer with the exact source cited. Everything runs on your own infrastructure — nothing leaves this server.',
    },
    upload: {
      heading: 'Bring in your first documents',
      body: "Drop files here or pick them from your computer. Indexing keeps running in the background, so you can move on whenever you're ready.",
    },
    organise: {
      heading: 'Let AI organise what you uploaded',
      body: "Documents are grouped into folders automatically. Review the result and adjust anything that doesn't look right.",
    },
    access: {
      heading: 'People only get answers from what they may read.',
      body: "Every document belongs to one or more access groups. A person's answers are built only from the groups they're in — workspace owners see everything.",
    },
    accessMember: {
      heading: "You'll only ever see answers built from documents your groups can open.",
      body: "If a document isn't in one of your groups, it won't show up in your answers — even if you ask about it directly.",
    },
    ask: {
      heading: 'Ask anything about your documents',
      body: 'Type a question below. Every answer comes with citations back to the exact source, so you can always check where it came from.',
    },
    citationHint: {
      heading: 'Every citation opens the source',
      body: 'Click a citation to jump straight to the passage it came from.',
    },
    ui: {
      next: 'Next',
      back: 'Back',
      skip: 'Skip',
      done: 'Done',
      stepOf: 'Step {current} of {total}',
      takeTour: 'Take the tour',
      guide: 'Guide',
      // Step 1's bespoke pair — spec §4.1: `[Show me around] [Not now]`.
      startTour: 'Show me around',
      declineTour: 'Not now',
    },
  },
}

// Inferred, not hand-written, so ru.ts and uz.ts are checked against this
// shape at compile time as well as by the runtime key-set test.
export type Dictionary = typeof en
