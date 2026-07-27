/**
 * Validation is a pure function, separate from the write, because vitest runs
 * in a `node` environment with no database — and because the interesting
 * failures here are all about what a hostile body can smuggle in, which is
 * exactly what a pure function can be exhaustively tested for.
 */
import { describe, it, expect } from 'vitest'
import { cleanProfilePatch } from './me'

describe('cleanProfilePatch', () => {
  it('passes through a valid patch', () => {
    expect(
      cleanProfilePatch({ name: 'Dovud', locale: 'uz', theme: 'dark', motion: 'reduced' }),
    ).toEqual({ name: 'Dovud', locale: 'uz', theme: 'dark', motion: 'reduced' })
  })

  it('accepts a partial patch and omits what was not sent', () => {
    expect(cleanProfilePatch({ theme: 'light' })).toEqual({ theme: 'light' })
  })

  it('trims the name and stores a blank one as null', () => {
    expect(cleanProfilePatch({ name: '  Dovud  ' })).toEqual({ name: 'Dovud' })
    expect(cleanProfilePatch({ name: '   ' })).toEqual({ name: null })
    expect(cleanProfilePatch({ name: null })).toEqual({ name: null })
  })

  it('rejects an over-long name rather than silently truncating it', () => {
    expect(cleanProfilePatch({ name: 'x'.repeat(81) })).toBeNull()
  })

  it('rejects an unknown locale, theme or motion', () => {
    expect(cleanProfilePatch({ locale: 'de' })).toBeNull()
    expect(cleanProfilePatch({ theme: 'midnight' })).toBeNull()
    expect(cleanProfilePatch({ motion: 'off' })).toBeNull()
  })

  it('ignores fields it does not own — an id in the body is not a target', () => {
    // The route resolves the user from the session. A patch that appears to
    // name someone else must not carry that name any further.
    expect(cleanProfilePatch({ id: 'someone-else', userId: 'someone-else', theme: 'dark' })).toEqual(
      { theme: 'dark' },
    )
  })

  it('ignores privilege fields even when they are valid column names', () => {
    // isSuperAdmin, blockedAt and passwordHash are all real columns on `users`.
    // A validator that spread its input instead of reading known keys would
    // hand every one of them straight to an UPDATE.
    expect(
      cleanProfilePatch({
        isSuperAdmin: true,
        blockedAt: null,
        passwordHash: 'x',
        mustChangePassword: false,
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' })
  })

  it('rejects a non-object body', () => {
    for (const bad of [null, undefined, 'dark', 42, []]) expect(cleanProfilePatch(bad)).toBeNull()
  })

  it('rejects an empty patch — a PATCH that changes nothing is a client bug', () => {
    expect(cleanProfilePatch({})).toBeNull()
  })
})
