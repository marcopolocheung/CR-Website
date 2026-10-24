import { requestJson } from '../cashout-store'
import { canonicalJson } from '../internal-tools/json'
import { revision, STATION_STORES, utcTimestamp, type StationId } from '../internal-tools/contracts'
import { validRequestData, type RequestData, type RequestRecord } from './requests'

export class RequestApiError extends Error {
  constructor(public code: 'unauthorized' | 'unconfigured' | 'conflict' | 'invalid' | 'unavailable') { super(code) }
}
function failure(status: number, body: unknown) {
  const code = (body as { error?: { code?: string } } | null)?.error?.code
  return new RequestApiError(status === 401 || status === 403 ? 'unauthorized' : status === 404 || (status === 503 && code === 'backend_unconfigured') ? 'unconfigured'
    : status === 409 ? 'conflict' : status === 400 ? 'invalid' : 'unavailable')
}
export function validRequestRecord(value: unknown, station: StationId): value is RequestRecord {
  const record = value as RequestRecord | null
  return !!record && record.schemaVersion === 1 && record.family === 'schedule-request' && record.id === `requests-${station}`
    && record.storeId === STATION_STORES[station] && record.stationId === station && record.context?.kind === 'undated'
    && revision(record.revision) !== null && record.revision > 0 && !!utcTimestamp(record.createdAt) && !!utcTimestamp(record.updatedAt)
    && validRequestData(record.data, station)
}
export async function fetchRequests(station: StationId, token: string): Promise<RequestRecord | null> {
  const { status, body } = await requestJson(`/api/internal/schedule-requests/${station}`, token)
  if (status !== 200) throw failure(status, body)
  const record = (body as { record?: unknown } | null)?.record
  if (record === null) return null
  if (!validRequestRecord(record, station)) throw new RequestApiError('invalid')
  return record
}
export async function putRequests(station: StationId, token: string, previous: RequestRecord | null, data: RequestData, preparer: string, operationId: string): Promise<RequestRecord> {
  const { status, body } = await requestJson(`/api/internal/schedule-requests/${station}`, token, {
    method: 'PUT', body: JSON.stringify({ preparer, mutation: { schemaVersion: 1, baseRevision: previous?.revision ?? 0, operationId, data } }),
  })
  if (status !== 200) throw failure(status, body)
  const record = (body as { record?: unknown } | null)?.record
  if (!validRequestRecord(record, station) || record.revision !== (previous?.revision ?? 0) + 1
    || canonicalJson(record.data) !== canonicalJson(data)) throw new RequestApiError('invalid')
  return record
}
