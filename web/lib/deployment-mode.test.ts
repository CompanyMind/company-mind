/**
 * DEPLOYMENT_MODE decides what the product CLAIMS, never what it ALLOWS.
 *
 * The default matters more than it looks: unset must resolve to 'hosted', the
 * weaker claim. An on-prem install that forgets the flag under-sells itself,
 * which is a marketing loss. The reverse — a hosted deployment asserting
 * "nothing leaves your infrastructure" because someone forgot to set a variable
 * — is a false statement to a regulated buyer.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { env } from '@/lib/env'

const original = process.env.DEPLOYMENT_MODE

afterEach(() => {
  if (original === undefined) delete process.env.DEPLOYMENT_MODE
  else process.env.DEPLOYMENT_MODE = original
})

describe('DEPLOYMENT_MODE', () => {
  it('defaults to hosted — the weaker claim — when unset', () => {
    delete process.env.DEPLOYMENT_MODE
    expect(env.DEPLOYMENT_MODE).toBe('hosted')
  })

  it('is hosted for an empty string', () => {
    process.env.DEPLOYMENT_MODE = ''
    expect(env.DEPLOYMENT_MODE).toBe('hosted')
  })

  it('only the exact string "onprem" unlocks the stronger claim', () => {
    for (const v of ['onprem']) {
      process.env.DEPLOYMENT_MODE = v
      expect(env.DEPLOYMENT_MODE).toBe('onprem')
    }
    // Typos, casing and near-misses must NOT be read as on-prem: a claim about
    // air-gapping should never turn on by accident.
    for (const v of ['on-prem', 'ONPREM', 'On-Prem', 'on prem', 'true', 'yes', 'premise']) {
      process.env.DEPLOYMENT_MODE = v
      expect(env.DEPLOYMENT_MODE).toBe('hosted')
    }
  })
})
