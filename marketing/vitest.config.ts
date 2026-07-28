import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Marketing had no tests at all. It got them for one reason: the contact form
 * is the only page here where a bug costs money, and it shipped broken twice —
 * once delivering nowhere, once redirecting to a hostname that resolves only
 * inside Docker. Scope is deliberately narrow (`lib/**`): this is a
 * presentation site, and testing marketing copy would be noise.
 */
export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
})
