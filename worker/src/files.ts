import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { apiError, type MutationEnvelope, type RecordEnvelope, type StoreId } from '../../src/lib/internal-tools/contracts'
import { FILE_POLICY_VERSION, mediaType, sha256Hex, validFileDoc, type FileChange, type FileDoc, type FileMeta } from '../../src/lib/files'
import { mutateRecord, type MutationResult, type Projection } from './record-mutations'

export type FileRecord = RecordEnvelope<FileDoc>
export type FileVersion = { id: string; filename: string; mediaType: string; size: number; sha256: string; createdAt: string; addedBy: string }
export type FileActivity = { action: string; actor: string; at: string; revision: number }
type Row = { store_id: StoreId; id: string; data_json: string; revision: number; created_at: string; updated_at: string }
type Failure = { ok: false; status: number; body: ReturnType<typeof apiError> }
const columns = 'store_id,id,data_json,revision,created_at,updated_at'
const fail = (status: number, code: Parameters<typeof apiError>[0], detail = {}): Failure => ({ ok: false, status, body: apiError(code, detail) })

function envelope(row: Row): FileRecord {
  const data = JSON.parse(row.data_json)
  if (!validFileDoc(data)) throw new Error('Unsupported file record')
  return { schemaVersion: 1, family: 'attachment', id: row.id, storeId: row.store_id, context: { kind: 'undated' },
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, data } as FileRecord
}
async function current(db: D1Database, store: StoreId, id: string): Promise<FileRecord | null> {
  const row = await db.prepare(`SELECT ${columns} FROM records WHERE store_id=? AND family='attachment' AND id=?`).bind(store, id).first<Row>()
  return row ? envelope(row) : null
}
/** A retry of an acknowledged operation returns its original result without re-deriving content (trash time, bytes). */
async function acknowledged(db: D1Database, store: StoreId, id: string, action: string, operation: string): Promise<MutationResult<FileDoc> | null> {
  const prior = await db.prepare(`SELECT result_json FROM mutation_operations
    WHERE caller_scope='manager' AND store_id=? AND family='attachment' AND record_id=? AND action=? AND operation_id=?`)
    .bind(store, id, action, operation).first<{ result_json: string }>()
  return prior ? { ok: true, record: JSON.parse(prior.result_json) as FileRecord, replayed: true } : null
}
function save(db: D1Database, store: StoreId, id: string, action: string, base: number, operation: string, addedBy: string, data: FileDoc,
  projections?: (guard: Projection) => ReturnType<D1Database['prepare']>[]) {
  return mutateRecord<FileDoc>(db, { storeId: store, family: 'attachment', id, context: { kind: 'undated' }, callerScope: 'manager', action,
    actor: { kind: 'entered-label', label: addedBy } }, { schemaVersion: 1, baseRevision: base, operationId: operation, data } as MutationEnvelope<FileDoc>,
  value => validFileDoc(value) ? [] : [{ path: 'data', code: 'invalid_file' }], projections)
}

