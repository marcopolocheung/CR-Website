import type { D1Database } from '@cloudflare/workers-types'
import { apiError, revision, STATION_STORES, type MutationEnvelope, type StationId } from '../../src/lib/internal-tools/contracts'
import { validRequestData, requestTransitionIssue, type RequestData, type RequestRecord } from '../../src/lib/scheduler/requests'
import { mutateRecord } from './record-mutations'

/** Bound bytes before buffering private request narratives. */
export async function readRequestMutation(request: Request): Promise<unknown> {
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 600000) { await reader.cancel(); return null }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { return null } finally { reader.releaseLock() }
}

export const requestRecordId = (station: StationId) => `requests-${station}`
export async function requestRecord(db: D1Database, station: StationId): Promise<RequestRecord | null> {
  const row = await db.prepare("SELECT data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='schedule-request' AND id=?")
    .bind(STATION_STORES[station], requestRecordId(station)).first<{ data_json: string; revision: number; created_at: string; updated_at: string }>()
  if (!row) return null
  const data: unknown = JSON.parse(row.data_json)
  if (!validRequestData(data, station)) throw new Error('Invalid schedule requests')
  return { schemaVersion: 1, family: 'schedule-request', id: requestRecordId(station), storeId: STATION_STORES[station], stationId: station,
    context: { kind: 'undated' }, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, data } as RequestRecord
}
export async function saveRequests(db: D1Database, station: StationId, raw: unknown) {
  const body = raw as { preparer?: string; mutation?: MutationEnvelope<RequestData> } | null
  if (!body || typeof body.preparer !== 'string' || !body.preparer.trim() || body.preparer.length > 120 || !body.mutation || !validRequestData(body.mutation.data, station)) {
    return { ok: false as const, status: 400, body: apiError('validation_failed') }
  }
  const previous = await requestRecord(db, station)
  const preparer = body.preparer.trim()
  const result = await mutateRecord(db, { storeId: STATION_STORES[station], family: 'schedule-request', id: requestRecordId(station), stationId: station,
    context: { kind: 'undated' }, callerScope: 'manager', action: 'edit-requests', actor: { kind: 'entered-label', label: preparer } }, body.mutation, data => {
    // A future base must never skip transition validation and then win a later revision race.
    // Receipt replay happens before this validator, so historical identical retries still succeed.
    if ((previous?.revision ?? 0) !== body.mutation!.baseRevision) return [{ path: 'baseRevision', code: 'stale_revision' }]
    const issue = requestTransitionIssue(previous?.data ?? null, data, preparer)
    return issue ? [{ path: 'requests', code: issue }] : []
  })
  if (!result.ok && result.body.error.fields?.some(issue => issue.code === 'stale_revision')) {
    return { ok: false as const, status: 409, body: apiError('revision_conflict', { currentRevision: revision(previous?.revision ?? 0)! }) }
  }
  return result
}
