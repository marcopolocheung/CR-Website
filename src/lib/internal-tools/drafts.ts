import { businessDate, isStoreId, isStationId, STATION_STORES, utcTimestamp, type BusinessDate, type Json, type StoreId, type StationId } from './contracts'

export const DRAFT_PREFIX = 'cr-internal-draft:'
type DraftScope = {
  task: 'cash-out' | 'inventory-count' | 'form' | 'sales-import' | 'hours-import' | 'schedule'
  storeId: StoreId
  stationId?: StationId
  shift?: string
  recordId?: string
}
export type DraftContext = DraftScope & ({ businessDate: BusinessDate; period?: never } | { businessDate?: never; period: { start: BusinessDate; end: BusinessDate } })
export type Draft<T> = {
  schemaVersion: 1
  id: string
  sourceId: string | null
  context: DraftContext
  preparer: string
  createdAt: string
  updatedAt: string
  knownServerRevision: number | null
  payload: T
}
export type DraftStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>
export type DraftSource<T> = { state: 'ready'; key: string; raw: string; draft: Draft<T>; upgraded: boolean }
  | { state: 'unreadable'; key: string; raw: string; reason: 'corrupt' | 'unsupported_schema' | 'invalid_payload' }
export type DraftList<T> = { state: 'available' | 'unavailable'; sources: DraftSource<T>[] }
const TASKS = ['cash-out', 'inventory-count', 'form', 'sales-import', 'hours-import', 'schedule']
const ID = /^[A-Za-z0-9_-]{1,128}$/
export function validDraftContext(value: unknown): value is DraftContext {
  if (!value || typeof value !== 'object') return false
  const c = value as DraftContext
  return Object.keys(c).every(key => ['task','storeId','businessDate','period','stationId','shift','recordId'].includes(key)) && TASKS.includes(c.task) && isStoreId(c.storeId) && ((businessDate(c.businessDate) !== null && c.period === undefined) || (c.businessDate === undefined && !!c.period && typeof c.period === 'object' && Object.keys(c.period).every(key => ['start','end'].includes(key)) && businessDate(c.period.start) !== null && businessDate(c.period.end) !== null && c.period.start <= c.period.end))
    && (c.stationId === undefined || (isStationId(c.stationId) && STATION_STORES[c.stationId] === c.storeId))
    && (c.shift === undefined || (typeof c.shift === 'string' && ID.test(c.shift)))
    && (c.recordId === undefined || (typeof c.recordId === 'string' && ID.test(c.recordId)))
}
/** Every context dimension participates; no label, locale or credential does. */
export function draftContextKey(context: DraftContext): string {
  if (!validDraftContext(context)) throw new Error('invalid_context')
  return encodeURIComponent(JSON.stringify([context.task, context.storeId, context.businessDate ?? null, context.period?.start ?? null, context.period?.end ?? null, context.stationId ?? null, context.shift ?? null, context.recordId ?? null]))
}
export function draftKey(draft: Pick<Draft<unknown>, 'context' | 'id'>): string {
  if (!ID.test(draft.id)) throw new Error('invalid_id')
  return `${DRAFT_PREFIX}${draftContextKey(draft.context)}:${draft.id}`
}
/** Defense against accidentally passing auth-bearing objects as generic payloads. */
function credentialFree(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (!value || typeof value !== 'object' || seen.has(value)) return false
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
  seen.add(value)
  try {
    return Object.entries(value).every(([key, child]) => !/token|password|authorization|secret/i.test(key) && credentialFree(child, seen))
      && (!Array.isArray(value) || Array.from({ length: value.length }, (_, i) => i).every(i => i in value))
  } finally { seen.delete(value) }
}
function validDraft<T>(value: unknown, validate: (payload: unknown) => payload is T): value is Draft<T> {
  if (!value || typeof value !== 'object') return false
  const d = value as Draft<T>
  const allowed = ['schemaVersion','id','sourceId','context','preparer','createdAt','updatedAt','knownServerRevision','payload']
  return Object.keys(d).every(key => allowed.includes(key)) && d.schemaVersion === 1 && typeof d.id === 'string' && ID.test(d.id)
    && (d.sourceId === null || (typeof d.sourceId === 'string' && ID.test(d.sourceId)))
    && validDraftContext(d.context) && typeof d.preparer === 'string' && d.preparer.trim().length > 0 && d.preparer.length <= 120
    && utcTimestamp(d.createdAt) !== null && utcTimestamp(d.updatedAt) !== null && d.createdAt <= d.updatedAt
    && (d.knownServerRevision === null || (Number.isSafeInteger(d.knownServerRevision) && d.knownServerRevision >= 0))
    && credentialFree(d) && validate(d.payload)
}
export function readDraft<T>(key: string, raw: string, validate: (payload: unknown) => payload is T): DraftSource<T> {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { state: 'unreadable', key, raw, reason: 'corrupt' } }
  const version = value && typeof value === 'object' && 'schemaVersion' in value ? value.schemaVersion : null
  if (version !== 0 && version !== 1) return { state: 'unreadable', key, raw, reason: 'unsupported_schema' }
  // Defined v0 fixture format omitted sourceId and createdAt. Upgrade in memory only;
  // resuming writes a new ID/key so the original bytes remain available for recovery.
  const candidate = version === 0 ? { ...value as object, schemaVersion: 1, sourceId: null, createdAt: (value as { updatedAt: unknown }).updatedAt } : value
  if (!validDraft(candidate, validate)) return { state: 'unreadable', key, raw, reason: 'invalid_payload' }
  return { state: 'ready', key, raw, draft: candidate, upgraded: version === 0 }
}
export function listDrafts<T>(storage: DraftStorage, context: DraftContext, validate: (payload: unknown) => payload is T): DraftList<T> {
  const sources: DraftSource<T>[] = []
  const prefix = `${DRAFT_PREFIX}${draftContextKey(context)}:`
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(prefix)) continue
      const raw = storage.getItem(key)
      if (raw === null) continue
      const source = readDraft(key, raw, validate)
      // A renamed/malformed key must never move a different context into this task.
      if (source.state === 'ready' && (draftContextKey(source.draft.context) !== draftContextKey(context) || (source.draft.schemaVersion === 1 && draftKey(source.draft) !== key))) sources.push({ state: 'unreadable', key, raw, reason: 'invalid_payload' })
      else sources.push(source)
    }
    sources.sort((a,b) => a.state === 'ready' && b.state === 'ready' ? b.draft.updatedAt.localeCompare(a.draft.updatedAt) : 0)
    return { state: 'available', sources }
  } catch { return { state: 'unavailable', sources } }
}
export function newDraft<T extends Json>(context: DraftContext, preparer: string, payload: T, options: { source?: Draft<T>; now?: string; id?: string } = {}): Draft<T> {
  if (!validDraftContext(context) || !preparer.trim() || preparer.length > 120 || !credentialFree(payload)) throw new Error('invalid_draft')
  const now = options.now ?? new Date().toISOString()
  if (!utcTimestamp(now)) throw new Error('invalid_time')
  if (options.source && draftContextKey(options.source.context) !== draftContextKey(context)) throw new Error('context_mismatch')
  const draft: Draft<T> = { schemaVersion: 1, id: options.id ?? crypto.randomUUID(), sourceId: options.source?.id ?? null,
    context: structuredClone(context), preparer, createdAt: now, updatedAt: now,
    knownServerRevision: options.source?.knownServerRevision ?? null, payload: structuredClone(payload) }
  draftKey(draft)
  return draft
}
export function saveDraft<T>(storage: DraftStorage, draft: Draft<T>, validate: (payload: unknown) => payload is T): { state: 'saved' } | { state: 'failed'; reason: 'invalid_draft' | 'storage_unavailable' } {
  if (!validDraft(draft, validate)) return { state: 'failed', reason: 'invalid_draft' }
  try {
    const key = draftKey(draft)
    const previous = storage.getItem(key)
    if (previous !== null) {
      const source = readDraft(key, previous, validate)
      if (source.state !== 'ready' || draftKey(source.draft) !== key) return { state: 'failed', reason: 'invalid_draft' }
    }
    storage.setItem(key, JSON.stringify(draft))
    return { state: 'saved' }
  } catch { return { state: 'failed', reason: 'storage_unavailable' } }
}
