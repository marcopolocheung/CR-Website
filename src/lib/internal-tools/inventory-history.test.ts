import assert from 'node:assert/strict'
import test from 'node:test'
import type { InventoryCounts, InventorySheet } from '../inventory'
import type { InventoryDay } from '../inventory-store'
import { StoreUnavailableError } from '../schedule-store'
import { inventoryHistoryWindow, inventoryReportCatalog, sameInventoryFields, savedInventoryCatalog, validatedInventoryHistory } from './inventory-history'
import { inventoryProgressKey, type InventoryProgress } from './inventory-progress'

const catalog: InventorySheet[] = [{ id: 'shelf', title: 'Shared labels', useLabel: 'Use', showSup: true,
  items: [{ id: 'stable-id', name: 'Current name', sup: 'D/L', use: '1/2', gray: true },
    { id: 'replacement-id', name: 'Same name', sup: 'L', use: '2', gray: false }] }]
const cell = (inv: string, order = '', done = false) => ({ inv, order, done })
const day = (date: string, counts: InventoryCounts = {}): InventoryDay => ({ date, counts, updatedAt: `${date}T15:20:30.000Z` })
const envelope = (): InventoryProgress => ({ schemaVersion: 1, storeId: 'CR3', date: '2026-11-23', updatedAt: '2026-11-23T15:20:30.000Z',
  catalogRevision: 7, catalog: [{ ...structuredClone(catalog[0]), title: 'Captured labels', items: [
    { ...catalog[0].items[0], name: 'Earlier name' }, { id: 'removed-id', name: 'Same name', sup: 'B', use: '1', gray: false },
  ] }], counts: { 'stable-id': cell('unsaved device text', '9', true) }, skipped: ['removed-id'], sectionId: 'shelf' })
function storage(raw: string | null) {
  const reads: string[] = []
  return { reads, getItem(key: string) { reads.push(key); return raw }, setItem() { assert.fail('History may not write device bytes') } }
}

test('history windows include fourteen calendar dates across month, year and leap-day boundaries', () => {
  assert.deepEqual(inventoryHistoryWindow('2026-11-23'), { from: '2026-11-10', to: '2026-11-23' })
  assert.deepEqual(inventoryHistoryWindow('2027-01-04'), { from: '2026-12-22', to: '2027-01-04' })
  assert.deepEqual(inventoryHistoryWindow('2024-03-03'), { from: '2024-02-19', to: '2024-03-03' })
  assert.throws(() => inventoryHistoryWindow('2026-02-29'), StoreUnavailableError)
})

test('bounded history accepts gaps, empty windows, both boundaries and newest-first ordering', () => {
  const source = [day('2026-11-10', { first: cell('0') }), day('2026-11-23', { last: cell('3B/2T', '1 1/2', true) }), day('2026-11-18')]
  const result = validatedInventoryHistory(source, '2026-11-23')
  assert.deepEqual(result.map(record => record.date), ['2026-11-23', '2026-11-18', '2026-11-10'])
  assert.equal(result[0].counts.last.inv, '3B/2T')
  assert.equal(result[0].counts.last.order, '1 1/2')
  assert.equal(result[0].counts.last.done, true)
  result[0].counts.last.inv = 'edited returned object'
  assert.equal(source[1].counts.last.inv, '3B/2T')
  assert.deepEqual(validatedInventoryHistory([], '2026-11-23'), [])
})

test('malformed, duplicate and out-of-window history cannot be accepted as a replacement', () => {
  for (const value of [null, {}, [day('2026-11-09')], [day('2026-11-24')], [day('2026-11-23'), day('2026-11-23')],
    [day('2026-02-30')], [{ ...day('2026-11-23'), updatedAt: '' }], [{ ...day('2026-11-23'), updatedAt: 123 }],
    [{ ...day('2026-11-23'), counts: { x: { inv: 0, order: '' } } }], [{ ...day('2026-11-23'), counts: { x: { inv: '', order: '', skipped: true } } }],
    Array.from({ length: 15 }, () => day('2026-11-23'))]) {
    assert.throws(() => validatedInventoryHistory(value, '2026-11-23'), StoreUnavailableError)
  }
})

test('saved-day label resolution reads only a strict matching-date device catalog, never unsaved count fields', () => {
  const raw = JSON.stringify(envelope()), device = storage(raw)
  const resolved = savedInventoryCatalog(device, '2026-11-23', catalog)
  assert.deepEqual(device.reads, [inventoryProgressKey('2026-11-23')])
  assert.equal(resolved.source, 'device')
  assert.equal(resolved.revision, 7)
  assert.equal(resolved.catalog[0].items[0].name, 'Earlier name')
  assert.deepEqual(Object.keys(resolved).sort(), ['catalog', 'revision', 'source'])
  const saved = day('2026-11-23', { 'stable-id': cell('0', '1/2', false), 'removed-id': cell('', '3B/2T') })
  const report = inventoryReportCatalog(resolved.catalog, [saved.counts])
  assert.deepEqual(report[0].items.map(item => item.id), ['stable-id', 'removed-id'])
  assert.equal(saved.counts['stable-id'].inv, '0')
  assert.equal(saved.counts['stable-id'].done, false)
  assert.equal(saved.counts['removed-id'].inv, '')
  assert.equal(device.getItem('unchanged bytes'), raw)
})

