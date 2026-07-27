import 'server-only'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { env } from '@/lib/env'
import { getDictionary, isLocale } from '@/lib/i18n'
import { isMotion, isTheme } from '@/lib/theme'
import type { SettingsData } from './section-keys'

/**
 * Shared by both Settings entry points — the intercepted modal and the
 * standalone page. They render the same components, so they must resolve the
 * same data; extracting it here is what stops the two drifting into subtly
 * different screens.
 */
export async function loadSettingsData(): Promise<SettingsData> {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  const csrf = await issueCsrf()
  const locale = isLocale(auth.user.locale) ? auth.user.locale : 'en'
  return {
    csrf,
    dict: getDictionary(locale),
    name: auth.user.name,
    email: auth.user.email,
    locale,
    // Stored values are plain text columns, so they are validated on the way
    // out as well as on the way in — a hand-edited row must not put the UI in
    // a state its own controls cannot represent.
    theme: isTheme(auth.user.theme) ? auth.user.theme : 'system',
    motion: isMotion(auth.user.motion) ? auth.user.motion : 'system',
    workspaceName: auth.workspace.name,
    isOwner: auth.role === 'owner',
    deploymentMode: env.DEPLOYMENT_MODE,
  }
}
