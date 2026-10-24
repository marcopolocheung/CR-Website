import { ACTIONS, VIOLATIONS, type WriteUpForm } from '../writeup-store'

const TEXT_KEYS = ['date', 'employee', 'manager', 'otherSpecify', 'incident', 'incidentCont', 'expected', 'employeeComments',
  'employeeSignature', 'employeeSignedDate', 'managerSignature', 'managerSignedDate'] as const
const subset = (value: unknown, allowed: readonly { id: string }[]) =>
  Array.isArray(value) && new Set(value).size === value.length && value.every(id => allowed.some(a => a.id === id))

/** Exactly the write-up form fields, nothing else, so no credential or stray object can ride along in a draft. */
export function isWriteUpDraft(value: unknown): value is WriteUpForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const form = value as Record<string, unknown>
  const keys = [...TEXT_KEYS, 'violations', 'actions']
  return Object.keys(form).length === keys.length && keys.every(k => Object.hasOwn(form, k))
    && TEXT_KEYS.every(k => typeof form[k] === 'string' && (form[k] as string).length <= 3000)
    && subset(form.violations, VIOLATIONS) && subset(form.actions, ACTIONS)
}
