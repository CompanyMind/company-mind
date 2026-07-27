/**
 * ============================================================================
 * BRAND CONSTANTS — the things that are identical in every language.
 * ============================================================================
 * A product name is not copy. Translating "CompanyMind" into three languages
 * would give the company three names, and the domain and mailbox would then be
 * translatable too, which is how a site ends up linking to `hello@kompaniya.ai`
 * in one language and nowhere in the others.
 *
 * Everything with words in it lives in `content/{uz,ru,en}.ts` instead.
 */

export const brand = {
  name: 'CompanyMind',
  domain: 'companymind.ai',
  email: 'hello@companymind.ai',
} as const
