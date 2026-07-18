import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { AskChat } from './AskChat'

export const runtime = 'nodejs'

export default async function AskPage() {
  await getCurrentUser()
  const csrf = await issueCsrf()
  return <AskChat csrf={csrf} />
}
