import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyDigitalForm, DIGITAL_FORM_TYPES } from '../digital-forms'
import type { WriteUpForm } from '../writeup-store'
import { businessDate } from './contracts'
import { DRAFT_PREFIX, draftContextKey, draftKey, newDraft, type DraftContext } from './drafts'
import { EMPTY_FORM_DRAFT_FILTER, filterFormDrafts, formDraftPayloadValidator, formDraftPerson, listFormDrafts, type FormDraftPayload, type ReadyFormDraftSource } from './form-drafts'
import type { SavedFormType } from '../forms'

const DATE = '2026-11-23'
const NOW = '2026-11-23T12:00:00.000Z'
const writeup = (): WriteUpForm => ({ date: DATE, employee: 'Ana López', manager: 'Bob', violations: ['attendance'], otherSpecify: '', actions: ['verbal'],
  incident: 'Línea uno\nLine two', incidentCont: '', expected: '', employeeComments: '', employeeSignature: '', employeeSignedDate: '', managerSignature: '', managerSignedDate: '' })
function fixture(type: SavedFormType = 'write-up', id = 'original', savedId: string | null = null) {
  const context: DraftContext = { task: 'form', formType: type, storeId: 'CR3', businessDate: businessDate(DATE)! }
  const form = type === 'write-up' ? writeup() : { ...emptyDigitalForm(type, DATE), preparedBy: 'Manager A' }
  return newDraft<FormDraftPayload>(context, 'Manager A', { form, savedId }, { id, now: NOW })
}
function storage(entries: [string, string][] = []) {
  const values = new Map(entries), reads: string[] = []
  return { values, reads, get length() { return values.size }, key(index: number) { return [...values.keys()][index] ?? null },
    getItem(key: string) { reads.push(key); return values.get(key) ?? null }, setItem() { assert.fail('Discovery must not write storage') } }
}
const ready = (value: ReturnType<typeof listFormDrafts>): ReadyFormDraftSource[] => value.sources.filter((source): source is ReadyFormDraftSource => source.state === 'ready')

test('discovery finds all five existing form types in update order and preserves each raw source', () => {
  const drafts = [fixture(), ...DIGITAL_FORM_TYPES.map(type => fixture(type, type))]
  drafts[1].updatedAt = '2026-11-23T13:00:00.000Z'
  const device = storage(drafts.map(draft => [draftKey(draft), JSON.stringify(draft)]))
  const before = [...device.values], result = listFormDrafts(device), valid = ready(result)
  assert.equal(result.state, 'available')
  assert.equal(valid.length, 5)
  assert.equal(valid[0].formType, DIGITAL_FORM_TYPES[0])
  assert.equal(new Set(valid.map(source => source.formType)).size, 5)
  assert.deepEqual([...device.values], before)
  assert.equal((valid.find(source => source.formType === 'write-up')!.draft.payload.form as WriteUpForm).employee, 'Ana López')
  assert.equal(valid.find(source => source.formType === 'write-up')!.raw, JSON.stringify(drafts[0]))
})

test('only keys identifying form namespaces are read, even when another task contains form-shaped payloads', () => {
  const form = fixture(), cash = { ...fixture('write-up', 'cash'), context: { task: 'cash-out' as const, storeId: 'CR3' as const, businessDate: businessDate(DATE)! } }
  const device = storage([[draftKey(cash), JSON.stringify(form)], ['unrelated', JSON.stringify(form)], [draftKey(form), JSON.stringify(form)], [`${DRAFT_PREFIX}not-an-encoded-context:other`, '{broken']])
  assert.equal(listFormDrafts(device).sources.length, 1)
  assert.deepEqual(device.reads, [draftKey(form)])
})

test('canonical key identity, form type, date and store must agree with the validated envelope and fields', () => {
  const base = fixture(), digital = fixture('injury-report', 'injury')
  const cases: [string, string][] = [
    [draftKey({ ...base, id: 'renamed' }), JSON.stringify(base)],
    [`${DRAFT_PREFIX}${draftContextKey(base.context)}`, JSON.stringify(base)],
    [draftKey(base), JSON.stringify({ ...base, context: { ...base.context, storeId: 'CR2' } })],
    [draftKey(base), JSON.stringify({ ...base, context: { ...base.context, formType: 'injury-report' } })],
    [draftKey(base), JSON.stringify({ ...base, payload: { ...base.payload, form: { ...writeup(), date: '2026-11-22' } } })],
    [draftKey(digital), JSON.stringify({ ...digital, payload: { ...digital.payload, form: { ...digital.payload.form, store: 'CR2' } } })],
    [`${DRAFT_PREFIX}${draftContextKey(base.context).replace('%5B', '%5b')}:original`, JSON.stringify(base)],
  ]
  for (const [key, raw] of cases) {
    const device = storage([[key, raw]]), result = listFormDrafts(device)
    assert.equal(result.sources.length, 1)
    assert.equal(result.sources[0].state, 'unreadable', key)
    assert.equal(result.sources[0].raw, raw)
    assert.equal(device.values.get(key), raw)
  }
})

