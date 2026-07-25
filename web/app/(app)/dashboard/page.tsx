import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { chats, memberships, messages, users } from '@/lib/db/schema'
import { listDocuments } from '@/lib/documents'
import { getSuggestions } from '@/lib/engine'
import { deriveOnboarding } from '@/lib/onboarding'
import { AskWorkspace } from './AskWorkspace'

export const runtime = 'nodejs'

export default async function AskPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  if (!auth) return <AskWorkspace csrf={csrf} onboarding={null} initialSuggestions={[]} />

  const docs = await listDocuments(auth.workspace.id)
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

  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })
  const initialSuggestions = onboarding.workspaceEmpty
    ? []
    : await getSuggestions(auth.workspace.id, auth.user.id, mem?.role ?? 'member')

  return (
    <AskWorkspace csrf={csrf} onboarding={onboarding} initialSuggestions={initialSuggestions} />
  )
}
