import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ru } from './ru'
import { uz } from './uz'
import { isLocale } from './index'

const dicts = { en, ru, uz }

describe('dictionaries', () => {
  it('every locale has the same keys as en', () => {
    const walk = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v ? walk(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
      )
    const base = walk(en).sort()
    for (const [name, d] of Object.entries(dicts)) {
      expect(walk(d as Record<string, unknown>).sort(), `${name} key set`).toEqual(base)
    }
  })

  // Real Uzbek Latin uses U+02BB / U+02BC, not an ASCII apostrophe. The same bug
  // already exists in engine/app/ask/qtype.py and silently breaks keyword matching.
  it('the uz dictionary never uses an ASCII apostrophe', () => {
    const offenders = JSON.stringify(uz).match(/[\w]'[\w]/g) ?? []
    expect(offenders, `use U+02BB (ʻ) instead: ${offenders.join(', ')}`).toEqual([])
  })

  it('isLocale accepts exactly the three supported locales', () => {
    expect(['en', 'ru', 'uz'].every(isLocale)).toBe(true)
    expect(isLocale('de')).toBe(false)
  })
})
