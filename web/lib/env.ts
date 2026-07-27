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
  get STORAGE_DIR() {
    return process.env.STORAGE_DIR ?? '.storage'
  },
  /**
   * 'hosted' — the operator runs one instance, many firms share one Postgres.
   * 'onprem' — the customer runs it inside their own network, one firm.
   *
   * Defaults to 'hosted', the WEAKER claim, on purpose: an unset variable must
   * never cause the product to assert an air-gap it does not have. An on-prem
   * install that forgets the flag under-sells itself, which is a marketing loss
   * rather than a false statement — the other way round is the opposite.
   *
   * This gates PRESENTATION ONLY — copy and nav visibility. Authorization stays
   * getSuperAdmin()/getOwner() in both modes; a mode flag that also granted or
   * revoked access would be a second, weaker security control shadowing the
   * first.
   */
  get DEPLOYMENT_MODE(): 'hosted' | 'onprem' {
    return process.env.DEPLOYMENT_MODE === 'onprem' ? 'onprem' : 'hosted'
  },
}
