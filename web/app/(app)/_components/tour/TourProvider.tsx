'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ACTIONS, EVENTS, Joyride, ORIGIN } from 'react-joyride'
import type { EventData, Step as JoyrideStepConfig, TooltipRenderProps } from 'react-joyride'
import { getDictionary, isLocale, type Dictionary } from '@/lib/i18n'
import { TourTargetProvider, useTourTargetEl, type TourTarget } from '@/lib/tour/targets'
import { buildSteps } from '@/lib/tour/steps'
import { nextStepKey, shouldAutoStart } from '@/lib/tour/state'
import { TourCard } from './TourCard'
import { TourPill } from './TourPill'

export type TourRole = 'owner' | 'member'

type StartOptions = {
  /**
   * Force step 0 regardless of what's already in `user_tour_steps` — the
   * rail's permanent Guide item (spec §5) uses this for a full replay.
   * Omitted (or false): resume at the first step whose key isn't seen yet
   * (web/lib/tour/state.ts::nextStepKey) — what auto-start and the pill both
   * use, spec §6's "offered exactly that step behind a pill, not the whole
   * tour again."
   */
  fromBeginning?: boolean
}

type TourContextValue = {
  /** Starts the tour. See `StartOptions`. */
  start: (opts?: StartOptions) => void
  /** Whether a tour is currently running. */
  active: boolean
  /**
   * Whether `key` is already in `user_tour_steps` for this user+workspace —
   * seeded from the server (`seenSteps`) and kept current in-memory for the
   * rest of the session. Exposed for `CitationHint.tsx` (spec §4
   * "Deliberately not tour steps"): the citation coach mark reuses this
   * same seen-set and the same honest "seen" semantic as every joyride
   * step, even though it is never one of `stepDefs` and never runs through
   * joyride at all — a citation button doesn't exist in the DOM until an
   * answer with one actually renders, so it can never be a fixed step.
   */
  hasSeenStep: (key: string) => boolean
  /**
   * Records `key` as seen — the same `POST /api/tour/step` call and
   * `ON CONFLICT DO NOTHING` idempotency every joyride step already relies
   * on (see the "record seen" effect below, which now calls this too), just
   * reachable from outside the joyride lifecycle for `CitationHint.tsx`.
   */
  recordStepSeen: (key: string) => void
}

// Harmless no-op default, same pattern as targets.ts's noopRegistry: any
// dashboard surface can call useTour() unconditionally without caring
// whether it happens to render above or below TourProvider.
const noopTour: TourContextValue = {
  start: () => {},
  active: false,
  hasSeenStep: () => false,
  recordStepSeen: () => {},
}
const TourContext = createContext<TourContextValue>(noopTour)

export function useTour(): TourContextValue {
  return useContext(TourContext)
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(callback: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getReducedMotionServerSnapshot(): boolean {
  return false
}

// useSyncExternalStore, not useState+useEffect: this reads a genuinely
// external, mutable source (the browser's media-query state), which is
// exactly what useSyncExternalStore exists for — the setState-in-effect
// pattern it replaces trips eslint-plugin-react-hooks' newer
// set-state-in-effect rule for the same reason it's discouraged upstream.
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  )
}