test('corrupt bytes, future schemas, unknown form types and invalid payloads stay downloadable without inference', () => {
  const base = fixture(), unknown = { ...base.context, formType: 'future-form' }
  const raws = ['{broken form bytes', JSON.stringify({ ...base, schemaVersion: 99 }), JSON.stringify({ ...base, payload: { ...base.payload, token: 'never-accept' } })]
  for (const raw of raws) {
    const key = draftKey(base), result = listFormDrafts(storage([[key, raw]]))
    assert.equal(result.sources[0].state, 'unreadable')
    assert.equal(result.sources[0].raw, raw)
  }
  const key = `${DRAFT_PREFIX}${draftContextKey(unknown)}:future`
  const result = listFormDrafts(storage([[key, '{future unknown format']]))
  assert.equal(result.sources[0].state, 'unreadable')
  assert.equal(result.sources[0].formType, 'future-form')
  if (result.sources[0].state === 'unreadable') assert.equal(result.sources[0].reason, 'unsupported_form_type')
})

test('schema zero is upgraded in memory only and resuming a saved source keeps its original and savedId', () => {
  const original = fixture('write-up', 'original', 'saved00001')
  const { sourceId, createdAt, ...legacy } = original
  const raw = JSON.stringify({ ...legacy, schemaVersion: 0 }), key = draftKey(original), device = storage([[key, raw]])
  const source = ready(listFormDrafts(device))[0]
  assert.equal(source.upgraded, true)
  assert.equal(source.draft.schemaVersion, 1)
  assert.equal(source.draft.payload.savedId, 'saved00001')
  assert.equal(device.values.get(key), raw)
  const copy = newDraft(source.draft.context, 'Manager B', source.draft.payload, { source: source.draft, id: 'copy', now: '2026-11-23T14:00:00.000Z' })
  assert.equal(copy.sourceId, original.id)
  assert.equal(copy.payload.savedId, 'saved00001')
  assert.equal(copy.preparer, 'Manager B')
  assert.notEqual(draftKey(copy), key)
  assert.equal(device.values.get(key), raw)
})

test('storage denial is different from empty and preserves readable partial sources', () => {
  assert.deepEqual(listFormDrafts(storage()), { state: 'available', sources: [] })
  assert.deepEqual(listFormDrafts({ get length(): number { throw new Error('Denied') }, key() { return null }, getItem() { return null } }), { state: 'unavailable', sources: [] })
  const base = fixture(), sourceKey = draftKey(base), unknown = `${DRAFT_PREFIX}${draftContextKey({ ...base.context, formType: 'future' })}:unknown`
  const device = storage([[sourceKey, JSON.stringify(base)], [unknown, '{}']])
  const result = listFormDrafts({ ...device, getItem(key) { if (key === unknown) throw new Error('Denied midway'); return device.getItem(key) } })
  assert.equal(result.state, 'unavailable')
  assert.equal(ready(result).length, 1)
})

test('draft filters combine exact context with accent-insensitive person/preparer search and retain source order', () => {
  const a = fixture(), b = fixture('write-up', 'another')
  b.context.storeId = 'CR2'; b.preparer = 'Mánager B'; b.updatedAt = '2026-11-23T14:00:00.000Z'
  const sources = ready(listFormDrafts(storage([[draftKey(a), JSON.stringify(a)], [draftKey(b), JSON.stringify(b)]])))
  assert.equal(formDraftPerson(sources[0]), 'Ana López')
  assert.deepEqual(filterFormDrafts(sources, { ...EMPTY_FORM_DRAFT_FILTER, query: 'ana lopez manager b', store: 'CR2', type: 'write-up', from: DATE, to: DATE }), [sources[0]])
  assert.deepEqual(filterFormDrafts(sources, { ...EMPTY_FORM_DRAFT_FILTER, from: '2026-11-24' }), [])
  assert.deepEqual(filterFormDrafts(sources, { ...EMPTY_FORM_DRAFT_FILTER, type: 'customer-complaint' }), [])
  assert.deepEqual(filterFormDrafts(sources, EMPTY_FORM_DRAFT_FILTER), sources)
})

test('payload validator preserves incomplete fields and rejects accidental credentials and damaged save identity', () => {
  const payload = fixture('pay-rate-increase').payload
  assert.equal(formDraftPayloadValidator('pay-rate-increase')(payload), true)
  assert.equal(formDraftPayloadValidator('write-up')(payload), false)
  for (const value of [{ ...payload, savedId: 'not/a/server/id' }, { ...payload, secret: 'bad' }, { ...payload, form: { ...payload.form, token: 'bad' } }]) {
    assert.equal(formDraftPayloadValidator('pay-rate-increase')(value), false)
  }
})
