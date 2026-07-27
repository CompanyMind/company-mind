import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { getDictionary, isLocale } from '@/lib/i18n'
import { AccessManager } from './AccessManager'

export const runtime = 'nodejs'

export default async function AccessPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header>
        <h1 className="font-display text-2xl text-ink">Access</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Who can see which knowledge. Tag documents with groups in Sources.
        </p>
      </header>
      {/* Permanent prose on the access model, deliberately living on the page
          itself rather than only inside the tour's access-v1 card — spec §4:
          "This sentence must also live permanently on the Access page." A
          bank evaluator re-reading how the model works six months from now
          has no tour to replay it from; this paragraph is the only place
          that promise is guaranteed to still be sitting on screen. */}
      <div className="mt-4 rounded-md border border-line bg-paper-sunk px-4 py-3 text-body-sm text-ink-soft">
        {dict.emptyStates.access.body}
      </div>
      {/* The manager is owner-only — it creates and deletes groups and assigns
          people to them, all owner-gated at the API, and it lists every
          colleague's email. Members keep the page for the explanation above:
          understanding why an answer was scoped does not require the controls
          that do the scoping. */}
      {auth?.role === 'owner' && <AccessManager csrf={csrf} />}
    </div>
  )
}