test('missing, denied, mismatched and unsupported device metadata falls back to current labels without changing bytes', () => {
  const original = envelope()
  for (const raw of [null, '{broken recovery bytes', JSON.stringify({ ...original, date: '2026-11-22' }),
    JSON.stringify({ ...original, schemaVersion: 99 }), JSON.stringify({ ...original, storeId: 'CR2' }),
    JSON.stringify({ ...original, catalog: [{ ...original.catalog[0], items: [original.catalog[0].items[0], original.catalog[0].items[0]] }] }),
    JSON.stringify({ ...original, counts: { x: { inv: 1, order: '' } } }),
    JSON.stringify({ ...original, navigationView: 'history' })]) {
    const device = storage(raw), result = savedInventoryCatalog(device, '2026-11-23', catalog)
    assert.equal(result.source, 'current')
    assert.equal(result.revision, null)
    assert.deepEqual(result.catalog, catalog)
    assert.equal(device.getItem('unchanged bytes'), raw)
  }
  assert.equal(savedInventoryCatalog({ getItem() { throw new Error('Denied') } }, '2026-11-23', catalog).source, 'current')
  assert.equal(savedInventoryCatalog(null, '2026-11-23', catalog).source, 'current')
})

test('report identity unions all columns by ID and preserves unknown raw IDs rather than matching names', () => {
  const current = structuredClone(catalog)
  const saved = { 'removed-id': cell('3B/2T', '1/2', true), 'stable-id': cell('0') }
  const preceding = { 'another-removed-id': cell('', '0'), 'removed-id': cell('1') }
  const result = inventoryReportCatalog(current, [saved, preceding], 'Unknown IDs')
  assert.deepEqual(result.flatMap(sheet => sheet.items.map(item => item.id)), ['stable-id', 'replacement-id', 'removed-id', 'another-removed-id'])
  assert.equal(result[1].title, 'Unknown IDs')
  assert.deepEqual(result[1].items.map(item => [item.name, item.sup, item.use]), [['removed-id', '', ''], ['another-removed-id', '', '']])
  assert.equal(result[0].items[1].name, 'Same name')
  assert.equal(saved['removed-id'].inv, '3B/2T')
  result[0].items[0].name = 'Report-only mutation'
  assert.equal(current[0].items[0].name, 'Current name')
})

test('unknown-ID sheet never collides with an existing catalog section and excludes no raw ID', () => {
  const source = [{ ...catalog[0], id: 'inventory-unknown-ids' }, { ...catalog[0], id: 'inventory-unknown-ids-2', items: [] }]
  const values: InventoryCounts = JSON.parse('{"__proto__":{"inv":"raw value","order":"0"},"constructor":{"inv":"","order":"1/2"}}')
  const report = inventoryReportCatalog(source, [values])
  assert.equal(report[2].id, 'inventory-unknown-ids-3')
  assert.deepEqual(report[2].items.map(item => item.id), ['__proto__', 'constructor'])
  assert.deepEqual(inventoryReportCatalog([], []), [])
})

test('saved-field equality handles the service unchecked normalization and object key ordering', () => {
  const working = { a: cell('0', '1/2', false), b: cell('3B/2T', '', true), empty: cell('') }
  const saved = { empty: { inv: '', order: '' }, b: { order: '', done: true, inv: '3B/2T' }, a: { order: '1/2', inv: '0' } }
  assert.equal(sameInventoryFields(working, saved), true)
  assert.equal(sameInventoryFields(saved, working), true)
  assert.equal(sameInventoryFields({}, {}), true)
  assert.equal(sameInventoryFields({ a: cell('0') }, { a: { inv: '0', order: '', done: true } }), false)
})

test('saved-field equality retains raw values, zero versus blank and exact own identity keys', () => {
  const values = { a: cell('0', '1/2'), b: cell('3B/2T', '0') }
  const variations: InventoryCounts[] = [
    { ...values, a: cell('', '1/2') },
    { ...values, a: cell('0', '0.5') },
    { ...values, a: cell('0', '1/2 ') },
    { ...values, b: cell('3B / 2T', '0') },
    { ...values, b: cell('3B/2T', '') },
    { ...values, extra: cell('') },
    { a: values.a },
    { a: values.a, replacement: values.b },
  ]
  for (const changed of variations) assert.equal(sameInventoryFields(values, changed), false)
  const own = JSON.parse('{"constructor":{"inv":"0","order":""}}') as InventoryCounts
  assert.equal(sameInventoryFields(own, own), true)
  const inherited = Object.create({ constructor: cell('0') }) as InventoryCounts
  assert.equal(sameInventoryFields(own, inherited), false)
})