// A factory, not a component defined inside TourEngine's body: it hands back
// a fresh top-level component bound to this render's dictionary, which is
// what lets TourCard.tsx itself stay a plain, directly-typed component with
// no context coupling of its own.
function createTooltipComponent(ui: Dictionary['tour']['ui']) {
  function TourTooltip(props: TooltipRenderProps) {
    return <TourCard {...props} ui={ui} />
  }
  return TourTooltip
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ORGANISE_TARGET_POLL_INTERVAL_MS = 100
// Safely under joyride's own `beforeTimeout` (5000ms default, left
// unchanged below). `waitForOrganiseTarget` always settles the `before`
// promise on its own terms first, so a genuinely absent target ends in a
// clean, expected TARGET_NOT_FOUND (handled in handleEvent below) rather
// than joyride's own before-hook timeout — which ALSO emits an
// EVENTS.ERROR, a type this provider otherwise treats as tour-ending.
const ORGANISE_TARGET_POLL_BUDGET_MS = 4000

function TourEngine({
  dictionary,
  role,
  csrf,
  seenSteps,
  tourDismissed,
  children,
}: {
  dictionary: Dictionary
  role: TourRole
  csrf: string
  /** Step keys already in `user_tour_steps` for this user+workspace, from the server. */
  seenSteps: readonly string[]
  /** `users.tour_dismissed_at !== null`, from the server. */
  tourDismissed: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const reducedMotion = usePrefersReducedMotion()

  // Whether the workspace has unfiled documents right now — the fact
  // `buildSteps` (lib/tour/steps.ts) needs to decide if organise-v1 (spec
  // §4 step 3) belongs in this run's step list at all. Fetched from the
  // same `/api/folders` endpoint Sources.tsx already polls, but only when
  // the tour actually starts (see `start` below) — nothing reads
  // `hasUnfiled` before then, since joyride only shows anything once
  // `run` is true, so there is no separate mount-time fetch to keep in
  // sync (and no `useEffect` calling it, which would trip
  // `react-hooks/set-state-in-effect` the same way several other
  // mount-and-poll effects in this codebase already do). Left alone for
  // the rest of that run once set: recomputing it mid-tour would race the
  // step array's own length against an in-flight `setStepIndex`, and the
  // step list would no longer agree with joyride's own `size`. Defaults to
  // `false` (organise-v1 absent) until the first fetch settles — the safe
  // direction, since a step that's wrongly missing is a no-op, but a step
  // that's wrongly present points at a target that was never confirmed to
  // exist.
  const [hasUnfiled, setHasUnfiled] = useState(false)
  const refreshHasUnfiled = useCallback(async () => {
    if (role !== 'owner') return
    try {
      const r = await fetch('/api/folders')
      if (!r.ok) return
      const d = (await r.json()) as { unfiledCount: number }
      setHasUnfiled(d.unfiledCount > 0)
    } catch {
      // Best-effort: a failed check just means organise-v1 sits out this
      // run, never a stuck fetch or a step pointed at an unconfirmed target.
    }
  }, [role])

  const stepDefs = useMemo(
    () => buildSteps({ role, dict: dictionary, hasUnfiled, csrf }),
    [role, dictionary, hasUnfiled, csrf],
  )

  // Mutable, seeded once from the server-rendered `seenSteps` prop and
  // appended to as steps are shown this session (see the "record seen"
  // effect below) — never re-derived from the prop again after mount. This
  // is what lets `nextIndex` below stay accurate for a second pill click or
  // Guide replay within the same page load, without a stale snapshot from
  // the initial server render or a round trip back to the database just to
  // ask "what have I already seen". A `Set`, not the array itself: every
  // read here is membership, never order.
  const seenKeysRef = useRef<Set<string>>(new Set(seenSteps))

  // The first currently-defined step key not yet in `seenKeysRef` — spec
  // §6's set difference, `nextStepKey` (web/lib/tour/state.ts). `null` means
  // every step this role's tour currently defines has already been shown, in
  // which case there is nothing left to offer via auto-start or the pill
  // (the rail's Guide item still gives a full replay regardless — see
  // `start`'s `fromBeginning`).
  const nextIndex = useCallback((): number | null => {
    const key = nextStepKey(
      stepDefs.map((d) => d.key),
      Array.from(seenKeysRef.current),
    )
    if (key === null) return null
    const idx = stepDefs.findIndex((d) => d.key === key)
    return idx === -1 ? null : idx
  }, [stepDefs])

  // Local mirror of `tourDismissed`, flipped the instant the pill's own
  // dismiss button is clicked (see `dismissTour` below) so the pill
  // disappears immediately rather than waiting on a round trip.
  const [dismissed, setDismissed] = useState(tourDismissed)
  const [pillVisible, setPillVisible] = useState(false)

  // Every possible tour target, resolved live. A `Record<TourTarget, ...>`
  // literal rather than a lookup by string keeps this exhaustive: a new
  // TourTarget member that isn't listed here is a tsc error, not a step
  // that silently never finds its anchor.
  const targetElements: Record<TourTarget, HTMLElement | null> = {
    'ask-pane': useTourTargetEl('ask-pane'),
    'ask-composer': useTourTargetEl('ask-composer'),
    'rail-sources': useTourTargetEl('rail-sources'),
    'rail-access': useTourTargetEl('rail-access'),
    'organise-button': useTourTargetEl('organise-button'),
  }
  // Read through a ref inside the step `target` functions below rather than
  // closing over `targetElements` directly: that object is a fresh literal
  // every render, so a closure over it would give every step a new `target`
  // function identity on every render. Joyride's controlled-mode prop sync
  // deep-equals `steps` to decide whether to re-register them, and a
  // function is never structurally equal to a different function instance —
  // that would re-register steps on every single render. The ref keeps
  // `steps`, and the target functions inside it, referentially stable while
  // still resolving the live element whenever joyride actually calls them.
  const targetElementsRef = useRef(targetElements)
  // Kept current in an effect, not by assigning `.current` during render —
  // eslint-plugin-react-hooks' newer `refs` rule flags the latter as unsafe
  // under the React Compiler (the same fix Task 3 needed in targets.ts).
  // No dependency array: this must re-run after every render so the ref
  // never lags behind, exactly the "always the latest value" contract
  // `resolveTarget`'s closures below depend on — and what
  // `waitForOrganiseTarget` below polls through to notice the Organise
  // button mounting after navigation.
  useEffect(() => {
    targetElementsRef.current = targetElements
  })

  const resolveTarget = useCallback(
    (name: TourTarget) => () => targetElementsRef.current[name],
    [],
  )

  // organise-v1's `before` hook (below) polls this after navigating,
  // rather than relying on joyride's own `targetWaitTimeout`. Verified
  // against react-joyride 3.2.0's own shipped source (its docs site 404s —
  // node_modules/react-joyride/src/hooks/useLifecycleEffect.ts): the
  // target-wait poll only runs for steps WITHOUT a `before` hook. A step
  // that HAS one gets exactly one target-existence check, the instant its
  // promise resolves, with no further polling of its own — so a step that
  // both navigates AND needs to wait for its target to mount has to do
  // that waiting itself. The Organise button takes an RSC navigation plus
  // Sources.tsx's own `/api/folders` fetch before it can even conditionally
  // render, so this has real work to do, not just a formality.
  const waitForOrganiseTarget = useCallback(async () => {
    const start = Date.now()
    while (!targetElementsRef.current['organise-button']) {
      if (Date.now() - start >= ORGANISE_TARGET_POLL_BUDGET_MS) return
      await sleep(ORGANISE_TARGET_POLL_INTERVAL_MS)
    }
  }, [])

  // The tour's one forward navigation (spec §4 step 3, §5 "navigate at
  // most twice"). Always resolves, even if the target never mounts within
  // budget — the resulting TARGET_NOT_FOUND is handled by skipping the
  // step in handleEvent below, not by stalling or erroring the tour.
  const beforeOrganise = useCallback(async () => {
    router.push('/dashboard/sources')
    await waitForOrganiseTarget()
  }, [router, waitForOrganiseTarget])

  // The tour's one return navigation — attached to access-v1 below only
  // when organise-v1 actually ran this tour, so a workspace with nothing
  // unfiled never navigates at all. No poll needed: rail-access is durable
  // chrome mounted once in (app)/layout.tsx and never unmounted by a
  // dashboard route change, so it's already present the instant this
  // resolves.
  const beforeReturnToDashboard = useCallback(async () => {
    router.push('/dashboard')
  }, [router])

  const steps: JoyrideStepConfig[] = useMemo(() => {
    const hasOrganise = stepDefs.some((def) => def.key === 'organise-v1')
    return stepDefs.map((def) => ({
      id: def.key,
      target: resolveTarget(def.target),
      title: def.heading,
      content: def.content,
      ...(def.placement ? { placement: def.placement } : {}),
      ...(def.key === 'organise-v1' ? { before: beforeOrganise } : {}),
      ...(def.key === 'access-v1' && hasOrganise ? { before: beforeReturnToDashboard } : {}),
    }))
  }, [stepDefs, resolveTarget, beforeOrganise, beforeReturnToDashboard])

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Whatever had focus the instant the tour was asked to start — the Guide
  // rail button on a manual replay, the pill's own button on a resume, or
  // nothing meaningful (document.body) on auto-start, where nothing has
  // been interacted with yet. Restored in `endTour` below so keyboard focus
  // never falls through to <body> when the card unmounts (confirmed live:
  // without this, Escape/Done/TARGET_NOT_FOUND all left `document.body`
  // focused, and the next Tab press restarted from the top of the page).
  const preTourFocusRef = useRef<HTMLElement | null>(null)

  const start = useCallback(
    (opts?: StartOptions) => {
      preTourFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      void refreshHasUnfiled()
      // Resume at the first unseen step unless a full replay was asked for
      // (spec §5/§6) — auto-start's own facts always resolve this to 0 (it
      // only ever fires when seenCount is 0), so this changes nothing for
      // that path; it matters for the pill, which can fire with real
      // progress already on record.
      setStepIndex(opts?.fromBeginning ? 0 : (nextIndex() ?? 0))
      setRun(true)
      setPillVisible(false)
    },
    [refreshHasUnfiled, nextIndex],
  )

  const endTour = useCallback(() => {
    setRun(false)
    setStepIndex(0)
    // Best-effort: the pill's own button is gone by the time the tour ends
    // (start() hides it immediately), so this only ever finds something to
    // restore when the tour was launched from a durable element — chiefly
    // the rail's Guide button. That is still the common manual-replay path
    // and a real improvement over the unconditional body-fallback; the
    // auto-start and pill-launched paths are a documented, accepted gap
    // (see the accessibility note) rather than a risk worth chasing further
    // plumbing for in the last task of this feature.
    const toFocus = preTourFocusRef.current
    if (toFocus && toFocus.isConnected) {
      toFocus.focus()
    }
    preTourFocusRef.current = null
  }, [])

  // Shared by STEP_AFTER/NEXT and TARGET_NOT_FOUND below: move to the next
  // index, or end the tour if that was the last step.
  const advanceOrEnd = useCallback(
    (index: number, size: number) => {
      const next = index + 1
      if (next >= size) {
        endTour()
      } else {
        setStepIndex(next)
      }
    },
    [endTour],
  )

  // The ONLY place stepIndex is ever set outside of start()/endTour() above,
  // and it is driven exclusively by joyride's own onEvent callback — never
  // by a useEffect watching app state. Joyride's docs say "Don't" about the
  // latter: external stepIndex updates that don't originate from its own
  // callback desynchronise its lifecycle and break the keyboard handlers.
  const handleEvent = useCallback(
    (data: EventData) => {
      // Escape must end the tour from every step, unconditionally (WCAG
      // 2.1.2, Level A). Joyride's own `dismissKeyAction: 'close'` only
      // closes the current step — on a non-final step that silently
      // advances to the next one instead of exiting. Checking `origin`
      // first, ahead of `type`/`action`, makes a keyboard dismissal always
      // win regardless of what action it resolved to. This also covers
      // Escape from organise-v1 itself: the user simply stays on
      // /dashboard/sources — nothing here navigates them anywhere as a
      // parting act.
      if (data.origin === ORIGIN.KEYBOARD) {
        endTour()
        return
      }

      if (data.type === EVENTS.STEP_AFTER) {
        if (data.action === ACTIONS.NEXT) {
          advanceOrEnd(data.index, data.size)
          return
        }
        if (data.action === ACTIONS.PREV) {
          setStepIndex(Math.max(0, data.index - 1))
          return
        }
        // CLOSE (or anything else close-shaped) ends the tour rather than
        // silently advancing. TourCard renders no close/X button today, but
        // a future step config that adds one must not get stuck instead of
        // exiting cleanly.
        endTour()
        return
      }

      // A step's target failed to resolve — organise-v1's real risk: the
      // Organise button never mounted after navigating to Sources (an
      // unusually slow load, or the workspace's unfiled count changed out
      // from under this run). Skip past it rather than stalling: joyride's
      // own auto-advance-on-target-not-found only fires in UNCONTROLLED
      // mode (verified in useLifecycleEffect.ts) — this tour is controlled
      // (`stepIndex` is a prop), so without this branch a missing target
      // would leave no card, no ring, and no way forward except Escape.
      if (data.type === EVENTS.TARGET_NOT_FOUND) {
        advanceOrEnd(data.index, data.size)
        return
      }

      if (data.type === EVENTS.TOUR_END || data.type === EVENTS.ERROR) {
        endTour()
      }
    },
    [endTour, advanceOrEnd],
  )

  // The ring: `data-tour-active` on the current step's target element,
  // styled in globals.css. Set only on the active step's element, removed
  // on every step change and when the tour ends via this effect's own
  // cleanup — a stray permanent ring on a stale element is the bug this
  // guards against.
  const currentStepDef = run ? stepDefs[stepIndex] : undefined
  const currentTarget = currentStepDef ? targetElements[currentStepDef.target] : null
  useEffect(() => {
    if (!currentTarget) return
    currentTarget.setAttribute('data-tour-active', '')
    return () => {
      currentTarget.removeAttribute('data-tour-active')
    }
  }, [currentTarget])

  // The shared "record seen" primitive — spec §6's honest "seen" semantic
  // (shown, not completed), reused by both the joyride step-record effect
  // below and `CitationHint.tsx` via context. Updates `seenKeysRef`
  // synchronously (not waiting on the response) so `nextIndex`/`hasSeenStep`
  // are correct for a pill click, Guide replay, or a second cited answer
  // later in the same session, and skips the network call entirely for a
  // key already recorded — the same idempotency `ON CONFLICT DO NOTHING`
  // gives the write itself, just without the round trip. Fire-and-forget: a
  // failed POST must never block or error the caller, only cost that one row
  // until the next successful call.
  const recordStepSeen = useCallback(
    (key: string) => {
      if (seenKeysRef.current.has(key)) return
      seenKeysRef.current.add(key)
      void fetch('/api/tour/step', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ stepKey: key }),
      }).catch(() => {})
    },
    [csrf],
  )

  const hasSeenStep = useCallback((key: string) => seenKeysRef.current.has(key), [])

  // Records that `currentStepDef` was SHOWN, gated on `currentTarget` also
  // being resolved — NOT on `currentStepDef` alone. Task 7's own report
  // flagged the bug this closes: on an all-empty workspace, `AskWorkspace`
  // renders `GetStarted` instead of `AskChat`, so `ask-composer` (ask-v1's
  // target) never mounts; `stepIndex` still advances to `ask-v1` regardless
  // (joyride's own TARGET_NOT_FOUND check runs a tick later), and recording
  // "seen" on the index change alone wrote a row for a card the user was
  // never actually shown — corrupting `nextStepKey`'s resume logic, which
  // trusts every row in `user_tour_steps` to mean exactly that. Requiring
  // `currentTarget` first means this effect can only ever fire once
  // joyride has something real to draw the card on — the same condition
  // joyride itself needs to render anything instead of emitting
  // TARGET_NOT_FOUND — so "recorded" and "actually shown" can no longer
  // drift apart. A target that never resolves (this empty-workspace case)
  // now correctly records nothing; the tour still ends cleanly via the
  // existing TARGET_NOT_FOUND branch in `handleEvent` above.
  useEffect(() => {
    if (!currentStepDef || !currentTarget) return
    recordStepSeen(currentStepDef.key)
  }, [currentStepDef, currentTarget, recordStepSeen])

  // The pill's own decline — a real, permanent dismissal (users.tour_dismissed_at),
  // the same weight declining at welcome-v1 would carry. The rail's Guide
  // item still works afterwards; only auto-start and the pill itself respect
  // `dismissed`.
  const dismissTour = useCallback(() => {
    setDismissed(true)
    setPillVisible(false)
    void fetch('/api/tour/step', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => {})
  }, [csrf])

  // The auto-start gate (spec §5) — evaluated exactly once, at mount, using
  // whatever `pathname` and `seenKeysRef`/`dismissed` are at that instant:
  // the "landing path", not a re-check on every later client-side
  // navigation (organise-v1 alone pushes two routes mid-tour; re-running
  // this on every pathname change would fight that). Short-circuits away
  // without a network call whenever the server-rendered facts alone already
  // rule out auto-start (any progress, a dismissal, or landing anywhere but
  // exactly `/dashboard`) — `uploadInFlight` is the one fact that needs a
  // fetch, so it's only ever asked for when every other condition already
  // holds. Same cancelled-flag shape as UploadStep.tsx's own poll effect.
  useEffect(() => {
    let cancelled = false
    async function evaluate() {
      if (dismissed || pathname !== '/dashboard' || seenKeysRef.current.size !== 0) {
        if (!cancelled) setPillVisible(!dismissed && nextIndex() !== null)
        return
      }
      let uploadInFlight = false
      try {
        const r = await fetch('/api/documents')
        if (r.ok) {
          const d = (await r.json()) as { documents: { status: string }[] }
          uploadInFlight = d.documents.some(
            (doc) => doc.status === 'uploaded' || doc.status === 'parsing',
          )
        }
      } catch {
        // Best-effort, same as every other fetch in this file: a failed
        // check defaults to "no upload in flight" rather than stalling the
        // gate — the safer direction here, since a wrongly-skipped
        // auto-start just falls back to the pill, never a stuck page.
      }
      if (cancelled) return
      if (shouldAutoStart({ seenCount: 0, dismissed, path: pathname, uploadInFlight })) {
        start()
      } else {
        setPillVisible(nextIndex() !== null)
      }
    }
    void evaluate()
    return () => {
      cancelled = true
    }
    // Deliberately empty: this must run once, for the landing path, not on
    // every render or every `pathname` change thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tooltipComponent = useMemo(
    () => createTooltipComponent(dictionary.tour.ui),
    [dictionary],
  )

  const contextValue = useMemo<TourContextValue>(
    () => ({ start, active: run, hasSeenStep, recordStepSeen }),
    [start, run, hasSeenStep, recordStepSeen],
  )

  return (
    <TourContext.Provider value={contextValue}>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        tooltipComponent={tooltipComponent}
        onEvent={handleEvent}
        options={{
          // No dimming scrim — spec §3. The dashboard behind the card stays
          // fully visible and clickable; the active target gets the violet
          // ring (globals.css `[data-tour-active]`) instead.
          hideOverlay: true,
          // Belt-and-braces alongside hideOverlay: even if an overlay is
          // ever re-enabled later, a stray click on it must not silently
          // end the tour the way joyride's own 'close' default would.
          overlayClickAction: false,
          blockTargetInteraction: false,
          dismissKeyAction: 'close',
          // Joyride's default focus trap targets whatever DOM node ends up
          // as the floater wrapper — custom tooltipComponent or not — so it
          // must be disabled explicitly. Left on, it would fight the file
          // input a later step hosts inside this same card.
          disableFocusTrap: true,
          // No beacon: the card appears directly on the target, not behind
          // an extra pulsing-dot click first.
          skipBeacon: true,
          skipScroll: false,
          // prefers-reduced-motion guard — no tour library ships one.
          scrollDuration: reducedMotion ? 0 : 300,
        }}
      />
      {pillVisible && !run && (
        <TourPill
          label={dictionary.tour.ui.takeTour}
          dismissLabel={dictionary.tour.ui.declineTour}
          onStart={() => start()}
          onDismiss={dismissTour}
        />
      )}
      {children}
    </TourContext.Provider>
  )
}

