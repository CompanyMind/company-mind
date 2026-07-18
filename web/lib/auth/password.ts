import 'server-only'
import { hash, verify } from '@node-rs/argon2'

// argon2id defaults tuned for interactive login on a server CPU.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS)
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain)
  } catch {
    return false
  }
}
