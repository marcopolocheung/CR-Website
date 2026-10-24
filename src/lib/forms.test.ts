import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { BLANK_FORMS, NO_FILTER, blankFormHref, filterSavedForms, isFiltered, type SavedFormFilter, type SavedFormRow } from './forms'

const DIR = new URL('../../public/internal/forms/', import.meta.url)
// xlsx and docx are zip containers; PDFs start with %PDF.
const SIGNATURE: Record<string, string> = { xlsx: '504b0304', docx: '504b0304', pdf: '25504446' }

test('every blank form in the catalog exists with its original format', () => {
  assert.equal(BLANK_FORMS.length, 11)
  assert.deepEqual(BLANK_FORMS.map(f => f.file).sort(), readdirSync(DIR).sort())
  for (const { file } of BLANK_FORMS) {
    const bytes = readFileSync(new URL(file, DIR))
    assert.equal(bytes.subarray(0, 4).toString('hex'), SIGNATURE[file.split('.').pop()!], file)
    assert.ok(bytes.length > 1000, file)
  }
})

test('blank form links respect the deploy base path', () => {
  assert.equal(blankFormHref('', 'new-hire.pdf'), '/internal/forms/new-hire.pdf')
  assert.equal(blankFormHref('/chinarose', 'new-hire.pdf'), '/chinarose/internal/forms/new-hire.pdf')
})

test('saved form search filters by employee, label, type and date range without reordering', () => {
  const rows: SavedFormRow[] = [
    { type: 'write-up', id: 'a', date: '2026-10-10', employee: 'Dana', label: '' },
    { type: 'write-up', id: 'b', date: '2026-10-09', employee: 'Ana López', label: 'Final warning' },
    { type: 'write-up', id: 'c', date: '2026-10-09', employee: 'Carl', label: '' },
    { type: 'write-up', id: 'd', date: '2026-01-05', employee: 'Ana López', label: 'First warning' },
  ]
  const ids = (filter: Partial<SavedFormFilter>) => filterSavedForms(rows, { ...NO_FILTER, ...filter }).map(r => r.id)
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'])
  assert.deepEqual(ids({ query: 'ana lopez' }), ['b', 'd'])
  assert.deepEqual(ids({ query: '  WARNING final ' }), ['b'])
  assert.deepEqual(ids({ from: '2026-10-09' }), ['a', 'b', 'c'])
  assert.deepEqual(ids({ to: '2026-10-09' }), ['b', 'c', 'd'])
  assert.deepEqual(ids({ from: '2026-10-09', to: '2026-10-09', query: 'carl' }), ['c'])
  assert.deepEqual(ids({ type: 'write-up', query: 'nobody' }), [])
  assert.equal(isFiltered(NO_FILTER), false)
  assert.equal(isFiltered({ ...NO_FILTER, to: '2026-10-09' }), true)
})
