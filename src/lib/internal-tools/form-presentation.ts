import { DIGITAL_FORMS, isDigitalForm, validFormDate, type DigitalForm, type DigitalFormType, type FormField } from '../digital-forms'
import { ACTIONS, VIOLATIONS, type WriteUpForm } from '../writeup-store'
import { isWriteUpDraft } from './writeup-draft'
import type { Message, TranslationKey } from './i18n'
import { formsEnglish } from './i18n/forms-entry'

export type FormValue = { type: 'write-up'; form: WriteUpForm } | { type: DigitalFormType; form: DigitalForm }
export type FormIssue = { field: string; message: Message }
export type PresentationField = { key: string; label: TranslationKey; kind?: FormField['kind']; required: boolean; maxLength: number; options?: readonly { value: string; label: TranslationKey }[]; readOnly?: boolean }
export type PresentationSection = { id: string; title: TranslationKey; fields: PresentationField[]; signature?: boolean }
const key = (suffix: string) => `formsEntry.${suffix}` as TranslationKey

/** Display labels are translations; option values continue to be the original contract values. */
export function formFieldLabel(value: Pick<FormValue, 'type'>, field: string): TranslationKey {
  if (value.type !== 'write-up' && ['date','store','preparedBy'].includes(field)) return key(field)
  const specific = `formsEntry.field.${value.type}.${field}`
  return (Object.hasOwn(formsEnglish, specific) ? specific : `formsEntry.field.${field}`) as TranslationKey
}
export function formOptionLabel(option: string): TranslationKey { return key(`option.${option}`) }

const writeUpSections: { id: string; keys: (keyof WriteUpForm)[]; signature?: boolean }[] = [
  { id: 'writeup-details', keys: ['date', 'employee', 'manager'] },
  { id: 'writeup-actions', keys: ['violations', 'otherSpecify', 'actions'] },
  { id: 'writeup-incident', keys: ['incident', 'incidentCont'] },
  { id: 'writeup-correction', keys: ['expected'] },
  { id: 'writeup-comments', keys: ['employeeComments'] },
  { id: 'writeup-signatures', keys: ['employeeSignature', 'employeeSignedDate', 'managerSignature', 'managerSignedDate'], signature: true },
]
const writeUpAreas = new Set(['incident', 'incidentCont', 'expected', 'employeeComments'])

export function formSections(value: FormValue): PresentationSection[] {
  if (value.type === 'write-up') return writeUpSections.map(section => ({
    id: section.id, title: key(`section.${section.id}`), signature: section.signature,
    fields: section.keys.map(field => ({ key: field, label: formFieldLabel(value, field), required: field === 'date' || field === 'employee',
      kind: field === 'violations' || field === 'actions' ? 'checks' : field === 'date' || field.endsWith('SignedDate') ? 'date' : writeUpAreas.has(field) ? 'textarea' : undefined,
      maxLength: writeUpAreas.has(field) ? 3000 : 60, readOnly: field === 'date',
      options: field === 'violations' ? VIOLATIONS.map(item => ({ value: item.id, label: formOptionLabel(item.id) })) : field === 'actions' ? ACTIONS.map(item => ({ value: item.id, label: formOptionLabel(item.id) })) : undefined,
    })),
  }))
  return DIGITAL_FORMS[value.type].sections.map((section, index) => ({
    id: `${value.type}-${index}`, title: key(`section.${value.type}-${index}`), signature: section.fields.some(field => /Signature|signedDate/.test(field.key)),
    fields: section.fields.map(field => ({ key: field.key, label: formFieldLabel(value, field.key), kind: field.kind, required: !!field.required || field.key === 'employee',
      maxLength: field.kind === 'textarea' ? 3000 : ['employee', 'customer'].includes(field.key) ? 60 : 120,
      options: field.options?.map(option => ({ value: option, label: formOptionLabel(option) })),
    })),
  }))
}

export function formFieldValue(value: FormValue, field: string): string | string[] {
  return value.type === 'write-up' ? value.form[field as keyof WriteUpForm] : value.form.fields[field]
}

/** Completeness mirrors existing field requirements; incomplete drafts still remain recoverable. */
export function formIssues(value: FormValue): FormIssue[] {
  const issues: FormIssue[] = []
  const issue = (field: string, name: string, params?: Record<string, string | number>) => issues.push({ field, message: { key: key(name), ...(params ? { params } : {}) } })
  if (value.type !== 'write-up') {
    if (!validFormDate(value.form.date)) issue('date', 'dateError')
    if (!['CR2', 'CR3'].includes(value.form.store)) issue('store', 'valueError')
    if (typeof value.form.preparedBy !== 'string' || value.form.preparedBy.length > 120) issue('preparedBy', 'lengthError', { max: 120 })
  }
  for (const field of formSections(value).flatMap(section => section.fields)) {
    const raw = formFieldValue(value, field.key)
    if (field.kind === 'checks') {
      if (!Array.isArray(raw) || new Set(raw).size !== raw.length || raw.some(option => !field.options?.some(item => item.value === option))) issue(field.key, 'choiceError')
      continue
    }
    if (typeof raw !== 'string') { issue(field.key, 'valueError'); continue }
    if (field.required && !raw.trim()) { issue(field.key, 'requiredError'); continue }
    if (raw.length > field.maxLength) { issue(field.key, 'lengthError', { max: field.maxLength }); continue }
    if (!raw) continue
    if (field.kind === 'date' && !validFormDate(raw)) issue(field.key, 'dateError')
    else if (field.kind === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) issue(field.key, 'timeError')
    else if (field.kind === 'money' && !/^\d{1,7}(\.\d{1,2})?$/.test(raw)) issue(field.key, 'moneyError')
    else if (field.kind === 'select' && !field.options?.some(option => option.value === raw)) issue(field.key, 'choiceError')
  }
  const valid = value.type === 'write-up' ? isWriteUpDraft(value.form) : isDigitalForm(value.form, value.type, true)
  if (!valid && !issues.length) issue('form', 'formError')
  return issues
}
