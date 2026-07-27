import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { chats, messages, users } from '@/lib/db/schema'
import { listDocuments } from '@/lib/documents'
import { getSuggestions } from '@/lib/engine'
import { getDictionary, isLocale } from '@/lib/i18n'
import { deriveOnboarding } from '@/lib/onboarding'
import { AskWorkspace } from './AskWorkspace'

export const runtime = 'nodejs'

export default async function AskPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  // Resolved server-side once and forwarded as plain, serializable slices —
  // same "pass the dictionary in from a server component" pattern index.ts's
  // own doc comment anticipates. Defaults to 'en' both for a signed-out
  // caller (auth is null) and for a locale value the dictionary set doesn't
  // recognise.
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')
  if (!auth) {
    return (
      <AskWorkspace
        csrf={csrf}
        onboarding={null}
        initialSuggestions={[]}
        dict={dict}
        canManage={false}
      />
    )
  }

  const docs = await listDocuments(auth.workspace.id, { userId: auth.user.id, role: auth.role })
  const indexedCount = docs.filter((d) => d.status === 'indexed').length
  const foldered = docs.some((d) => d.folderId !== null)

  const asked = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .where(and(eq(chats.userId, auth.user.id), eq(messages.role, 'user')))
    .limit(1)

  const me = await db.query.users.findFirst({
    where: eq(users.id, auth.user.id),
    columns: { onboardingDismissedAt: true },
  })

  const onboarding = deriveOnboarding({
    indexedCount,
    foldered,
    hasAsked: asked.length > 0,
    dismissed: !!me?.onboardingDismissedAt,
  })

  // The role rides on the session now (validateSessionToken already reads the
  // membership row to resolve the workspace), so this no longer re-queries it.
  const initialSuggestions = onboarding.workspaceEmpty
    ? []
    : await getSuggestions(auth.workspace.id, auth.user.id, auth.role)

  return (
    <AskWorkspace
      csrf={csrf}
      onboarding={onboarding}
      initialSuggestions={initialSuggestions}
      canManage={auth.role === 'owner'}
      dict={dict}
    />
  )
}
