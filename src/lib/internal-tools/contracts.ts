/** Internal-tools wire contract v1. Types do not advertise deployed capabilities. */
export const SCHEMA_VERSION = 1 as const
export const STORES = ['CR2', 'CR3'] as const
export type StoreId = typeof STORES[number]
export const STATION_STORES = {
  'CR3-diningroom': 'CR3', 'CR3-kitchen': 'CR3',
  'CR2-kitchen': 'CR2', 'CR2-diningroom': 'CR2',
} as const satisfies Record<string, StoreId>
export type StationId = keyof typeof STATION_STORES
export const DEFAULT_STATION: StationId = 'CR3-diningroom'
export type Locale = 'en' | 'es'

declare const scalar: unique symbol
export type BusinessDate = string & { readonly [scalar]: 'BusinessDate' }
export type UtcTimestamp = string & { readonly [scalar]: 'UtcTimestamp' }
export type RecordId = string & { readonly [scalar]: 'RecordId' }
export type EmployeeId = string & { readonly [scalar]: 'EmployeeId' }
export type OperationId = string & { readonly [scalar]: 'OperationId' }
export type UsdCents = number & { readonly [scalar]: 'UsdCents' }
export type Revision = number & { readonly [scalar]: 'Revision' }
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export function isStoreId(value: unknown): value is StoreId {
  return value === 'CR2' || value === 'CR3'
}
export function isStationId(value: unknown): value is StationId {
  return typeof value === 'string' && Object.hasOwn(STATION_STORES, value)
}
/** Empty/omitted legacy restaurant query retains the existing default. */
export function stationFromLegacyQuery(value: string | null): StationId | null {
  return value === null || value === '' ? DEFAULT_STATION : isStationId(value) ? value : null
}
export function businessDate(value: unknown): BusinessDate | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value as BusinessDate : null
}
export function utcTimestamp(value: unknown): UtcTimestamp | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value as UtcTimestamp : null
}
/** Opaque IDs are assigned, never derived from names, labels, or array positions. */
function opaque(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
}
export const recordId = (value: unknown): RecordId | null => opaque(value) ? value as RecordId : null
export const employeeId = (value: unknown): EmployeeId | null => opaque(value) ? value as EmployeeId : null
export const operationId = (value: unknown): OperationId | null => opaque(value) ? value as OperationId : null
export const usdCents = (value: unknown): UsdCents | null => typeof value === 'number' && Number.isSafeInteger(value) ? value as UsdCents : null
export const revision = (value: unknown): Revision | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value as Revision : null

export type RecordFamily = 'employee' | 'membership' | 'employee-mapping' | 'schedule' | 'schedule-request'
  | 'cash-close' | 'catalog' | 'count' | 'order' | 'receipt' | 'stock-event' | 'import' | 'form' | 'follow-up' | 'attachment'
export type DateContext = { kind: 'day'; businessDate: BusinessDate }
  | { kind: 'period'; start: BusinessDate; end: BusinessDate }
  | { kind: 'undated' }
export type RecordEnvelope<T> = {
  schemaVersion: typeof SCHEMA_VERSION
  family: RecordFamily
  id: RecordId
  storeId: StoreId
  stationId?: StationId
  context: DateContext
  /** Persisted records start at 1; revision 0 is a missing/create precondition only. */
  revision: Revision
  createdAt: UtcTimestamp
  updatedAt: UtcTimestamp
  data: T
}
export type MutationEnvelope<T> = {
  schemaVersion: typeof SCHEMA_VERSION
  baseRevision: Revision
  operationId: OperationId
  data: T
}
export type FieldIssue = { path: string; code: string; params?: Record<string, string | number> }
export const ERROR_STATUS = {
  validation_failed: 400, unauthorized: 401, forbidden: 403, not_found: 404,
  revision_conflict: 409, operation_reused: 409, policy_unresolved: 409,
  unsupported_schema: 400, rate_limited: 429, backend_unconfigured: 503, unavailable: 503,
} as const
export type ErrorCode = keyof typeof ERROR_STATUS
export type ErrorEnvelope = {
  schemaVersion: typeof SCHEMA_VERSION
  error: { code: ErrorCode; fields?: FieldIssue[]; currentRevision?: Revision; decision?: DecisionId }
}
export function apiError(code: ErrorCode, detail: Omit<ErrorEnvelope['error'], 'code'> = {}): ErrorEnvelope {
  return { schemaVersion: SCHEMA_VERSION, error: { ...detail, code } }
}

export const POLICY_OWNERS = {
  businessCalendar: 'DEC-01', cashRules: 'DEC-02', retentionAndAttachments: 'DEC-03',
  employeeIdentity: 'DEC-04', stockUnits: 'DEC-05', formApproval: 'DEC-06', displayAndEntry: 'DEC-07',
} as const
export type DecisionId = typeof POLICY_OWNERS[keyof typeof POLICY_OWNERS]
export type PolicyGate<T> = { state: 'unresolved'; decision: DecisionId; value: null }
  | { state: 'approved'; decision: DecisionId; version: string; approvedBy: string; approvedAt: UtcTimestamp; value: T }
export function unresolved<T>(decision: DecisionId): PolicyGate<T> { return { state: 'unresolved', decision, value: null } }
/** No stock decimal encoding or pack conversions are selected before DEC-05 examples. */
export type StockQuantity = { state: 'unresolved'; decision: 'DEC-05'; raw: string; unit: null }
export type EmployeeReference = { state: 'unmapped'; sourceSystem: string; sourceScope: string; externalId: string; displayNameSnapshot: string }
  | { state: 'mapped'; employeeId: EmployeeId; mappingId: RecordId; displayNameSnapshot: string }
export type LegacyLineage = { source: 'SCHEDULES'; key: string; checksum: string; sourceVersion: number | null }
export type ActorContext = { kind: 'entered-label'; label: string } | { kind: 'authenticated'; subject: string }
export type HistoryEvent = {
  id: RecordId; family: RecordFamily; recordId: RecordId; priorRevision: Revision; revision: Revision
  operationId: OperationId; kind: string; occurredAt: UtcTimestamp; actor: ActorContext
}
export type CountResponse = { state: 'uncounted' } | { state: 'measured-zero'; quantity: StockQuantity }
  | { state: 'measured'; quantity: StockQuantity } | { state: 'enough' } | { state: 'skipped'; reason: string | null }
export type AttachmentReference = { id: RecordId; parentFamily: RecordFamily; parentId: RecordId; parentRevision: Revision; status: 'pending' | 'available' | 'failed' }
export type ImportIdentity = {
  fingerprint: string; kind: string; storeId: StoreId; context: Exclude<DateContext, { kind: 'undated' }>
  slot: string; parserVersion: string; mappingRevision: Revision
}