type TourProviderProps = {
  locale: string
  role: TourRole
  csrf: string
  seenSteps: readonly string[]
  tourDismissed: boolean
  children: ReactNode
}

/**
 * Mounted once in `(app)/layout.tsx` so the tour survives route changes —
 * load-bearing now that organise-v1 (spec §4 step 3) actually navigates to
 * /dashboard/sources and back: were this provider mounted per-page instead,
 * the whole joyride instance (and its `run`/`stepIndex` state) would
 * unmount on the very navigation this step makes.
 *
 * `seenSteps`/`tourDismissed` come from the server (layout.tsx reads
 * `user_tour_steps` and `users.tour_dismissed_at` directly via Drizzle —
 * both are auth-owned tables, spec §6) and drive the auto-start gate and
 * resume position below. Server-side, never localStorage: on a shared
 * workstation the second person to sign in must get their own tour, not
 * inherit the first person's "completed" flag.
 */
export function TourProvider(props: TourProviderProps) {
  const dictionary = getDictionary(isLocale(props.locale) ? props.locale : 'en')

  return (
    <TourTargetProvider>
      <TourEngine
        dictionary={dictionary}
        role={props.role}
        csrf={props.csrf}
        seenSteps={props.seenSteps}
        tourDismissed={props.tourDismissed}
      >
        {props.children}
      </TourEngine>
    </TourTargetProvider>
  )
}
