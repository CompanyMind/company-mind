import 'server-only'
import { env } from '@/lib/env'

export type SourceView = {
  filename: string
  page: number | null
  charStart: number
  charEnd: number
  text: string
}

// Permission-checked source view. The engine owns the access rule and the
// knowledge tables; web passes the authenticated principal and gets a viewable,
// highlighted source or null (no leak either way).
export async function getSource(
  chunkId: string,
  workspaceId: string,
  userId: string,
  role: string,
): Promise<SourceView | null> {
  const url = new URL(`${env.ENGINE_BASE_URL}/source/${chunkId}`)
  url.searchParams.set('workspace_id', workspaceId)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('role', role)
  const res = await fetch(url, {
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`engine /source responded ${res.status}`)
  const s = await res.json()
  return {
    filename: s.filename,
    page: s.page,
    charStart: s.char_start,
    charEnd: s.char_end,
    text: s.text,
  }
}
