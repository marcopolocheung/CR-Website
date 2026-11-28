import { requestJson } from './cashout-store'
import { SessionChangedError } from './internal-tools/manager-session'
import { StoreAuthError } from './schedule-store'
import type { AssistantProposal, ScheduleAssistantRequest } from './scheduler/assistant'

export type AssistantFailure = 'unconfigured' | 'rateLimited' | 'failed'
export class AssistantError extends Error {
  constructor(public reason: AssistantFailure) { super(reason); this.name = 'AssistantError' }
}

async function post(path: string, token: string, body: unknown): Promise<unknown> {
  let reply: { status: number; body: unknown }
  try {
    reply = await requestJson(path, token, { method: 'POST', body: JSON.stringify(body) }, 'Could not reach the assistant.', 90000)
  } catch (error) {
    // A changed manager session means this answer belongs to someone else's session; drop it.
    if (error instanceof SessionChangedError) throw error
    throw new AssistantError('failed')
  }
  if (reply.status === 401) throw new StoreAuthError()
  if (reply.status !== 200) throw new AssistantError(reply.status === 503 ? 'unconfigured' : reply.status === 429 ? 'rateLimited' : 'failed')
  return reply.body
}

export async function askCashQuestion(question: string, to: string, token: string) {
  const body = await post('/api/assistant/cash', token, { question, to }) as { answer?: unknown; coveredDates?: { from: string; to: string } | null }
  if (typeof body?.answer !== 'string') throw new AssistantError('failed')
  return { answer: body.answer, coveredDates: body.coveredDates ?? null }
}

export async function suggestScheduleChanges(draft: ScheduleAssistantRequest, token: string): Promise<AssistantProposal> {
  const body = await post('/api/assistant/schedule', token, draft) as Partial<AssistantProposal> | null
  if (typeof body?.reply !== 'string' || !Array.isArray(body.operations)) throw new AssistantError('failed')
  return { reply: body.reply, operations: body.operations }
}
