import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getSuggestions } from '@/lib/engine'

export const runtime = 'nodejs'

/**
 * Starter questions for the Ask empty state.
 *
 * This is how the model stays OFF the navigation path. The Ask page used to
 * `await getSuggestions()` in its server component, and the engine generates
 * these one LLM call per folder, sequentially — so opening Ask from Sources
 * waited on up to three round-trips before the composer existed at all, for
 * decoration that is only shown to someone who has not typed anything yet.
 * Fetched from the client, a slow model delays the suggestion chips and
 * nothing else.
 *
 * Scoping is the engine's: suggest_questions calls resolve_access first,
 * because offering "What is the Band 4 salary range?" to someone who cannot
 * open the HR file discloses both that the file exists and what is in it.
 */
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // The role rides on the session — validateSessionToken already reads the
  // membership row to resolve the workspace — so this no longer re-queries it.
  const questions = await getSuggestions(auth.workspace.id, auth.user.id, auth.role)
  return NextResponse.json({ questions })
}
