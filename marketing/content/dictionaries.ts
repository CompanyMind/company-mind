/**
 * ============================================================================
 * DICTIONARY LOOKUP — locale in, copy out.
 * ============================================================================
 * The three dictionaries are STATICALLY imported rather than dynamically
 * `import()`ed. The usual reason to load them lazily is bundle size, and it
 * does not apply here: every page on this site is a Server Component that
 * prerenders one locale at build time, so the dictionary never reaches the
 * browser at all — only the sentences a given page rendered do. A dynamic
 * import would buy nothing and make every consumer async.
 *
 * Client components never import this module. They receive the slice of copy
 * they need as props from the server, which is what keeps all three languages
 * out of the JavaScript bundle.
 */

import type { Locale } from '@/i18n/config'
import type { Dictionary } from './types'
import { en } from './en'
import { ru } from './ru'
import { uz } from './uz'

const dictionaries: Record<Locale, Dictionary> = { uz, ru, en }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}

/**
 * Substitutes `{name}` placeholders. Used for the handful of strings that
 * interpolate a number or a filename — "Source {n}: {name}" — where word order
 * differs between languages and string concatenation in the component would
 * hard-code English grammar.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
