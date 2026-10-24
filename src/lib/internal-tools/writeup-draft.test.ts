import assert from 'node:assert/strict'
import test from 'node:test'
import { isWriteUpDraft } from './writeup-draft'
import { draftKey, listDrafts, newDraft, saveDraft, type DraftContext, type DraftStorage } from './drafts'
import { businessDate } from './contracts'
import type { WriteUpForm } from '../writeup-store'

const form = (): WriteUpForm => ({ date: '2026-10-24', employee: 'Ana López', manager: 'Bob', violations: ['attendance'], otherSpecify: '', actions: ['verbal'],
  incident: 'Línea uno\nLínea dos', incidentCont: '', expected: '', employeeComments: '', employeeSignature: '', employeeSignedDate: '', managerSignature: '', managerSignedDate: '' })
const storage = (): DraftStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return { values, get length() { return values.size }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v) }
}

test('write-up draft payloads accept only the form fields', () => {
  assert.ok(isWriteUpDraft(form()))
  assert.equal(isWriteUpDraft({ ...form(), token: 'secret' }), false)
  assert.equal(isWriteUpDraft({ ...form(), violations: ['attendance', 'attendance'] }), false)
  assert.equal(isWriteUpDraft({ ...form(), actions: ['fired'] }), false)
  assert.equal(isWriteUpDraft({ ...form(), incident: 5 }), false)
  const missing: Partial<WriteUpForm> = form(); delete missing.expected
  assert.equal(isWriteUpDraft(missing), false)
  assert.equal(isWriteUpDraft(null), false)
})

test('write-up drafts are scoped by store, date and form type and keep names and narratives as typed', () => {
  const s = storage()
  const context: DraftContext = { task: 'form', formType: 'write-up', storeId: 'CR3', businessDate: businessDate('2026-10-24')! }
  const draft = newDraft(context, 'Manager A', form(), { id: 'writeup-a', now: '2026-10-24T12:00:00.000Z' })
  assert.equal(saveDraft(s, draft, isWriteUpDraft).state, 'saved')
  assert.equal(listDrafts(s, context, isWriteUpDraft).sources.length, 1)
  for (const other of [{ ...context, storeId: 'CR2' as const }, { ...context, businessDate: businessDate('2026-10-23')! }, { ...context, formType: 'customer-complaint' }]) {
    assert.equal(listDrafts(s, other, isWriteUpDraft).sources.length, 0)
  }
  const stored = JSON.parse(s.getItem(draftKey(draft))!)
  assert.equal(stored.payload.employee, 'Ana López')
  assert.equal(stored.payload.incident, 'Línea uno\nLínea dos')
  assert.doesNotMatch(s.getItem(draftKey(draft))!, /token|Bearer/i)
})
