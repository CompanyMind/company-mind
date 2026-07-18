import 'server-only'

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

// Getters, not eager reads: accessing a required var throws only when it is
// actually needed at runtime — never at module import, so `next build` (which
// imports these modules with no DB env set) does not fail.
export const env = {
  get DATABASE_URL() {
    return req('DATABASE_URL')
  },
  get SESSION_SECRET() {
    return req('SESSION_SECRET')
  },
  get ENGINE_INTERNAL_SECRET() {
    return process.env.ENGINE_INTERNAL_SECRET ?? ''
  },
  get ENGINE_BASE_URL() {
    return process.env.ENGINE_BASE_URL ?? ''
  },
}
