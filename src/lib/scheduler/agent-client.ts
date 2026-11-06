import type { AgentContext, AgentRunView } from './agent-contracts'

export const AGENT_API = process.env.NEXT_PUBLIC_AGENT_API?.replace(/\/$/, '') ?? ''
const messages: Record<string, string> = {
  unauthorized: 'The agent did not accept the manager code. Ask the owner to check its setup.',
  requests_changed: 'Time-off requests changed or could not be checked. Reload requests and make a new proposal.',
  draft_changed: 'Your week changed after this proposal was made. Make a new proposal to keep those changes.',
  operation_changed: 'This run belongs to an earlier draft. Make a new proposal.',
  run_budget: 'The hourly proposal limit was reached. Keep editing the schedule, then try again later.',
  busy: 'The agent is working on other proposals. Try again shortly.',
  invalid_input: 'Check the crew, shift rules, and selected week before trying again.',
  not_found: 'This proposal is no longer available. Make a new proposal.',
  run_in_progress: 'The proposal is still being saved. Try again shortly.',
  not_awaiting_review: 'This proposal is no longer waiting for review. Make a new proposal.',
}
export class AgentApiError extends Error {
  constructor(public code: string) { super(messages[code] ?? 'The agent could not finish this action. Your current schedule is unchanged.') }
}
export async function agentRequest(path: string, token: string, body?: unknown): Promise<AgentRunView> {
  let response: Response
  try {
    response = await fetch(`${AGENT_API}/api/agent/runs${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
    })
  } catch { throw new Error('Could not reach the scheduling agent. Your work is still here. Try again.') }
  const result = await response.json()
  if (!response.ok) throw new AgentApiError(result.error)
  if (!result || typeof result.id !== 'string' || typeof result.status !== 'string' || !Array.isArray(result.events))
    throw new Error('The agent sent an incomplete reply. Your current schedule is unchanged.')
  return result as AgentRunView
}
export function createAgentRun(id: string, context: AgentContext, goal: AgentRunView['goal'], token: string) {
  return agentRequest('', token, { id, context, goal })
}
