import type { D1Database } from '@cloudflare/workers-types'
import {
  apiError, businessDate, ERROR_STATUS, isStationId, isStoreId, operationId, recordId, revision,
  SCHEMA_VERSION, STATION_STORES, utcTimestamp,
  type ActorContext, type DateContext, type ErrorEnvelope, type FieldIssue, type Json,
  type MutationEnvelope, type RecordEnvelope, type RecordFamily, type StoreId, type StationId,
} from '../../src/lib/internal-tools/contracts'

export type MutationTarget = { storeId: StoreId; family: RecordFamily; id: string }
/** Supplied by an authorized service, not taken from untrusted request actor/scope fields. */
export type MutationContext = MutationTarget & {
  callerScope: string
  action: string
  actor: ActorContext
  stationId?: StationId
  context: DateContext
}
export type MutationResult<T extends Json> = { ok: true; record: RecordEnvelope<T>; replayed: boolean }
  | { ok: false; status: number; body: ErrorEnvelope }
const families: readonly RecordFamily[] = ['employee','membership','employee-mapping','schedule','schedule-request','cash-close','catalog','count','order','receipt','stock-event','import','form','follow-up','attachment']

/** Canonical JSON makes object-key order irrelevant and rejects lossy JSON coercion. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>()
  function encode(input: unknown): string {
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return JSON.stringify(input)
    if (typeof input === 'number' && Number.isFinite(input)) return JSON.stringify(input)
    if (!input || typeof input !== 'object' || seen.has(input)) throw new Error('invalid_json')
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw new Error('invalid_json')
    seen.add(input)
    try {
      if (Array.isArray(input)) {
        // Sparse arrays and undefined must not turn into apparently measured nulls.
        return '[' + Array.from({ length: input.length }, (_, index) => encode(input[index])).join(',') + ']'
      }
      return '{' + Object.keys(input).sort().map(key => JSON.stringify(key) + ':' + encode((input as Record<string, unknown>)[key])).join(',') + '}'
    } finally { seen.delete(input) }
  }
  return encode(value)
}
function validDateContext(context: DateContext): boolean {
  if (!context || typeof context !== 'object') return false
  return context.kind === 'undated' || (context.kind === 'day' ? businessDate(context.businessDate) !== null
    : context.kind === 'period' && businessDate(context.start) !== null && businessDate(context.end) !== null && context.start <= context.end)
}
function failed<T extends Json>(body: ErrorEnvelope): MutationResult<T> {
  return { ok: false, status: ERROR_STATUS[body.error.code], body }
}
function key(context: MutationContext, operation: string): string[] {
  return [context.callerScope, context.storeId, context.family, context.id, context.action, operation]
}
const receiptWhere = 'caller_scope=? AND store_id=? AND family=? AND record_id=? AND action=? AND operation_id=?'

type Receipt = { request_json: string; result_json: string }
async function receipt(db: D1Database, identity: string[]): Promise<Receipt | null> {
  return db.prepare(`SELECT request_json,result_json FROM mutation_operations WHERE ${receiptWhere}`).bind(...identity).first<Receipt>()
}
function replay<T extends Json>(prior: Receipt, request: string): MutationResult<T> {
  return prior.request_json === request ? { ok: true, record: JSON.parse(prior.result_json) as RecordEnvelope<T>, replayed: true }
    : failed(apiError('operation_reused'))
}

/**
 * Atomic record-envelope primitive. The consuming service authorizes access and
 * supplies its domain validator. No public generic mutation endpoint is exposed.
 * Domain relational projections need their own guarded transaction before activation.
 */
