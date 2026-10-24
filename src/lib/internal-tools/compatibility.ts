import { SCHEMA_VERSION, type ErrorEnvelope, apiError, revision, type Revision } from './contracts'

export const CAPABILITIES_PATH = '/api/internal/v1/capabilities'
export type Capabilities = {
  schemaVersion: 1
  services: Record<string, { readVersions: number[]; writeVersions: number[]; atomicRevisions: boolean; idempotentOperations: boolean }>
}
/** Never infer support from a type, binding, health response, or failed probe. */
export type CapabilityResult = { state: 'available'; value: Capabilities } | { state: 'legacy' }
  | { state: 'unavailable'; reason: 'request_failed' | 'invalid_manifest' | 'unsupported_schema' }
export function decodeCapabilities(status: number, body: unknown): CapabilityResult {
  if (status === 404) return { state: 'legacy' }
  if (status !== 200) return { state: 'unavailable', reason: 'request_failed' }
  if (!body || typeof body !== 'object') return { state: 'unavailable', reason: 'invalid_manifest' }
  const manifest = body as Record<string, unknown>
  if (manifest.schemaVersion !== SCHEMA_VERSION) return { state: 'unavailable', reason: 'unsupported_schema' }
  if (!manifest.services || typeof manifest.services !== 'object' || Array.isArray(manifest.services)) return { state: 'unavailable', reason: 'invalid_manifest' }
  for (const value of Object.values(manifest.services)) {
    if (!value || typeof value !== 'object') return { state: 'unavailable', reason: 'invalid_manifest' }
    const service = value as Record<string, unknown>
    const versions = (v: unknown) => Array.isArray(v) && v.every(n => Number.isSafeInteger(n) && n > 0)
    if (!versions(service.readVersions) || !versions(service.writeVersions) || typeof service.atomicRevisions !== 'boolean' || typeof service.idempotentOperations !== 'boolean') return { state: 'unavailable', reason: 'invalid_manifest' }
  }
  return { state: 'available', value: body as Capabilities }
}
export function canWriteV1(result: CapabilityResult, family: string): boolean {
  if (result.state !== 'available') return false
  const service = Object.hasOwn(result.value.services, family) ? result.value.services[family] : undefined
  return !!service && service.writeVersions.includes(1) && service.atomicRevisions && service.idempotentOperations
}

/** A wrapper, not a migration: retain the complete legacy body, including unknown fields. */
export type LegacySnapshot<T> = { format: 'legacy'; body: T; guarantees: 'legacy-kv'; knownRevision: Revision | null }
export function preserveLegacy<T>(body: T): LegacySnapshot<T> {
  const rev = body && typeof body === 'object' && 'rev' in body ? revision(body.rev) : null
  return { format: 'legacy', body, guarantees: 'legacy-kv', knownRevision: rev }
}
export function restoreLegacy<T>(snapshot: LegacySnapshot<T>): T { return snapshot.body }
/** Translate known legacy failures only; retain source response for recovery/log redaction. */
export function adaptLegacyError(status: number, body: unknown): { envelope: ErrorEnvelope; legacyBody: unknown } {
  const rev = body && typeof body === 'object' && 'rev' in body ? revision(body.rev) : null
  const code = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not_found'
    : status === 409 ? 'revision_conflict' : status === 400 ? 'validation_failed' : status === 429 ? 'rate_limited'
    : status === 503 ? 'backend_unconfigured' : 'unavailable'
  return { envelope: apiError(code, rev === null ? {} : { currentRevision: rev }), legacyBody: body }
}
