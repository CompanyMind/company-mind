import { describe, it, expect } from 'vitest'
import { describeUserAgent } from './sessions'

describe('describeUserAgent', () => {
  it('names the browser and the OS', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS')
  })

  it('does not mistake Edge or Opera for Chrome — both put Chrome in their UA', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36 Edg/131.0'),
    ).toBe('Edge on Windows')
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36 OPR/117.0'),
    ).toBe('Opera on Windows')
  })

  it('does not mistake Chrome for Safari — Chrome puts Safari in its UA too', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1',
      ),
    ).toBe('Safari on iOS')
  })

  it('reads an iPhone as iOS, not macOS — its UA says "like Mac OS X"', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Chrome/131.0'),
    ).toBe('Chrome on iOS')
  })

  it('falls back rather than showing a raw user-agent string to a user', () => {
    expect(describeUserAgent(null)).toBe('Unknown device')
    expect(describeUserAgent('')).toBe('Unknown device')
    expect(describeUserAgent('curl/8.4.0')).toBe('Unknown device')
  })

  it('names whichever half it can when only one is recognisable', () => {
    expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101')).toBe('Linux')
    expect(describeUserAgent('Firefox/122.0')).toBe('Firefox')
  })
})
