import assert from 'node:assert/strict'
import { test } from 'node:test'
import { salesFixtures, hoursRecords } from '../../../scripts/fixtures/imports'
import { reviewSales, type SalesSources, type SalesForm } from './sales-review'
import { isImportSnapshot, snapshotContext, snapshotMatchesContext, type ImportSnapshot } from './import-snapshot'
import { workbookOutput, workbookBytes, isWorkbookOutput } from './workbook-output'
import { listDrafts, newDraft, readDraft, saveDraft, draftKey } from '../internal-tools/drafts'
import { businessDate } from '../internal-tools/contracts'
import { reviewHours } from './hours-review'
import { validateHoursRows } from './validation'

const form: SalesForm = { firstName: 'Synthetic', lastName: 'Preparer', day: 'TUE', date: '2026-10-20', location: 'CHINA ROSE #3 - 7046 W MILITARY DR', amDeposit: '0', pmDeposit: '', amOverShort: '', pmOverShort: '' }
function sales(): ImportSnapshot {
  const sources = Object.fromEntries(Object.entries(salesFixtures()).map(([slot, workbook]) => [slot, { workbook, name: slot + '.xlsx' }])) as SalesSources
  return { version: 1, kind: 'sales', review: reviewSales(sources, form), output: null }
}
function hours(): ImportSnapshot {
  return { version: 1, kind: 'hours', sourceName: 'original.csv', rows: validateHoursRows(hoursRecords).value!, metadata: { location: form.location, startDate: '2026-10-01', endDate: '2026-10-31', preparer: 'Synthetic Preparer' }, output: null }
}
function storage() {
  const map = new Map<string,string>()
  return { map, get length() { return map.size }, key: (index: number) => [...map.keys()][index] ?? null, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key,value) } }
}

test('sales/hours recovery snapshots preserve values, source names and null/zero while excluding File objects', () => {
  for (const snapshot of [sales(), hours()]) {
    assert.equal(isImportSnapshot(snapshot), true)
    assert.equal(isImportSnapshot(JSON.parse(JSON.stringify(snapshot))), true)
    assert.equal(snapshotMatchesContext(snapshot, snapshotContext(snapshot)), true)
  }
  const snapshot = sales()
  if (snapshot.kind !== 'sales') throw new Error('fixture')
  assert.equal(snapshot.review.figures.find(figure => figure.cell === 'C4')?.value, 0)
  assert.equal(snapshot.review.figures.find(figure => figure.cell === 'C5')?.value, null)
  assert.equal(snapshot.review.sources[0].filename, 'general.xlsx')
})

test('malformed, unsupported, credential-bearing and mismatched figure/context payloads are not applied', () => {
  const snapshot = sales()
  assert.equal(isImportSnapshot({ ...snapshot, version: 2 }), false)
  assert.equal(isImportSnapshot({ ...snapshot, token: 'do-not-persist' }), false)
  if (snapshot.kind !== 'sales') throw new Error('fixture')
  const changed = structuredClone(snapshot)
  changed.review.figures[0].value = 1
  assert.equal(isImportSnapshot(changed), false)
  assert.equal(isImportSnapshot({ ...snapshot, review: { ...snapshot.review, form: { ...snapshot.review.form, location: 'arbitrary label' } } }), false)
  const invalidHours = hours()
  if (invalidHours.kind !== 'hours') throw new Error('fixture')
  invalidHours.rows[0]['Employee External Id'] = ''
  assert.equal(isImportSnapshot(invalidHours), true) // retain an unresolved row for review
  assert.equal(reviewHours(invalidHours.rows, invalidHours.metadata.startDate, invalidHours.metadata.endDate).blocked, true)
})

test('task/store/day/period recovery keys remain isolated even if the stored payload has a conflicting context', () => {
  const snapshot = sales(), context = snapshotContext(snapshot)
  assert.equal(snapshotMatchesContext(snapshot, { ...context, storeId: 'CR2' }), false)
  assert.equal(snapshotMatchesContext(snapshot, { task: 'sales-import', storeId: 'CR3', businessDate: businessDate('2026-10-21')! }), false)
  assert.equal(snapshotMatchesContext(snapshot, snapshotContext(hours())), false)
  const store = storage()
  const draft = newDraft({ ...context, storeId: 'CR2' }, 'Synthetic', snapshot)
  assert.equal(saveDraft(store,draft,isImportSnapshot).state, 'saved')
  const list = listDrafts(store,draft.context,(value): value is ImportSnapshot => snapshotMatchesContext(value,draft.context))
  assert.equal(list.sources[0].state,'unreadable')
  assert.equal(store.getItem(draftKey(draft)), JSON.stringify(draft))
})