export type FileQuery = { store?: string; folder?: string | null; label?: string; q?: string; trash?: boolean; link?: string; cursor?: string }
/** Both stores, newest first. shortcut: json_each scans and facet queries are fine for hundreds of files; add indexed columns past ~10k. */
export async function filesPage(db: D1Database, query: FileQuery) {
  const [cursorAt, cursorId] = (query.cursor ?? '').split('|')
  const result = await db.prepare(`SELECT ${columns} FROM records WHERE family='attachment' AND id LIKE 'doc\\_%' ESCAPE '\\'
    AND (?1='' OR store_id=?1)
    AND (CASE WHEN ?2 THEN json_extract(data_json,'$.trashedAt') IS NOT NULL ELSE json_extract(data_json,'$.trashedAt') IS NULL END)
    AND (?3 IS NULL OR json_extract(data_json,'$.folder')=?3)
    AND (?4='' OR EXISTS (SELECT 1 FROM json_each(data_json,'$.labels') WHERE lower(value)=lower(?4)))
    AND (?5='' OR EXISTS (SELECT 1 FROM json_each(data_json,'$.links') WHERE json_extract(value,'$.kind')||':'||json_extract(value,'$.key')=?5))
    AND (?6='' OR instr(lower(json_extract(data_json,'$.name')),lower(?6))>0)
    AND (?7='' OR updated_at<?7 OR (updated_at=?7 AND id<?8))
    ORDER BY updated_at DESC, id DESC LIMIT 51`)
    .bind(query.store ?? '', query.trash ? 1 : 0, query.folder ?? null, query.label ?? '', query.link ?? '', query.q ?? '', cursorAt ?? '', cursorId ?? '')
    .all<Row>()
  const rows = result.results
  const facets = await db.prepare(`SELECT DISTINCT json_extract(data_json,'$.folder') AS folder FROM records
    WHERE family='attachment' AND id LIKE 'doc\\_%' ESCAPE '\\' AND json_extract(data_json,'$.trashedAt') IS NULL ORDER BY folder`).all<{ folder: string }>()
  const labels = await db.prepare(`SELECT DISTINCT value AS label FROM records, json_each(records.data_json,'$.labels')
    WHERE records.family='attachment' AND records.id LIKE 'doc\\_%' ESCAPE '\\' AND json_extract(records.data_json,'$.trashedAt') IS NULL ORDER BY lower(value)`).all<{ label: string }>()
  const last = rows[49]
  return { records: rows.slice(0, 50).map(envelope), nextCursor: rows.length > 50 && last ? `${last.updated_at}|${last.id}` : null,
    folders: facets.results.map(row => row.folder), labels: labels.results.map(row => row.label) }
}

export async function fileRecord(db: D1Database, store: StoreId, id: string) {
  const record = await current(db, store, id)
  if (!record) return null
  const versions = await db.prepare(`SELECT a.id,a.filename,a.media_type,a.byte_size,a.checksum,r.created_at,json_extract(r.data_json,'$.addedBy') AS added_by
    FROM attachments a JOIN records r ON r.store_id=a.store_id AND r.family='attachment' AND r.id=a.id
    WHERE a.store_id=? AND a.parent_family='attachment' AND a.parent_id=? AND a.status='available' ORDER BY r.created_at DESC, a.id DESC`)
    .bind(store, id).all<{ id: string; filename: string; media_type: string; byte_size: number; checksum: string; created_at: string; added_by: string }>()
  const events = await db.prepare(`SELECT action,actor_json,occurred_at,revision FROM change_events
    WHERE store_id=? AND family='attachment' AND record_id=? ORDER BY revision DESC`).bind(store, id).all<{ action: string; actor_json: string; occurred_at: string; revision: number }>()
  return {
    record,
    versions: versions.results.map((v): FileVersion => ({ id: v.id, filename: v.filename, mediaType: v.media_type, size: v.byte_size, sha256: v.checksum, createdAt: v.created_at, addedBy: v.added_by })),
    activity: events.results.map((e): FileActivity => ({ action: e.action, actor: (JSON.parse(e.actor_json) as { label?: string }).label ?? '', at: e.occurred_at, revision: e.revision })),
  }
}

