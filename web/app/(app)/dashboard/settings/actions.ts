'use server'

import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth/current-user'
import { changePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/change-password'
import { SESSION_COOKIE } from '@/lib/auth/session'

const MESSAGES: Record<string, string> = {
  'wrong-password': 'That is not your current password.',
  'too-short': `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'same-password': 'Your new password must be different from your current one.',
  notfound: 'Something went wrong. Sign in again.',
}

export type PasswordFormState = { error?: string; ok?: boolean }

/**
 * Settings → Account → change password.
 *
 * A separate action from app/change-password/actions.ts on purpose: that one
 * redirects to /dashboard on success, which is right for the forced first-run
 * change (you have just arrived and belong in the product) and wrong here (you
 * are in a modal over your own work and should stay there). Both call the same
 * `changePassword` lib — the argon2id work and the "kill every OTHER session"
 * rule live there and are not reimplemented.
 */
export async function changeMyPassword(
  _prev: PasswordFormState | undefined,
  formData: FormData,
): Promise<PasswordFormState> {
  const auth = await getCurrentUser()
  if (!auth) return { error: 'Sign in again.' }

  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!currentPassword || !newPassword) return { error: 'Fill in every field.' }
  // Checked here rather than in changePassword: the confirmation field is a
  // typo guard belonging to this form, not a property of the password itself.
  if (newPassword !== confirmPassword) return { error: 'The two new passwords do not match.' }

  const result = await changePassword({
    userId: auth.user.id,
    currentPassword,
    newPassword,
    // The caller's own session survives; every other one is deleted.
    keepSessionToken: (await cookies()).get(SESSION_COOKIE)?.value,
  })

  if (result !== 'ok') return { error: MESSAGES[result] ?? 'Could not change your password.' }
  return { ok: true }
}
