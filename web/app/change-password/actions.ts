'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { changePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/change-password'
import { SESSION_COOKIE } from '@/lib/auth/session'

const MESSAGES: Record<string, string> = {
  'wrong-password': 'That is not your current password.',
  'too-short': `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'same-password': 'Your new password must be different from your current one.',
  notfound: 'Something went wrong. Sign in again.',
}

export async function submitPasswordChange(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')

  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!currentPassword || !newPassword) {
    return { error: 'Fill in every field.' }
  }
  // Checked here rather than in changePassword: the confirmation field is a
  // typo guard belonging to this form, not a property of the password itself.
  if (newPassword !== confirmPassword) {
    return { error: 'The two new passwords do not match.' }
  }

  const result = await changePassword({
    userId: auth.user.id,
    currentPassword,
    newPassword,
    keepSessionToken: (await cookies()).get(SESSION_COOKIE)?.value,
  })

  if (result !== 'ok') return { error: MESSAGES[result] ?? 'Could not change your password.' }
  redirect('/dashboard')
}
