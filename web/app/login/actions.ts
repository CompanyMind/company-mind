'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session-store'
import { checkLoginRate } from '@/lib/auth/rate-limit'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth/session'

// A real argon2id hash of a random string. When the email is unknown we still
// run a verify against this so response timing does not reveal whether the
// account exists. Computed once per process.
let decoyHash: string | null = null
async function decoy(): Promise<string> {
  if (!decoyHash) decoyHash = await hashPassword('no-such-user-decoy-password')
  return decoyHash
}

export async function login(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

  const rate = checkLoginRate(`${ip}:${email}`)
  if (!rate.ok) return { error: 'Too many attempts. Try again later.' }
  if (!email || !password) return { error: 'Email and password are required.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  // Uniform timing whether or not the user exists.
  const ok = await verifyPassword(user ? user.passwordHash : await decoy(), password)
  if (!user || !ok) return { error: 'Invalid email or password.' }
  // Same generic message as a wrong password — a distinct "you are blocked"
  // message would confirm to an attacker that the address is real.
  if (user.blockedAt) return { error: 'Invalid email or password.' }

  const { token, expires } = await createSession(user.id, {
    userAgent: h.get('user-agent') ?? undefined,
    ip,
  })
  ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions(expires))
  redirect('/dashboard')
}
