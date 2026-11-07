import { requestJson } from './cashout-store'
import { StoreAuthError, StoreUnavailableError } from './schedule-store'
import type { DigitalForm, DigitalFormDoc, DigitalFormType } from './digital-forms'
import type { SavedFormRow } from './forms'

async function request(path: string, token: string, init?: RequestInit) {
  const result = await requestJson(path, token, init, 'Could not reach the saved forms store.')
  if (result.status === 401) throw new StoreAuthError()
  if (result.status === 404) throw new StoreUnavailableError('That saved form was not found. It may have been deleted.')
  if (result.status === 400) throw new StoreUnavailableError('Check the required fields, dates, and amounts, then try saving again.')
  if (result.status === 413) throw new StoreUnavailableError('This form is too large. Shorten the text and try again.')
  if (result.status === 429) throw new StoreUnavailableError('Too many requests. Wait a bit and try again.')
  if (result.status === 503) throw new StoreUnavailableError('Saving is not set up yet. Set the SCHEDULE_WRITE_TOKEN secret on the Worker.')
  if (result.status < 200 || result.status >= 300) throw new StoreUnavailableError('Could not reach the saved forms store.')
  return result.body
}
export async function fetchDigitalForms(token: string): Promise<SavedFormRow[]> {
  const body = await request('/api/forms', token) as { forms?: SavedFormRow[] } | null
  if (!Array.isArray(body?.forms)) throw new StoreUnavailableError('Could not load saved forms.')
  return body.forms
}
export async function fetchDigitalForm(id: string, token: string): Promise<DigitalFormDoc> {
  return await request(`/api/forms/${id}`, token) as DigitalFormDoc
}
export async function saveDigitalForm(type: DigitalFormType, form: DigitalForm, token: string): Promise<DigitalFormDoc> {
  return await request('/api/forms', token, { method: 'POST', body: JSON.stringify({ type, form }) }) as DigitalFormDoc
}
export async function saveDigitalFormLabel(id: string, label: string, token: string): Promise<DigitalFormDoc> {
  return await request(`/api/forms/${id}/label`, token, { method: 'PUT', body: JSON.stringify({ label }) }) as DigitalFormDoc
}
/** Both stores remove their document and the metadata used by every saved-forms table. */
export async function deleteSavedForm(row: Pick<SavedFormRow, 'type' | 'id'>, token: string): Promise<void> {
  await request(`/api/${row.type === 'write-up' ? 'writeups' : 'forms'}/${row.id}`, token, { method: 'DELETE' })
}
