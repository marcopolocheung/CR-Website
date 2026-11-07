import assert from 'node:assert/strict'
import test from 'node:test'
import { DIGITAL_FORM_TYPES, digitalFields, emptyDigitalForm, isDigitalForm, validFormDate } from './digital-forms'
import { NO_FILTER, filterSavedForms, type SavedFormRow } from './forms'

test('draft contracts reject unknown fields, credentials, and invalid checkboxes while allowing partial typing', () => {
  for (const type of DIGITAL_FORM_TYPES) {
    const form = emptyDigitalForm(type, '2026-11-07')
    assert.ok(isDigitalForm(form, type))
    assert.equal(isDigitalForm({ ...form, token: 'synthetic-secret' }, type), false)
    assert.equal(isDigitalForm({ ...form, fields: { ...form.fields, ssn: 'synthetic' } }, type), false)
    assert.equal(isDigitalForm({ ...form, store: 'unknown' }, type), false)
    const { [digitalFields(type)[0].key]: removed, ...missing } = form.fields
    assert.equal(isDigitalForm({ ...form, fields: missing }, type), false)
  }
  const complaint = emptyDigitalForm('customer-complaint', '2026-11-07')
  assert.equal(isDigitalForm({ ...complaint, fields: { ...complaint.fields, quality: ['Rice cold', 'Rice cold'] } }, 'customer-complaint'), false)
  assert.equal(isDigitalForm({ ...complaint, fields: { ...complaint.fields, service: ['Unknown'] } }, 'customer-complaint'), false)
  const rate = emptyDigitalForm('pay-rate-increase', '2026-11-07')
  Object.assign(rate.fields, { employee: 'Ana', presentRate: '15', proposedRate: '16.', effectiveDate: '2026-11-' })
  assert.ok(isDigitalForm(rate, 'pay-rate-increase'))
  assert.equal(isDigitalForm(rate, 'pay-rate-increase', true), false)
  Object.assign(rate.fields, { proposedRate: '16.50', effectiveDate: '2026-11-14' })
  assert.ok(isDigitalForm(rate, 'pay-rate-increase', true))
})

test('calendar dates reject rollovers and accept leap days', () => {
  assert.ok(validFormDate('2028-02-29'))
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', 'tomorrow', '2026-1-01']) assert.equal(validFormDate(date), false)
})

test('mixed saved-form lists search names, stores and labels and filter all five types', () => {
  const rows: SavedFormRow[] = [
    { id: 'a', type: 'write-up', date: '2026-11-07', employee: 'Ana López', label: 'Attendance' },
    ...DIGITAL_FORM_TYPES.map((type, index) => ({ id: String(index), type, date: '2026-11-06', employee: 'Ana López', store: 'CR2', label: 'Follow-up' })),
  ]
  assert.equal(filterSavedForms(rows, { ...NO_FILTER, query: 'ana lopez cr2 follow' }).length, 4)
  for (const row of rows) assert.deepEqual(filterSavedForms(rows, { ...NO_FILTER, type: row.type }), [row])
})
