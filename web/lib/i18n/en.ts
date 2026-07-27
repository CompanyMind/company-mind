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
      dropzone: 'Drop files here',
      browse: 'Choose files',
      uploading: 'Uploading…',
      status: '{received} files received · {indexed} indexed',
      skipThis: 'Skip this',
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
      dismiss: 'Got it',
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
  // Real empty-state copy — prose plus one action, never a numbered
  // tutorial (the rejected first-run panel this task deletes). See
  // docs/superpowers/specs/2026-07-26-guided-tour-design.md §4/§5.
  emptyStates: {
    askNoDocuments: {
      body: 'Upload your first documents and CompanyMind will answer questions about them, every claim traced back to its source.',
      cta: 'Add documents',
      // Members cannot upload, and for them an empty Ask pane means "nothing in
      // your access groups yet", not "the workspace is empty".
      memberBody:
        'No documents have been shared with your access groups yet. Once an owner shares some, you can ask questions here and every answer will cite its source.',
    },
    sourcesEmpty: {
      body: 'No documents yet. Upload PDFs, Word, text or markdown and CompanyMind will sort them into folders for you.',
      cta: 'Upload documents',
      // Shown to members instead of `body`. A member cannot upload, so the
      // owner copy would be an instruction they are unable to follow — and it
      // would also imply the workspace is empty when it may be full of
      // documents outside their access groups.
      memberBody:
        'Nothing here you can open yet. Your answers are built from the access groups you belong to — ask an owner to add you to a group, or to share documents with one you are already in.',
    },
    // Permanent page prose, not a dismissible hint — the spec requires this
    // to exist outside the tour card, since it must still be re-readable in
    // month six by someone who never took the tour at all.
    access: {
      body: 'Your answers are built only from the intersection of the access groups you belong to — a document outside all of them never appears, even if you ask about it directly. Workspace owners bypass this and see everything.',
    },
    // Atlas is deliberately not a tour step — it paints to a single
    // <canvas>, so no selector can ever resolve a graph node — which makes
    // this the only place it gets explained at all.
    atlas: {
      body: 'Atlas maps what your company knows: documents clustered by topic, coloured by department, with lenses for permission anomalies, over-exposure, orphans and stale content. It needs documents to show anything — upload some in Sources, then rebuild the map.',
    },
  },
  chat: {
    greeting: {
      morning: 'Good morning, {name}',
      afternoon: 'Good afternoon, {name}',
      evening: 'Good evening, {name}',
      // Rendered until the client's own clock has resolved which of the three
      // applies — the server's timezone is not the reader's, and greeting
      // someone "Good morning" at 9pm is a small, avoidable lie.
      anonymous: 'What would you like to know?',
    },
    // The three real stages of the ask pipeline, in order. None of them states
    // a count: the request is one-shot, so the client does not know how many
    // documents were read until the answer lands, and inventing a number in a
    // product whose whole claim is traceability would be indefensible.
    thinking: {
      searching: 'Searching your sources…',
      reading: 'Reading the matches…',
      writing: 'Writing the answer…',
    },
    footer: 'Every answer cites its source. Nothing leaves this server.',
    placeholder: 'Ask your company’s knowledge…',
    copy: 'Copy',
    copied: 'Copied',
    sources: 'Sources',
    retry: 'Retry',
    send: 'Send',
    attach: 'Add documents',
  },
  settings: {
    title: 'Settings',
    close: 'Close settings',
    saveFailed: 'Could not save that. Nothing was changed.',
    sections: {
      general: 'General',
      account: 'Account',
      workspace: 'Workspace',
      data: 'Data',
    },
    general: {
      profile: 'Profile',
      name: 'Name',
      email: 'Email',
      emailNote: 'Your email is your sign-in and cannot be changed here.',
      preferences: 'Preferences',
      language: 'Language',
      languageNote: 'Changes the product’s own wording. Your documents are untouched.',
      appearance: 'Appearance',
      motion: 'Motion',
      motionNote: 'Reduce animation across the interface.',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
      reduced: 'Reduced',
      help: 'Help',
      replayTour: 'Replay the guided tour',
      replayTourNote: 'Walk through the product from the beginning.',
      replayTourCta: 'Start',
    },
    account: {
      heading: 'Account',
      password: 'Password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      passwordHint: 'At least 12 characters. Length beats punctuation.',
      changePassword: 'Change password',
      passwordChanged: 'Password changed. Your other sessions were signed out.',
      sessions: 'Active sessions',
      sessionsNote: 'Where you are signed in. Locations are not looked up — that would mean calling out.',
      device: 'Device',
      ip: 'IP',
      signedIn: 'Signed in',
      thisDevice: 'This device',
      signOutAll: 'Sign out of all devices',
      signOutAllNote: 'Ends every session, including this one.',
      signOut: 'Sign out',
    },
    workspace: {
      heading: 'Workspace',
      name: 'Name',
      deployment: 'Deployment',
      onprem: 'On-premise — nothing leaves your infrastructure.',
      hosted: 'Hosted — nothing leaves this server, and nothing is used for training.',
      manage: 'Manage',
      people: 'People',
      peopleNote: 'Add colleagues and choose what they can open.',
      access: 'Access groups',
      accessNote: 'Groups decide which documents build whose answers.',
      integrations: 'Telegram',
      integrationsNote: 'One bot for your workspace, ask-only.',
      open: 'Open',
    },
    data: {
      heading: 'Your data',
      stored: 'What is stored',
      storedBody:
        'Your documents and the passages indexed from them, your questions and answers with the sources each one cited, and your sign-in sessions. All of it lives in this deployment’s own database and is never sent anywhere else.',
      conversations: 'Conversations',
      deleteChats: 'Delete all my conversations',
      deleteChatsNote: 'Removes every question and answer in your history. Your documents stay.',
      deleteChatsConfirm:
        'Delete all {count} of your conversations?\n\nThis cannot be undone. Your documents are not affected.',
      deleteChatsNone: 'You have no conversations to delete.',
      delete: 'Delete',
    },
  },
}

// Inferred, not hand-written, so ru.ts and uz.ts are checked against this
// shape at compile time as well as by the runtime key-set test.
export type Dictionary = typeof en
