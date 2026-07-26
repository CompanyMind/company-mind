import { createElement, Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Step as JoyrideStepConfig } from 'react-joyride'
import type { Dictionary } from '@/lib/i18n'
import { UploadStep } from '@/app/(app)/_components/tour/UploadStep'
import type { TourTarget } from './targets'

/**
 * A single tour step, independent of joyride's own `Step` shape. See
 * docs/superpowers/specs/2026-07-26-guided-tour-design.md §4 for the copy
 * and §5 for the interaction rules this implements.
 *
 * `target` is a `TourTarget`, not a raw selector or element, so a step can
 * never name chrome the target registry (web/lib/tour/targets.ts) doesn't
 * know about — a renamed or removed target is a `tsc` error here, not a
 * step that silently stops finding its anchor in production.
 *
 * `placement` is typed as joyride's own `Step['placement']`
 * (`Placement | 'auto' | 'center'`), not the `Placement` export alone —
 * `Placement` by itself excludes `'center'`, which `welcome-v1` needs for
 * its whole-pane target below. Confirmed by reading the installed
 * react-joyride 3.2.0 package's own `.d.mts` directly (its docs site
 * 404s), per this task's brief.
 */
export type TourStep = {
  key: string
  target: TourTarget
  /** @default 'bottom' (joyride's own default) */
  placement?: JoyrideStepConfig['placement']
  content: ReactNode
}

export type BuildStepsOptions = {
  role: 'owner' | 'member'
  dict: Dictionary
  /**
   * Whether the workspace has unfiled documents right now. Unread this
   * release: `organise-v1` (spec §4 step 3) only appears when this is
   * true, and only once the Organise-with-AI button — and its tour target —
   * ships on the Sources page (a later task). Accepted now so this
   * function's shape doesn't change again when that step lands; see the
   * seam noted in `buildSteps` below.
   */
  hasUnfiled: boolean
  /**
   * Threaded through to `UploadStep`, whose element is constructed here —
   * `useDocumentUpload`'s `POST /api/documents` calls need it, the same way
   * every other mutating fetch in this app receives it as an explicit prop
   * rather than a global or a client-side cookie read.
   */
  csrf: string
}

// A static, non-interactive replica of the citation chip in AskChat.tsx —
// same classes as the real `<button>` + `<a>` pair there, rendered as plain
// `<span>`s instead. A step can never target the real one: it doesn't exist
// in the DOM until an answer with a citation actually renders (spec §4 step
// 5), so ask-v1 shows a fixed example instead of pointing at nothing.
function citationReplica(): ReactNode {
  return createElement(
    'span',
    {
      className: 'mt-3 flex items-center gap-2 border-t border-line pt-3',
      'aria-hidden': 'true',
    },
    createElement(
      'span',
      { className: 'inline-flex items-center' },
      createElement(
        'span',
        {
          className:
            'rounded-l-md border border-line px-2 py-1 font-mono text-[0.7rem] text-ink-soft',
        },
        '[1] hr-policy.pdf · p.4',
      ),
      createElement(
        'span',
        {
          className:
            'rounded-r-md border border-l-0 border-line px-1.5 py-1 font-mono text-[0.7rem] text-ink-soft',
        },
        '↗',
      ),
    ),
  )
}

/**
 * Builds the ordered step list for one role. Owner gets `welcome-v1`,
 * `upload-v1`, `access-v1`, `ask-v1` this release (`organise-v1` is the
 * next task's seam — see the comment at its insertion point below). Member
 * gets `welcome-v1`, `access-member-v1`, `ask-v1` — no upload step, ever:
 * members may not have upload rights, and telling them to upload is the
 * exact failure the adaptive per-role design exists to avoid.
 */
export function buildSteps({ role, dict, csrf }: BuildStepsOptions): TourStep[] {
  const welcome: TourStep = {
    key: 'welcome-v1',
    target: 'ask-pane',
    // ask-pane fills nearly the whole viewport, so an edge-relative
    // placement anchors off whichever edge floating-ui happens to pick —
    // often off-screen. Centering is the standard treatment for a
    // whole-pane target (mirrors TourProvider.tsx's throwaway welcome step
    // from Task 4).
    placement: 'center',
    content: dict.tour.welcome.body,
  }

  const ask: TourStep = {
    key: 'ask-v1',
    target: 'ask-composer',
    // The composer is pinned to the bottom of the viewport (`sticky
    // bottom-0` in AskChat.tsx); the default 'bottom' placement would push
    // the card below the fold.
    placement: 'top',
    content: createElement(
      Fragment,
      null,
      createElement('p', null, dict.tour.ask.body),
      citationReplica(),
    ),
  }

  if (role === 'member') {
    return [
      welcome,
      {
        key: 'access-member-v1',
        target: 'rail-access',
        content: dict.tour.accessMember.body,
      },
      ask,
    ]
  }

  const upload: TourStep = {
    key: 'upload-v1',
    target: 'rail-sources',
    content: createElement(UploadStep, { csrf, dict }),
  }

  const access: TourStep = {
    key: 'access-v1',
    target: 'rail-access',
    content: dict.tour.access.body,
  }

  // organise-v1 (spec §4 step 3) belongs here, between upload-v1 and
  // access-v1, conditional on `hasUnfiled` — anchored to the
  // Organise-with-AI button that only renders once unfiled documents
  // exist. Deliberately not built this release; do not add it here without
  // also adding its target to web/lib/tour/targets.ts and wiring the
  // before-hook navigation in TourProvider.tsx.
  return [welcome, upload, access, ask]
}
