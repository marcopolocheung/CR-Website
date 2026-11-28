import { requestJson } from './cashout-store'
import { getScheduleApiBase } from './schedule-store'
import { managerSession } from './internal-tools/manager-session'
import { revision, type RecordEnvelope, type StoreId } from './internal-tools/contracts'
import type { TranslationKey } from './internal-tools/i18n'
import { encodeMeta, linkKey, sha256Hex, validFileDoc, type FileChange, type FileDoc, type FileLink, type FileMeta } from './files'

export type FileRecord = RecordEnvelope<FileDoc>
export type FileVersion = { id: string; filename: string; mediaType: string; size: number; sha256: string; createdAt: string; addedBy: string }
export type FileActivity = { action: string; actor: string; at: string; revision: number }
export type FilesPage = { records: FileRecord[]; nextCursor: string | null; folders: string[]; labels: string[] }
export type FileQuery = { store?: StoreId | ''; folder?: string | null; label?: string; q?: string; trash?: boolean; link?: FileLink; cursor?: string }
export type FilesErrorCode = 'unauthorized' | 'backend_unconfigured' | 'conflict' | 'invalid' | 'unavailable'
export class FilesApiError extends Error {
  constructor(public code: FilesErrorCode, public currentRevision?: number) { super(code) }
}
function failure(status: number, body: unknown): FilesApiError {
  const error = (body as { error?: { code?: string; currentRevision?: number } } | null)?.error
  if (status === 401 || status === 403) return new FilesApiError('unauthorized')
  if (status === 503 && error?.code === 'backend_unconfigured') return new FilesApiError('backend_unconfigured')
  if (status === 409) return new FilesApiError('conflict', error?.currentRevision)
  return new FilesApiError(status === 400 ? 'invalid' : 'unavailable')
}
export const fileErrorKey = (error: unknown): TranslationKey => `files.error.${error instanceof FilesApiError ? error.code : 'unavailable'}` as TranslationKey
const validRecord = (record: unknown): record is FileRecord => {
  const value = record as FileRecord | null
  return !!value && value.family === 'attachment' && revision(value.revision) !== null && validFileDoc(value.data)
}

export async function listFiles(token: string, query: FileQuery): Promise<FilesPage> {
  const params = new URLSearchParams()
  if (query.store) params.set('store', query.store)
  if (query.folder !== undefined && query.folder !== null) params.set('folder', query.folder)
  if (query.label) params.set('label', query.label)
  if (query.q) params.set('q', query.q)
  if (query.trash) params.set('trash', '1')
  if (query.link) params.set('link', linkKey(query.link))
  if (query.cursor) params.set('cursor', query.cursor)
  const { status, body } = await requestJson(`/api/internal/files${params.size ? `?${params}` : ''}`, token)
  if (status !== 200) throw failure(status, body)
  const page = body as FilesPage | null
  if (!page || !Array.isArray(page.records) || !page.records.every(validRecord)) throw new FilesApiError('invalid')
  return { records: page.records, nextCursor: page.nextCursor ?? null, folders: page.folders ?? [], labels: page.labels ?? [] }
}

export async function getFile(token: string, store: StoreId, id: string) {
  const { status, body } = await requestJson(`/api/internal/files/${store}/${id}`, token)
  if (status !== 200) throw failure(status, body)
  const detail = body as { record: FileRecord; versions: FileVersion[]; activity: FileActivity[] } | null
  if (!detail || !validRecord(detail.record) || !Array.isArray(detail.versions) || !Array.isArray(detail.activity)) throw new FilesApiError('invalid')
  return detail
}

export async function changeFile(token: string, store: StoreId, id: string, change: FileChange): Promise<FileRecord> {
  const { status, body } = await requestJson(`/api/internal/files/${store}/${id}`, token, { method: 'POST', body: JSON.stringify(change) })
  if (status !== 200) throw failure(status, body)
  const record = (body as { record?: unknown } | null)?.record
  if (!validRecord(record)) throw new FilesApiError('invalid')
  return record
}

/** Bytes travel raw with metadata in a header; the server verifies size and SHA-256 before storing. */
export async function uploadFile(token: string, store: StoreId, id: string, file: File, meta: Omit<FileMeta, 'sha256' | 'size'>, timeoutMs = 120000): Promise<FileRecord> {
  const bytes = await file.arrayBuffer()
  const full: FileMeta = { ...meta, sha256: await sha256Hex(bytes), size: bytes.byteLength }
  const checkSession = managerSession.capture(token)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${getScheduleApiBase()}/api/internal/files/${store}/${id}/content`, {
      method: 'PUT', body: bytes, cache: 'no-store', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'X-File-Meta': encodeMeta(full) },
    })
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    checkSession()
    if (response.status !== 200) throw failure(response.status, body)
    const record = (body as { record?: unknown } | null)?.record
    if (!validRecord(record)) throw new FilesApiError('invalid')
    return record
  } catch (caught) {
    if (caught instanceof FilesApiError) throw caught
    if (caught instanceof Error && caught.name === 'SessionChangedError') throw caught
    throw new FilesApiError('unavailable')
  } finally { clearTimeout(timer) }
}

/** Fetches with the manager code, then saves through a temporary object URL. */
export async function downloadVersion(token: string, store: StoreId, version: FileVersion, timeoutMs = 120000): Promise<void> {
  const checkSession = managerSession.capture(token)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${getScheduleApiBase()}/api/internal/files/${store}/versions/${version.id}/content`, {
      cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
  } catch { throw new FilesApiError('unavailable') } finally { clearTimeout(timer) }
  checkSession()
  if (response.status !== 200) throw failure(response.status, await response.json().catch(() => null))
  const url = URL.createObjectURL(await response.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: version.filename })
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
