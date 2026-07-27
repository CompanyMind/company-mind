/**
 * Atlas labels are filenames, and real corpora name files like
 * `engineering-11-recommendation-engine--architecture--runbook.md`. Printed
 * verbatim at 152 documents the map's centre became a pile of overlapping
 * slugs. This pins the trimming; the overlap skip itself lives in the canvas
 * painter, which has no DOM here to exercise.
 */
import { describe, it, expect } from 'vitest'
import { shortName } from '@/app/(app)/dashboard/atlas/Atlas'

describe('shortName', () => {
  it('drops the extension, the filing prefix, and the separators', () => {
    // The department is already the dot's colour — spending the label on it too
    // says the same thing twice and costs the part that distinguishes the file.
    expect(shortName('engineering-11-recommendation-engine--architecture--runbook.md')).toBe(
      'recommendation engine · architect…',
    )
    expect(shortName('security-02-access-control-policy.md')).toBe('access control policy')
    expect(shortName('hr-02-performance-review-calibration-guide.md')).toBe(
      'performance review calibration gu…',
    )
  })

  it('leaves an ordinary filename alone apart from its extension', () => {
    expect(shortName('handbook.pdf')).toBe('handbook')
    expect(shortName('Q3 Board Minutes.docx')).toBe('Q3 Board Minutes')
  })

  it('never returns an empty label', () => {
    // A name that is nothing but a prefix would otherwise strip to "".
    expect(shortName('finance-01-.md')).toBe('finance-01-')
    expect(shortName('.md')).not.toBe('')
  })

  it('bounds the label so one long name cannot blanket its neighbours', () => {
    const out = shortName('a'.repeat(120) + '.md')
    expect(out.length).toBeLessThanOrEqual(34)
    expect(out.endsWith('…')).toBe(true)
  })

  it('does not mistake a hyphenated word for a filing prefix', () => {
    // `access-control-policy` has no NN segment, so nothing may be removed.
    expect(shortName('access-control-policy.md')).toBe('access control policy')
  })
})