/** New file (base 0) or replacement. Bytes are verified before storage; the document and version rows commit in one D1 batch. */
export async function saveFileContent(db: D1Database, bucket: R2Bucket, store: StoreId, id: string, meta: FileMeta, bytes: ArrayBuffer): Promise<MutationResult<FileDoc> | Failure> {
  const action = meta.baseRevision === 0 ? 'upload' : 'replace'
  const replay = await acknowledged(db, store, id, action, meta.operationId)
  if (replay) return replay
  if (bytes.byteLength !== meta.size || await sha256Hex(bytes) !== meta.sha256) return fail(400, 'validation_failed', { fields: [{ path: 'content', code: 'checksum_mismatch' }] })
  const existing = await current(db, store, id)
  if ((existing?.revision ?? 0) !== meta.baseRevision) return fail(409, 'revision_conflict', { currentRevision: existing?.revision ?? 0 })
  const data: FileDoc = existing
    ? { ...existing.data, currentVersionId: meta.versionId }
    : { name: meta.name, folder: meta.folder, labels: meta.labels, links: meta.links, currentVersionId: meta.versionId, trashedAt: null, addedBy: meta.addedBy }
  const key = `files/${store}/${meta.versionId}`
  // Never overwrite bytes that a stored version already references.
  if (await db.prepare('SELECT 1 FROM attachments WHERE object_key=?').bind(key).first()) return fail(409, 'operation_reused')
  await bucket.put(key, bytes, { httpMetadata: { contentType: 'application/octet-stream' } })
  const now = new Date().toISOString()
  const version = JSON.stringify({ kind: 'version', document: id, filename: meta.name, size: meta.size, sha256: meta.sha256, addedBy: meta.addedBy })
  const result = await save(db, store, id, action, meta.baseRevision, meta.operationId, meta.addedBy, data, guard => [
    db.prepare(`INSERT INTO records (store_id,family,id,station_id,schema_version,revision,context_kind,business_date,period_start,period_end,created_at,updated_at,data_json)
      SELECT ?,'attachment',?,NULL,1,1,'undated',NULL,NULL,NULL,?,?,? WHERE ${guard.sql}`).bind(store, meta.versionId, now, now, version, ...guard.binds),
    db.prepare(`INSERT INTO attachments (store_id,family,id,parent_family,parent_id,parent_revision,object_key,filename,media_type,byte_size,checksum,status,policy_decision,policy_version)
      SELECT ?,'attachment',?,'attachment',?,?,?,?,?,?,?,'available','DEC-03',? WHERE ${guard.sql}`)
      .bind(store, meta.versionId, id, meta.baseRevision + 1, key, meta.name, mediaType(meta.name), meta.size, meta.sha256, FILE_POLICY_VERSION, ...guard.binds),
  ])
  if (!result.ok && result.status === 409) {
    // The claim lost; remove our object only while nothing references it.
    try { if (!await db.prepare('SELECT 1 FROM attachments WHERE object_key=?').bind(key).first()) await bucket.delete(key) } catch { /* reconcileFiles reports it */ }
  }
  return result
}

/** Rename/move/relabel, trash or restore: one revision and one activity entry each. */
export async function changeFile(db: D1Database, store: StoreId, id: string, change: FileChange): Promise<MutationResult<FileDoc> | Failure> {
  const replay = await acknowledged(db, store, id, change.action, change.operationId)
  if (replay) return replay
  const existing = await current(db, store, id)
  if (!existing) return fail(404, 'not_found')
  if (existing.revision !== change.baseRevision) return fail(409, 'revision_conflict', { currentRevision: existing.revision })
  if ((change.action === 'trash') === (existing.data.trashedAt !== null) && change.action !== 'update') return fail(400, 'validation_failed', { fields: [{ path: 'action', code: 'no_change' }] })
  const data: FileDoc = change.action === 'update' ? { ...existing.data, name: change.name, folder: change.folder, labels: change.labels }
    : { ...existing.data, trashedAt: change.action === 'trash' ? new Date().toISOString() : null }
  return save(db, store, id, change.action, change.baseRevision, change.operationId, change.addedBy, data)
}

export async function fileContent(db: D1Database, bucket: R2Bucket, store: StoreId, version: string) {
  const row = await db.prepare(`SELECT object_key,filename FROM attachments WHERE store_id=? AND family='attachment' AND id=? AND status='available'`)
    .bind(store, version).first<{ object_key: string; filename: string }>()
  if (!row) return null
  const object = await bucket.get(row.object_key)
  return object ? { body: object.body, filename: row.filename, size: object.size } : null
}

export function downloadHeaders(filename: string, size: number): Record<string, string> {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_')
  return { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size), 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'no-store' }
}

/** Objects under files/ with no available attachment row. Never run against production by an agent. */
export async function reconcileFiles(db: D1Database, bucket: R2Bucket, options: { remove?: boolean; now?: number } = {}) {
  const orphans: string[] = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: 'files/', cursor })
    for (const object of page.objects) {
      const referenced = await db.prepare(`SELECT 1 FROM attachments WHERE object_key=? AND status='available'`).bind(object.key).first()
      if (referenced) continue
      orphans.push(object.key)
      if (options.remove && (options.now ?? Date.now()) - object.uploaded.getTime() > 24 * 3600 * 1000) await bucket.delete(object.key)
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return orphans
}
