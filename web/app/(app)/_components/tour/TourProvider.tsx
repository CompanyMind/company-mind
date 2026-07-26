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
import { ACTIONS, EVENTS, Joyride, ORIGIN } from 'react-joyride'
import type { EventData, Step as JoyrideStepConfig, TooltipRenderProps } from 'react-joyride'
import { getDictionary, isLocale, type Dictionary } from '@/lib/i18n'
import { TourTargetProvider, useTourTargetEl, type TourTarget } from '@/lib/tour/targets'
import { TourCard } from './TourCard'

export type TourRole = 'owner' | 'member'

type TourContextValue = {
  /** Starts the tour from step 0. */
  start: () => void
  /** Whether a tour is currently running. */
  active: boolean
}

// Harmless no-op default, same pattern as targets.ts's noopRegistry: any
// dashboard surface can call useTour() unconditionally without caring
// whether it happens to render above or below TourProvider.
const noopTour: TourContextValue = { start: () => {}, active: false }
const TourContext = createContext<TourContextValue>(noopTour)

export function useTour(): TourContextValue {
  return useContext(TourContext)
}

/**
 * A single tour step, ahead of `web/lib/tour/steps.ts` (a later task).
 * `target` is a `TourTarget`, not a raw selector or element, so a step can
 * never name chrome the target registry (Task 3) doesn't know about.
 */
type TourStepDef = {
  key: string
  target: TourTarget
  heading: string
  body: string
  /** @default 'bottom' (joyride's own default) */
  placement?: JoyrideStepConfig['placement']
}

// PROOF-OF-WIRING ONLY. Two real copy entries, two real durable targets (the
// Ask pane and the Access rail link both exist on every dashboard render —
// see lib/tour/targets.ts and Task 3's runtime verification) — enough to
// exercise the whole controlled-mode + ring + focus + Escape path end to
// end. Replaced wholesale by an import from `lib/tour/steps.ts` next task;
// do not grow this list — that is that task's job, with real step keys.
function throwawaySteps(dictionary: Dictionary): TourStepDef[] {
  return [
    {
      key: 'welcome-v1',
      target: 'ask-pane',
      heading: dictionary.tour.welcome.heading,
      body: dictionary.tour.welcome.body,
      // ask-pane fills nearly the whole viewport, so an edge-relative
      // placement (joyride's 'bottom' default) anchors off whichever edge
      // of that huge box floating-ui picks — often off-screen. Centering is
      // the standard treatment for a whole-pane target; the real steps.ts
      // (next task) will need the same call for this same target.
      placement: 'center',
    },
    {
      key: 'access-v1',
      target: 'rail-access',
      heading: dictionary.tour.access.heading,
      body: dictionary.tour.access.body,
    },
  ]
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

function TourEngine({ dictionary, children }: { dictionary: Dictionary; children: ReactNode }) {
  const stepDefs = useMemo(() => throwawaySteps(dictionary), [dictionary])
  const reducedMotion = usePrefersReducedMotion()

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
  // `resolveTarget`'s closures below depend on.
  useEffect(() => {
    targetElementsRef.current = targetElements
  })

  const resolveTarget = useCallback(
    (name: TourTarget) => () => targetElementsRef.current[name],
    [],
  )

  const steps: JoyrideStepConfig[] = useMemo(
    () =>
      stepDefs.map((def) => ({
        id: def.key,
        target: resolveTarget(def.target),
        title: def.heading,
        content: def.body,
        ...(def.placement ? { placement: def.placement } : {}),
      })),
    [stepDefs, resolveTarget],
  )

  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const start = useCallback(() => {
    setStepIndex(0)
    setRun(true)
  }, [])

  const endTour = useCallback(() => {
    setRun(false)
    setStepIndex(0)
  }, [])

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
      // win regardless of what action it resolved to.
      if (data.origin === ORIGIN.KEYBOARD) {
        endTour()
        return
      }

      if (data.type === EVENTS.STEP_AFTER) {
        if (data.action === ACTIONS.NEXT) {
          const next = data.index + 1
          if (next >= data.size) {
            endTour()
          } else {
            setStepIndex(next)
          }
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

      if (
        data.type === EVENTS.TOUR_END ||
        data.type === EVENTS.TARGET_NOT_FOUND ||
        data.type === EVENTS.ERROR
      ) {
        endTour()
      }
    },
    [endTour],
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

  const tooltipComponent = useMemo(
    () => createTooltipComponent(dictionary.tour.ui),
    [dictionary],
  )

  const contextValue = useMemo<TourContextValue>(() => ({ start, active: run }), [start, run])

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
 * Mounted once in `(app)/layout.tsx` so the tour survives route changes.
 * `role`/`csrf`/`seenSteps`/`tourDismissed` are accepted now so this
 * provider's shape already matches what auto-start and persistence (a later
 * task, once `user_tour_steps` exists — spec §6) will need; this task's
 * tour starts only when `start()` is called, so they go unread here on
 * purpose.
 */
export function TourProvider(props: TourProviderProps) {
  const dictionary = getDictionary(isLocale(props.locale) ? props.locale : 'en')

  return (
    <TourTargetProvider>
      <TourEngine dictionary={dictionary}>{props.children}</TourEngine>
    </TourTargetProvider>
  )
}
