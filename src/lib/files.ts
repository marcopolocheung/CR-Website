import { recordId, revision, operationId, isStoreId, type StoreId } from './internal-tools/contracts'

/** DEC-03-FILES attachments-v1: extension → canonical media type. Files are always served as downloads. */
export const FILE_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
} as const
export const MAX_BYTES = 25 * 1024 * 1024
export const FILE_POLICY_VERSION = 'attachments-v1'
export const ACCEPT = Object.keys(FILE_TYPES).map(ext => `.${ext}`).join(',')

export type LinkKind = 'import' | 'form' | 'writeup' | 'cash-close' | 'inventory-count'
export type FileLink = { kind: LinkKind; key: string }
export type FileDoc = {
  name: string; folder: string; labels: string[]; links: FileLink[]
  currentVersionId: string; trashedAt: string | null; addedBy: string
}
/** Upload metadata sent beside the raw bytes. */
export type FileMeta = {
  operationId: string; baseRevision: number; versionId: string; name: string; folder: string
  labels: string[]; links: FileLink[]; addedBy: string; sha256: string; size: number
}
/** Metadata-only changes; each one is a separate revision and activity entry. */
export type FileChange = { operationId: string; baseRevision: number; addedBy: string }
  & ({ action: 'update'; name: string; folder: string; labels: string[] } | { action: 'trash' } | { action: 'restore' })

const CONTROL = /[\u0000-\u001f\u007f]/
const LINK_KEYS: Record<LinkKind, RegExp> = {
  import: /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
  form: /^[A-Za-z0-9_-]{10}$/,
  writeup: /^[A-Za-z0-9_-]{10}$/,
  'cash-close': /^(CR2|CR3):\d{4}-\d{2}-\d{2}$/,
  'inventory-count': /^CR3:\d{4}-\d{2}-\d{2}$/,
}

export function extension(name: string): keyof typeof FILE_TYPES | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext && ext in FILE_TYPES ? ext as keyof typeof FILE_TYPES : null
}
export function mediaType(name: string): string | null {
  const ext = extension(name)
  return ext ? FILE_TYPES[ext] : null
}
/** A display filename: no path separators or control characters, 1–200 characters, allowed extension. */
export function fileName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name && name.length <= 200 && !/[\\/]/.test(name) && !CONTROL.test(name) && extension(name) ? name : null
}
/** `/`-separated, trimmed segments of 1–40 characters, at most 5 deep; '' is the top level. */
export function folderPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parts = value.split('/').map(part => part.trim()).filter(Boolean)
  if (parts.length > 5 || parts.some(part => part.length > 40 || CONTROL.test(part) || part === '.' || part === '..')) return null
  return parts.join('/')
}
/** At most 10 trimmed labels of 1–40 characters, deduplicated without regard to case. */
export function labelsList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') return null
    const label = raw.trim()
    if (!label) continue
    if (label.length > 40 || CONTROL.test(label)) return null
    if (!out.some(existing => existing.toLowerCase() === label.toLowerCase())) out.push(label)
  }
  return out.length <= 10 ? out : null
}
export function entered(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  return label && label.length <= 60 && !CONTROL.test(label) ? label : null
}
export function validLink(value: unknown): value is FileLink {
  const link = value as FileLink | null
  return !!link && typeof link === 'object' && Object.hasOwn(LINK_KEYS, link.kind) && typeof link.key === 'string' && LINK_KEYS[link.kind].test(link.key)
}
export const linkKey = (link: FileLink) => `${link.kind}:${link.key}`
export function parseLinkKey(value: string): FileLink | null {
  const at = value.indexOf(':')
  const link = at > 0 ? { kind: value.slice(0, at) as LinkKind, key: value.slice(at + 1) } : null
  return link && validLink(link) ? link : null
}
export const docId = (value: unknown) => typeof value === 'string' && /^doc_[A-Za-z0-9-]{8,64}$/.test(value) && recordId(value) ? value : null
export const versionId = (value: unknown) => typeof value === 'string' && /^ver_[A-Za-z0-9-]{8,64}$/.test(value) && recordId(value) ? value : null

/** Normalized upload metadata, or null when anything is outside attachments-v1. */
export function validFileMeta(raw: unknown): FileMeta | null {
  const meta = raw as Partial<FileMeta> | null
  if (!meta || typeof meta !== 'object') return null
  const name = fileName(meta.name), folder = folderPath(meta.folder ?? ''), labels = labelsList(meta.labels ?? []), addedBy = entered(meta.addedBy)
  const links = Array.isArray(meta.links) && meta.links.length <= 10 && meta.links.every(validLink) ? meta.links : null
  if (!name || folder === null || !labels || !addedBy || !links || !operationId(meta.operationId) || revision(meta.baseRevision) === null
    || !versionId(meta.versionId) || typeof meta.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(meta.sha256)
    || !Number.isSafeInteger(meta.size) || meta.size! < 0 || meta.size! > MAX_BYTES) return null
  return { operationId: meta.operationId!, baseRevision: meta.baseRevision!, versionId: meta.versionId!, name, folder, labels,
    links: links.map(link => ({ kind: link.kind, key: link.key })), addedBy, sha256: meta.sha256, size: meta.size! }
}
export function validFileChange(raw: unknown): FileChange | null {
  const change = raw as Partial<FileChange & { name: string; folder: string; labels: string[] }> | null
  if (!change || typeof change !== 'object' || !operationId(change.operationId) || revision(change.baseRevision) === null || !entered(change.addedBy)) return null
  const base = { operationId: change.operationId!, baseRevision: change.baseRevision!, addedBy: entered(change.addedBy)! }
  if (change.action === 'trash' || change.action === 'restore') return { ...base, action: change.action }
  if (change.action !== 'update') return null
  const name = fileName(change.name), folder = folderPath(change.folder ?? ''), labels = labelsList(change.labels ?? [])
  return name && folder !== null && labels ? { ...base, action: 'update', name, folder, labels } : null
}
export function validFileDoc(raw: unknown): raw is FileDoc {
  const doc = raw as FileDoc | null
  return !!doc && typeof doc === 'object' && fileName(doc.name) === doc.name && folderPath(doc.folder) === doc.folder
    && JSON.stringify(labelsList(doc.labels)) === JSON.stringify(doc.labels) && Array.isArray(doc.links) && doc.links.every(validLink)
    && !!versionId(doc.currentVersionId) && (doc.trashedAt === null || typeof doc.trashedAt === 'string') && entered(doc.addedBy) === doc.addedBy
}
export const fileStore = (value: unknown): StoreId | null => isStoreId(value) ? value : null

/** base64url JSON for the upload header (UTF-8 safe). */
export function encodeMeta(meta: FileMeta): string {
  const bytes = new TextEncoder().encode(JSON.stringify(meta))
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeMeta(value: string | null): unknown {
  if (!value || value.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))))
  } catch { return null }
}
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
