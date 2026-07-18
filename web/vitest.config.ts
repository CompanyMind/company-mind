import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const stub = fileURLToPath(new URL('./test/empty.ts', import.meta.url))

export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
  resolve: {
    alias: {
      'server-only': stub,
      'client-only': stub,
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
