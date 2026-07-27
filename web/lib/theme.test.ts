import { describe, it, expect } from 'vitest'
import { isTheme, isMotion, THEME_COOKIE, MOTION_COOKIE } from './theme'

describe('theme guards', () => {
  it('accepts exactly the three themes', () => {
    expect(['system', 'light', 'dark'].every(isTheme)).toBe(true)
  })

  it('rejects anything else, including near-misses and non-strings', () => {
    for (const bad of ['Dark', 'DARK', 'auto', '', 'light ', null, undefined, 0, {}])
      expect(isTheme(bad), String(bad)).toBe(false)
  })

  it('accepts exactly the two motion settings', () => {
    expect(['system', 'reduced'].every(isMotion)).toBe(true)
    for (const bad of ['none', 'off', 'Reduced', null, 1]) expect(isMotion(bad), String(bad)).toBe(false)
  })

  it('names cookies without colliding with the session cookie', () => {
    expect(THEME_COOKIE).toBe('cm_theme')
    expect(MOTION_COOKIE).toBe('cm_motion')
  })
})
