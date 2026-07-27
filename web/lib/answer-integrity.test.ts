/**
 * An answer must never look better-evidenced than it is.
 *
 * Found live on production 2026-07-28: two of the top threads carried seven and
 * eight `[n]` markers with ZERO stored citations. The engine had already
 * dropped them (answer.py::resolve_citations discards any marker beyond the
 * number of retrieved passages and records `answer_uncited`), but the UI fell
 * through and printed the raw marker — so the reader saw what looked like eight
 * sources and could click none of them. On a product sold on traceability that
 * is the worst failure available.
 */
import { describe, it, expect } from 'vitest'
import { unresolvedMarkers, type Msg } from '@/app/(app)/dashboard/Message'
import { safeUrl } from '@/lib/answer-markdown'

const msg = (content: string, markers: number[] = []): Msg => ({
  id: 'm1',
  role: 'assistant',
  content,
  citations: markers.map((marker) => ({
    marker,
    chunkId: `c${marker}`,
    filename: 'policy.md',
    page: 1,
    snippet: 'text',
  })),
})

describe('unresolvedMarkers', () => {
  it('reports every marker with no citation behind it', () => {
    // The exact production case: the model numbered to 8, nothing was stored.
    const m = msg('…beyond that. [1][2][3][4][5][6][7][8]')
    expect(unresolvedMarkers(m)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('is silent when every marker resolves', () => {
    expect(unresolvedMarkers(msg('Retention is 7 years [1] per policy [2].', [1, 2]))).toEqual([])
  })

  it('reports only the markers that overran the retrieved set', () => {
    // Three retrieved, model wrote five: 4 and 5 are the lie, 1-3 are fine.
    expect(unresolvedMarkers(msg('a [1] b [2] c [3] d [4] e [5]', [1, 2, 3]))).toEqual([4, 5])
  })

  it('counts a repeated dead marker once', () => {
    expect(unresolvedMarkers(msg('see [9] and again [9]'))).toEqual([9])
  })

  it('is silent on an answer that never claimed a source', () => {
    // Small talk and refusals cite nothing on purpose — they must not be
    // flagged, or the warning becomes noise and stops being read.
    expect(unresolvedMarkers(msg('Salom! Sizga qanday yordam bera olaman?'))).toEqual([])
  })

  it('does not mistake ordinary bracketed text for a citation', () => {
    expect(unresolvedMarkers(msg('The form [see appendix] must be signed.'))).toEqual([])
  })
})

describe('safeUrl — a link inside an answer originates in an untrusted document', () => {
  it('keeps ordinary web and mail links', () => {
    for (const u of ['https://example.com/policy', 'http://intranet/x', 'mailto:hr@firm.example']) {
      expect(safeUrl(u)).toBe(u)
    }
  })

  it('drops scripting and data URLs', () => {
    // A document is data, never instructions — including when the model
    // faithfully echoes a link the document contained.
    for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', '  javascript:alert(1)', 'data:text/html,<script>']) {
      expect(safeUrl(u)).toBe('')
    }
  })
})
