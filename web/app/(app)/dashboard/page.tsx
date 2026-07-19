import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { AskWorkspace } from './AskWorkspace'

export const runtime = 'nodejs'

export default async function AskPage() {
  await getCurrentUser()
  const csrf = await issueCsrf()
  return <AskWorkspace csrf={csrf} />
}
