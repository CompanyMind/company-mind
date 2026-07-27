import { describe, it, expect } from 'vitest'
import { contentDisposition } from './content-disposition'

/** What actually matters: the value can be put in a real Response without
 *  throwing, and it round-trips the name the customer uploaded. */
function assertUsableAsHeader(value: string) {
  expect(() => new Response(null, { headers: { 'content-disposition': value } })).not.toThrow()
}

const star = (value: string) => decodeURIComponent(value.split("filename*=UTF-8''")[1])

describe('contentDisposition', () => {
  it('always forces a download rather than inline rendering', () => {
    expect(contentDisposition('a.pdf')).toMatch(/^attachment;/)
  })

  it('keeps a plain ASCII name in both parameters', () => {
    const v = contentDisposition('handbook.pdf')
    expect(v).toContain('filename="handbook.pdf"')
    expect(star(v)).toBe('handbook.pdf')
    assertUsableAsHeader(v)
  })

  it('carries a Cyrillic name through the RFC 5987 parameter', () => {
    const v = contentDisposition('Ички-қоидалар.pdf')
    expect(star(v)).toBe('Ички-қоидалар.pdf')
    // The degraded copy keeps whatever ASCII there was, so the extension —
    // the part that decides which app opens it — survives for old parsers.
    expect(v).toContain('filename="-.pdf"')
    assertUsableAsHeader(v)
  })

  it('never emits an empty ASCII filename for a wholly non-ASCII name', () => {
    const v = contentDisposition('Ҳужжат')
    expect(v).toContain('filename="document"')
    expect(star(v)).toBe('Ҳужжат')
  })

  it('strips CR/LF so a filename cannot inject a second header', () => {
    const v = contentDisposition('a\r\nSet-Cookie: session=stolen.pdf')
    // The line break is the whole attack — the words themselves are inert once
    // they cannot start a new header line, so this asserts the break is gone
    // rather than that the text was scrubbed.
    expect(v).not.toMatch(/[\r\n]/)
    assertUsableAsHeader(v)
    // And prove it: a real Response exposes exactly one header, not two.
    const res = new Response(null, { headers: { 'content-disposition': v } })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect([...res.headers.keys()]).toEqual(['content-disposition'])
  })

  it('strips quotes and backslashes so the quoted-string cannot be closed early', () => {
    const v = contentDisposition('a".pdf')
    // Exactly two quotes in the whole value: the pair around the ASCII name.
    expect(v.split('"')).toHaveLength(3)
    assertUsableAsHeader(v)
  })

  it('percent-encodes the characters RFC 5987 excludes from attr-char', () => {
    const v = contentDisposition("it's (a) file!*.pdf")
    expect(star(v)).toBe("it's (a) file!*.pdf")
    const encoded = v.split("filename*=UTF-8''")[1]
    for (const c of ["'", '(', ')', '!', '*']) expect(encoded).not.toContain(c)
  })
})
