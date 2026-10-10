import { StoreAuthError, StoreUnavailableError } from './schedule-store'
import { requestJson } from './cashout-store'

/**
 * Employee write-up store (`/api/writeups`). Reads and writes need the manager
 * token. A saved write-up's form never changes; only its label can be rewritten.
 */
export const VIOLATIONS = [
  { id: 'attendance', label: 'ATTENDANCE' },
  { id: 'job-performance', label: 'JOB PERFORMANCE' },
  { id: 'conduct', label: 'CONDUCT / BEHAVIOR' },
  { id: 'company-policy', label: 'COMPANY POLICY' },
  { id: 'others', label: 'OTHERS' },
] as const
export const ACTIONS = [
  { id: 'verbal', label: 'VERBAL' },
  { id: 'written', label: 'WRITTEN' },
  { id: 'suspension', label: 'SUSPENSIONS' },
  { id: 'termination', label: 'TERMINATION' },
] as const

export type WriteUpForm = {
  date: string
  employee: string
  manager: string
  violations: string[]
  otherSpecify: string
  actions: string[]
  incident: string
  incidentCont: string
  expected: string
  employeeComments: string
  employeeSignature: string
  employeeSignedDate: string
  managerSignature: string
  managerSignedDate: string
}
export type WriteUpSummary = { id: string; date: string; employee: string; label: string }
export type WriteUpDoc = { id: string; form: WriteUpForm; label: string; createdAt: string; labelUpdatedAt: string | null }

const UNREACHABLE = 'Could not reach the write-up store.'

export async function fetchWriteUps(token: string): Promise<WriteUpSummary[]> {
  const { status, body } = await requestJson('/api/writeups', token, undefined, UNREACHABLE)
  if (status === 200 && Array.isArray((body as { writeUps?: unknown } | null)?.writeUps)) return (body as { writeUps: WriteUpSummary[] }).writeUps
  throw errorFor(status)
}

export async function fetchWriteUp(id: string, token: string): Promise<WriteUpDoc> {
  const { status, body } = await requestJson(`/api/writeups/${id}`, token, undefined, UNREACHABLE)
  if (status === 200 && body) return body as WriteUpDoc
  throw errorFor(status)
}

export async function saveWriteUp(form: WriteUpForm, token: string): Promise<string> {
  const { status, body } = await requestJson('/api/writeups', token, { method: 'POST', body: JSON.stringify(form) }, UNREACHABLE)
  if (status === 201) return (body as { id: string }).id
  throw errorFor(status)
}

export async function saveWriteUpLabel(id: string, label: string, token: string): Promise<void> {
  const { status } = await requestJson(`/api/writeups/${id}/label`, token, { method: 'PUT', body: JSON.stringify({ label }) }, UNREACHABLE)
  if (status === 200) return
  throw errorFor(status)
}

function errorFor(status: number): Error {
  if (status === 401) return new StoreAuthError()
  if (status === 429) return new StoreUnavailableError('Too many requests. Wait a bit and try again.')
  if (status === 400) return new StoreUnavailableError('The server rejected this write-up. Check the date, the employee name, and the length of each box.')
  if (status === 404) return new StoreUnavailableError('That write-up was not found.')
  if (status === 503) return new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  return new StoreUnavailableError(UNREACHABLE)
}
