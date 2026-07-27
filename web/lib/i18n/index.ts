import { en, type Dictionary } from './en'
import { ru } from './ru'
import { uz } from './uz'

export type { Dictionary }
export type Locale = 'en' | 'ru' | 'uz'

const locales: readonly Locale[] = ['en', 'ru', 'uz']

export function isLocale(x: string): x is Locale {
  return (locales as readonly string[]).includes(x)
}

const dictionaries: Record<Locale, Dictionary> = { en, ru, uz }

// Deliberately NOT `import 'server-only'` here: the test imports en/ru/uz
// directly, and a later task passes a dictionary into client components as a
// prop, so this module (and the dictionary objects it re-exports) must stay
// importable from both server and client code. getDictionary itself is a
// trivial synchronous lookup with no server-only capability, so there is
// nothing here that actually needs the guard — the guard belongs on whatever
// server component *chooses* the locale from the request/session.
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
