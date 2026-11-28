import { isDigitalForm, isDigitalFormType, type DigitalForm } from '../digital-forms'
import { SAVED_FORM_TYPES, type SavedFormType } from '../forms'
import type { WriteUpForm } from '../writeup-store'
import { DRAFT_PREFIX, draftContextKey, draftKey, readDraft, validDraftContext, type Draft, type DraftContext } from './drafts'
import { isWriteUpDraft } from './writeup-draft'

export type FormDraftPayload = { form: WriteUpForm | DigitalForm; savedId: string | null }
export type ReadyFormDraftSource = {
  state: 'ready'; key: string; raw: string; formType: SavedFormType
  draft: Draft<FormDraftPayload>; upgraded: boolean
}
export type UnreadableFormDraftSource = {
  state: 'unreadable'; key: string; raw: string
  reason: 'corrupt' | 'unsupported_schema' | 'invalid_payload' | 'unsupported_form_type'
  formType?: string; context?: DraftContext
}
export type FormDraftSource = ReadyFormDraftSource | UnreadableFormDraftSource
export type FormDraftList = { state: 'available' | 'unavailable'; sources: FormDraftSource[] }
type ReadStorage = Pick<Storage, 'length' | 'key' | 'getItem'>

export const isSavedFormType = (value: unknown): value is SavedFormType => typeof value === 'string' && SAVED_FORM_TYPES.some(type => type === value)

/** The established payload shape is unchanged; discovery never upgrades bytes. */
export function formDraftPayloadValidator(type: SavedFormType) {
  return (value: unknown): value is FormDraftPayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const payload = value as Record<string, unknown>
    return Object.keys(payload).length === 2 && Object.hasOwn(payload, 'form') && Object.hasOwn(payload, 'savedId')
      && (payload.savedId === null || typeof payload.savedId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(payload.savedId))
      && (type === 'write-up' ? isWriteUpDraft(payload.form) : isDigitalForm(payload.form, type))
  }
}

/** Identify a form namespace from its key, without trusting the stored payload. */
function keyContext(key: string): { formType?: string; context?: DraftContext } | null {
  if (!key.startsWith(DRAFT_PREFIX)) return null
  const separator = key.indexOf(':', DRAFT_PREFIX.length)
  try {
    const encoded = key.slice(DRAFT_PREFIX.length, separator === -1 ? undefined : separator)
    const parts: unknown = JSON.parse(decodeURIComponent(encoded))
    if (!Array.isArray(parts) || parts[0] !== 'form') return null
    const formType = typeof parts[8] === 'string' ? parts[8] : undefined
    if (parts.length !== 8 && parts.length !== 9) return { formType }
    const context = {
      task: 'form', storeId: parts[1],
      ...(parts[2] !== null ? { businessDate: parts[2] } : { period: { start: parts[3], end: parts[4] } }),
      ...(parts[5] !== null ? { stationId: parts[5] } : {}),
      ...(parts[6] !== null ? { shift: parts[6] } : {}),
      ...(parts[7] !== null ? { recordId: parts[7] } : {}),
      ...(formType !== undefined ? { formType } : {}),
    }
    // Canonical encoding also checks unused day/period slots and extra dimensions.
    return validDraftContext(context) && draftContextKey(context) === encoded
      ? { formType, context } : { formType }
  } catch { return null }
}

/**
 * Read all existing form namespaces only. Other tools' drafts cannot be exposed,
 * a payload cannot move itself into another key/context, and original raw bytes
 * are returned for recovery. No storage writes, removals or server reads occur.
 */
export function listFormDrafts(storage: ReadStorage): FormDraftList {
  const sources: FormDraftSource[] = []
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key) continue
      const identity = keyContext(key)
      if (!identity) continue
      const raw = storage.getItem(key)
      if (raw === null) continue
      const recovery = (reason: UnreadableFormDraftSource['reason']): UnreadableFormDraftSource => ({ state: 'unreadable', key, raw, reason, ...identity })
      if (!identity.context || !identity.context.businessDate) { sources.push(recovery('invalid_payload')); continue }
      if (!isSavedFormType(identity.formType)) { sources.push(recovery('unsupported_form_type')); continue }
      const source = readDraft(key, raw, formDraftPayloadValidator(identity.formType))
      if (source.state === 'unreadable') { sources.push({ ...source, ...identity }); continue }
      const { draft } = source
      const form = draft.payload.form
      if (draftKey(draft) !== key || draftContextKey(draft.context) !== draftContextKey(identity.context)
        || form.date !== draft.context.businessDate
        || isDigitalFormType(identity.formType) && (form as DigitalForm).store !== draft.context.storeId) {
        sources.push(recovery('invalid_payload')); continue
      }
      sources.push({ ...source, formType: identity.formType })
    }
    sources.sort((a, b) => a.state === 'ready' && b.state === 'ready'
      ? b.draft.updatedAt.localeCompare(a.draft.updatedAt) || a.key.localeCompare(b.key)
      : a.state === 'ready' ? -1 : b.state === 'ready' ? 1 : a.key.localeCompare(b.key))
    return { state: 'available', sources }
  } catch { return { state: 'unavailable', sources } }
}

export function formDraftPerson(source: ReadyFormDraftSource): string {
  const form = source.draft.payload.form
  const person = source.formType === 'write-up' ? (form as WriteUpForm).employee
    : (form as DigitalForm).fields[source.formType === 'customer-complaint' ? 'customer' : 'employee']
  return typeof person === 'string' ? person : ''
}

export type FormDraftFilter = { query: string; type: SavedFormType | ''; store: string; from: string; to: string }
export const EMPTY_FORM_DRAFT_FILTER: FormDraftFilter = { query: '', type: '', store: '', from: '', to: '' }
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
export function filterFormDrafts(sources: ReadyFormDraftSource[], filter: FormDraftFilter): ReadyFormDraftSource[] {
  const words = fold(filter.query).split(/\s+/).filter(Boolean)
  return sources.filter(source => {
    const { draft } = source
    const date = draft.context.businessDate!
    if (filter.type && source.formType !== filter.type || filter.store && draft.context.storeId !== filter.store
      || filter.from && date < filter.from || filter.to && date > filter.to) return false
    const text = fold(`${formDraftPerson(source)} ${draft.preparer} ${draft.context.storeId} ${date}`)
    return words.every(word => text.includes(word))
  })
}
