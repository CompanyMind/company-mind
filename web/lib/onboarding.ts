export type OnboardingFacts = {
  indexedCount: number
  foldered: boolean
  hasAsked: boolean
  dismissed: boolean
}

export type OnboardingStep = { key: 'add' | 'organise' | 'ask'; done: boolean }

export type OnboardingState = {
  steps: OnboardingStep[]
  complete: boolean
  show: boolean
  workspaceEmpty: boolean
}

/**
 * Progress is DERIVED from real facts on every render — there is no stored
 * "current step". That means the panel resumes correctly, cannot desync, and
 * honestly reverts if the user deletes their documents.
 *
 * Dismissal only hides the strip. It never marks incomplete work as complete.
 */
export function deriveOnboarding(facts: OnboardingFacts): OnboardingState {
  const steps: OnboardingStep[] = [
    { key: 'add', done: facts.indexedCount > 0 },
    { key: 'organise', done: facts.foldered },
    { key: 'ask', done: facts.hasAsked },
  ]
  const complete = steps.every((s) => s.done)
  return {
    steps,
    complete,
    show: !complete && !facts.dismissed,
    workspaceEmpty: facts.indexedCount === 0,
  }
}
