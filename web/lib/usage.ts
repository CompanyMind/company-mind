import 'server-only'
import { env } from '@/lib/env'
import { seg } from '@/lib/engine-url'

// The engine owns query_log, documents and folders. This is a thin client
// over its internal /usage/summary endpoint — aggregate-only by design (see
// engine/app/library/usage.py): no question text, no per-user row, ever.

async function engineFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.ENGINE_BASE_URL}${path}`, {
    ...init,
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET, ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

export type QuestionTypeMix = {
  lookup: number
  comparison: number
  aggregate: number
  enumerate: number
}

export type UsageCounters = {
  questions: number
  activeUsers: number
  documentsIndexed: number
  folders: number
  questionTypes: QuestionTypeMix
  lexicalArmEmpty: number
  answerUncited: number
}

export type WorkspaceUsage = UsageCounters & {
  workspaceId: string
  name: string
}

export type UsagePerDay = {
  date: string
  questions: number
  activeUsers: number
}

export type UsageSummary = {
  days: number
  workspaces: WorkspaceUsage[]
  totals: UsageCounters
  perDay: UsagePerDay[]
}

type EngineCounters = {
  questions: number
  active_users: number
  documents_indexed: number
  folders: number
  question_types: QuestionTypeMix
  lexical_arm_empty: number
  answer_uncited: number
}

type EngineWorkspaceUsage = EngineCounters & {
  workspace_id: string
  name: string
}

type EngineUsageSummary = {
  days: number
  workspaces: EngineWorkspaceUsage[]
  totals: EngineCounters
  per_day: { date: string; questions: number; active_users: number }[]
}

function mapCounters(c: EngineCounters): UsageCounters {
  return {
    questions: c.questions,
    activeUsers: c.active_users,
    documentsIndexed: c.documents_indexed,
    folders: c.folders,
    questionTypes: c.question_types,
    lexicalArmEmpty: c.lexical_arm_empty,
    answerUncited: c.answer_uncited,
  }
}

export async function getUsageSummary(days = 30): Promise<UsageSummary> {
  const res = await engineFetch(`/usage/summary?days=${seg(String(days))}`)
  if (!res.ok) throw new Error(`engine /usage/summary responded ${res.status}`)
  const data = (await res.json()) as EngineUsageSummary
  return {
    days: data.days,
    workspaces: data.workspaces.map((w) => ({
      workspaceId: w.workspace_id,
      name: w.name,
      ...mapCounters(w),
    })),
    totals: mapCounters(data.totals),
    perDay: data.per_day.map((d) => ({
      date: d.date,
      questions: d.questions,
      activeUsers: d.active_users,
    })),
  }
}