test('independent resumed copies preserve original bytes and lineage without overwriting another editor', () => {
  const store = storage(), snapshot = sales(), context = snapshotContext(snapshot)
  const original = newDraft(context,'Original preparer',snapshot)
  assert.equal(saveDraft(store,original,isImportSnapshot).state,'saved')
  const raw = store.getItem(draftKey(original))!
  const first = newDraft(context,'Editor one',snapshot,{ source: original })
  const second = newDraft(context,'Editor two',snapshot,{ source: original })
  assert.notEqual(first.id,second.id)
  assert.equal(first.sourceId,original.id)
  assert.equal(second.sourceId,original.id)
  assert.equal(saveDraft(store,first,isImportSnapshot).state,'saved')
  assert.equal(saveDraft(store,second,isImportSnapshot).state,'saved')
  assert.equal(store.getItem(draftKey(original)),raw)
  assert.equal(listDrafts(store,context,isImportSnapshot).sources.length,3)
})

test('quota/read denial leaves the working snapshot and prior recoverable copy intact', () => {
  const store = storage(), snapshot = hours(), context = snapshotContext(snapshot)
  const original = newDraft(context,'Original',snapshot)
  saveDraft(store,original,isImportSnapshot)
  const raw = store.getItem(draftKey(original))
  const next = newDraft(context,'Next',snapshot,{source:original})
  const denied = { ...store, setItem: () => { throw new Error('quota') } }
  assert.deepEqual(saveDraft(denied,next,isImportSnapshot),{state:'failed',reason:'storage_unavailable'})
  assert.equal(store.getItem(draftKey(original)),raw)
  assert.equal(isImportSnapshot(snapshot),true)
  assert.equal(listDrafts({ ...store, getItem: () => { throw new Error('read denied') } },context,isImportSnapshot).state,'unavailable')
})

test('corrupt/future sources remain downloadable byte-for-byte rather than overwritten', () => {
  const snapshot = sales(), draft = newDraft(snapshotContext(snapshot),'Synthetic',snapshot)
  for (const raw of ['{corrupt',JSON.stringify({...draft,schemaVersion:99}),JSON.stringify({...draft,payload:{...snapshot,version:99}})]) {
    const result = readDraft(draftKey(draft),raw,isImportSnapshot)
    assert.equal(result.state,'unreadable')
    assert.equal(result.raw,raw)
  }
})

test('generated output survives serialization and repeated download decoding with identical bytes/hash', async () => {
  const bytes = Uint8Array.from({length:20000},(_,index) => index % 256)
  const output = await workbookOutput('26-1020_CR3_Daily_Sales_Report.xlsx',bytes)
  assert.equal(isWorkbookOutput(output),true)
  assert.deepEqual(await workbookBytes(output),bytes)
  assert.deepEqual(await workbookBytes(JSON.parse(JSON.stringify(output))),bytes)
  const snapshot = sales();snapshot.output = output
  assert.equal(isImportSnapshot(snapshot),true)
  const restored = JSON.parse(JSON.stringify(snapshot)) as ImportSnapshot
  assert.deepEqual(await workbookBytes(restored.output!),bytes)
  assert.equal(restored.output?.sha256,output.sha256)
})

test('damaged output, wrong context filenames and unsafe download filenames are rejected', async () => {
  const output = await workbookOutput('26-1020_CR3_Daily_Sales_Report.xlsx',new Uint8Array([80,75,3,4,5]))
  await assert.rejects(workbookBytes({...output,base64:'AAAA'}),/checksum/)
  await assert.rejects(workbookOutput('../bad.exe',new Uint8Array([1])),/filename/)
  assert.equal(isWorkbookOutput({...output,filename:'bad.exe'}),false)
  const snapshot = sales();snapshot.output = {...output,filename:'26-1020_CR2_Daily_Sales_Report.xlsx'}
  assert.equal(isImportSnapshot(snapshot),false)
})