export async function mutateRecord<T extends Json>(
  db: D1Database,
  context: MutationContext,
  mutation: MutationEnvelope<T>,
  validate: (data: T) => FieldIssue[],
): Promise<MutationResult<T>> {
  if (mutation?.schemaVersion !== SCHEMA_VERSION) return failed(apiError('unsupported_schema'))
  if (!isStoreId(context.storeId) || !families.includes(context.family) || !recordId(context.id)
    || !recordId(context.callerScope) || !recordId(context.action) || !validDateContext(context.context)
    || (context.stationId !== undefined && (!isStationId(context.stationId) || STATION_STORES[context.stationId] !== context.storeId))
    || !operationId(mutation.operationId) || revision(mutation.baseRevision) === null || mutation.baseRevision >= Number.MAX_SAFE_INTEGER
    || !context.actor || (context.actor.kind === 'entered-label' ? typeof context.actor.label !== 'string' || !context.actor.label.trim()
      : context.actor.kind !== 'authenticated' || typeof context.actor.subject !== 'string' || !context.actor.subject.trim())) {
    return failed(apiError('validation_failed'))
  }
  let request: string
  try {
    request = canonicalJson({ schemaVersion: mutation.schemaVersion, baseRevision: mutation.baseRevision, data: mutation.data,
      stationId: context.stationId ?? null, context: context.context, actor: context.actor })
  } catch { return failed(apiError('validation_failed')) }
  const identity = key(context, mutation.operationId)
  try {
    // A successful retry returns its historical result even after subsequent edits.
    const prior = await receipt(db, identity)
    if (prior) return replay(prior, request)
    const issues = validate(mutation.data)
    if (issues.length) return failed(apiError('validation_failed', { fields: issues }))
    const now = utcTimestamp(new Date().toISOString())!
    const nextRevision = revision(mutation.baseRevision + 1)!
    const data = canonicalJson(mutation.data)
    // createdAt is selected within the transaction, not through a preflight read.
    const envelope = { schemaVersion: SCHEMA_VERSION, family: context.family, id: recordId(context.id)!,
      storeId: context.storeId, ...(context.stationId ? { stationId: context.stationId } : {}), context: context.context,
      revision: nextRevision, createdAt: now, updatedAt: now, data: mutation.data }
    const createResult = canonicalJson(envelope)
    const recordKeys = [context.storeId, context.family, context.id]
    const claim = db.prepare(`INSERT INTO mutation_operations
      (caller_scope,store_id,family,record_id,action,operation_id,request_json,result_json)
      SELECT ?,?,?,?,?,?,?,json_set(?, '$.createdAt', COALESCE((SELECT created_at FROM records WHERE store_id=? AND family=? AND id=?), ?))
      WHERE (?=0 AND NOT EXISTS (SELECT 1 FROM records WHERE store_id=? AND family=? AND id=?))
         OR EXISTS (SELECT 1 FROM records WHERE store_id=? AND family=? AND id=? AND revision=?)`)
      .bind(...identity, request, createResult, ...recordKeys, now, mutation.baseRevision, ...recordKeys, ...recordKeys, mutation.baseRevision)
    const claimExists = `EXISTS (SELECT 1 FROM mutation_operations WHERE ${receiptWhere})`
    const business = context.context.kind === 'day' ? context.context.businessDate : null
    const start = context.context.kind === 'period' ? context.context.start : null
    const end = context.context.kind === 'period' ? context.context.end : null
    const insert = db.prepare(`INSERT INTO records
      (store_id,family,id,station_id,schema_version,revision,context_kind,business_date,period_start,period_end,created_at,updated_at,data_json)
      SELECT ?,?,?,?,1,1,?,?,?,?,?,?,? WHERE ?=0 AND ${claimExists}`)
      .bind(...recordKeys, context.stationId ?? null, context.context.kind, business, start, end, now, now, data, mutation.baseRevision, ...identity)
    const update = db.prepare(`UPDATE records SET station_id=?, revision=?, context_kind=?, business_date=?, period_start=?, period_end=?, updated_at=?, data_json=?
      WHERE store_id=? AND family=? AND id=? AND revision=? AND ? > 0 AND ${claimExists}`)
      .bind(context.stationId ?? null, nextRevision, context.context.kind, business, start, end, now, data,
        ...recordKeys, mutation.baseRevision, mutation.baseRevision, ...identity)
    // The NOT NULL revision subquery also guards against committing a receipt without its record write.
    const event = db.prepare(`INSERT INTO change_events
      (caller_scope,store_id,family,record_id,action,operation_id,prior_revision,revision,occurred_at,actor_json,snapshot_json)
      SELECT caller_scope,store_id,family,record_id,action,operation_id,?,
        (SELECT revision FROM records WHERE store_id=? AND family=? AND id=? AND revision=? AND updated_at=? AND data_json=?),?,?,result_json
      FROM mutation_operations WHERE ${receiptWhere}`)
      .bind(mutation.baseRevision, ...recordKeys, nextRevision, now, data, now, canonicalJson(context.actor), ...identity)
    const results = await db.batch([claim, insert, update, event])
    if (results[0].meta.changes === 0) {
      const current = await db.prepare('SELECT revision FROM records WHERE store_id=? AND family=? AND id=?').bind(...recordKeys).first<{ revision: number }>()
      return failed(apiError('revision_conflict', { currentRevision: revision(current?.revision ?? 0)! }))
    }
    const saved = await receipt(db, identity)
    if (!saved) return failed(apiError('unavailable'))
    return { ok: true, record: JSON.parse(saved.result_json) as RecordEnvelope<T>, replayed: false }
  } catch {
    // A competing identical operation can win the receipt uniqueness race.
    try { const saved = await receipt(db, identity); if (saved) return replay(saved, request) } catch { /* unavailable */ }
    return failed(apiError('unavailable'))
  }
}
