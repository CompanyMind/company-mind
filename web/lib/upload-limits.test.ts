import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, exceedsUploadLimit } from './upload-limits'

describe('exceedsUploadLimit', () => {
  it('rejects a declared length over the limit', () => {
    expect(exceedsUploadLimit(String(MAX_UPLOAD_BYTES + 1))).toBe(true)
  })

  it('accepts a declared length at the limit', () => {
    expect(exceedsUploadLimit(String(MAX_UPLOAD_BYTES))).toBe(false)
  })

  // A missing or unparseable header must not reject: the post-parse check on the
  // real file size is still authoritative, since Content-Length can lie.
  it('accepts a missing header', () => {
    expect(exceedsUploadLimit(null)).toBe(false)
  })

  it('accepts a garbage header', () => {
    expect(exceedsUploadLimit('not-a-number')).toBe(false)
  })
})
