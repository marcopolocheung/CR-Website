import test from 'node:test'
import assert from 'node:assert/strict'
import { newDraft, saveDraft, readDraft, listDrafts, draftKey, draftContextKey, type DraftStorage, type DraftContext } from './drafts'
import { businessDate } from './contracts'
import { isCashoutDraftSheet, type CashoutDraftSheet } from './cashout-draft'
import { DENOMINATIONS } from '../cashout'
class MemoryStorage implements DraftStorage {
  values = new Map<string,string>()
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key,value) }
}
const context: DraftContext = { task: 'cash-out', storeId: 'CR3', businessDate: businessDate('2026-10-24')! }
const now = '2026-10-24T12:00:00.000Z'
const sheet = (): CashoutDraftSheet => ({ am: [{ name: 'Nombre original', counts: DENOMINATIONS.map(() => 0), toast: 'invalid input retained' }], pm: [], zReport: '' })
const make = (id: string, c: DraftContext = context) => newDraft(c, 'Preparer label', sheet(), { id, now })

test('complete context dimensions isolate drafts; store/date/task/station/shift/record are independent', () => {
  const variants: DraftContext[] = [context, { ...context, storeId: 'CR2' }, { ...context, businessDate: businessDate('2026-10-23')! }, { ...context, task: 'form' }, { ...context, stationId: 'CR3-kitchen' }, { ...context, shift: 'am' }, { ...context, recordId: 'record-1' }, { task: 'hours-import', storeId: 'CR3', period: { start: businessDate('2026-10-01')!, end: businessDate('2026-10-15')! } }]
  assert.equal(new Set(variants.map(draftContextKey)).size, variants.length)
  const storage = new MemoryStorage()
  for (const [i,c] of variants.entries()) assert.equal(saveDraft(storage, make(`fixture-${i}`, c), isCashoutDraftSheet).state, 'saved')
  for (const c of variants) assert.equal(listDrafts(storage,c,isCashoutDraftSheet).sources.length,1)
  assert.throws(() => draftContextKey({ ...context, stationId: 'CR2-kitchen' }))
})
test('resuming forks into a new independent ID and preserves original source, preparer and values', () => {
  const storage = new MemoryStorage()
  const original = make('original')
  saveDraft(storage,original,isCashoutDraftSheet)
  const raw = storage.getItem(draftKey(original))!
  const resumed = newDraft(context,'Second preparer',original.payload,{ source: original, id:'working-copy', now })
  resumed.payload.am[0].name='Newer edit'
  assert.equal(original.payload.am[0].name,'Nombre original')
  assert.equal(resumed.sourceId, original.id)
  assert.equal(saveDraft(storage,resumed,isCashoutDraftSheet).state,'saved')
  assert.equal(storage.getItem(draftKey(original)),raw)
  assert.equal(listDrafts(storage,context,isCashoutDraftSheet).sources.length,2)
})
test('corrupt/future payloads remain readable and cannot be overwritten; no cleanup/disposal is introduced', () => {
  const storage = new MemoryStorage()
  const draft = make('corrupt')
  const key = draftKey(draft)
  storage.setItem(key, '{readable original broken json')
  const before = storage.getItem(key)
  assert.equal(listDrafts(storage,context,isCashoutDraftSheet).sources[0].state,'unreadable')
  assert.equal(saveDraft(storage,draft,isCashoutDraftSheet).state,'failed')
  assert.equal(storage.getItem(key),before)
  const future = JSON.stringify({ ...draft, schemaVersion: 99 })
  storage.setItem(key,future)
  const read = readDraft(key,future,isCashoutDraftSheet)
  assert.equal(read.state,'unreadable')
  assert.equal(read.raw,future)
  assert.equal(saveDraft(storage,draft,isCashoutDraftSheet).state,'failed')
  assert.equal(storage.getItem(key),future)
})
test('defined v0 upgrades in memory, then forks without changing the original bytes', () => {
  const original = make('older')
  const { createdAt: _created, sourceId: _source, ...v0 } = original
  const raw = JSON.stringify({ ...v0, schemaVersion: 0 })
  const storage = new MemoryStorage()
  storage.setItem(draftKey(original),raw)
  const read = listDrafts(storage,context,isCashoutDraftSheet).sources[0]
  assert.equal(read.state,'ready')
  assert.ok(read.state === 'ready')
  assert.equal(read.upgraded,true)
  const copy = newDraft(context,'New preparer',read.draft.payload,{ source:read.draft,id:'v1-copy',now })
  assert.equal(saveDraft(storage,copy,isCashoutDraftSheet).state,'saved')
  assert.equal(storage.getItem(draftKey(original)),raw)
})
test('denied storage is unavailable, never an empty success or a false save', () => {
  const storage = new MemoryStorage()
  storage.setItem = () => { throw new Error('quota') }
  assert.deepEqual(saveDraft(storage,make('quota'),isCashoutDraftSheet),{state:'failed',reason:'storage_unavailable'})
  Object.defineProperty(storage,'length',{get:()=>{throw new Error('denied')}})
  assert.equal(listDrafts(storage,context,isCashoutDraftSheet).state,'unavailable')
})
test('credentials, unsupported context, malformed cash payloads and renamed contexts are rejected', () => {
  const draft = make('valid')
  assert.throws(()=>newDraft(context,'Preparer',{ managerToken:'never persist' },{id:'token',now}))
  assert.throws(()=>newDraft(context,'Preparer',{ nested:{ Authorization:'never persist' } },{id:'auth',now}))
  assert.equal(isCashoutDraftSheet({ ...sheet(), token:'never persist' }),false)
  assert.equal(isCashoutDraftSheet({ ...sheet(), am:[{name:'N',counts:[0],toast:''}] }),false)
  const raw = JSON.stringify({ ...draft, context:{...context,storeId:'CR2'} })
  const storage = new MemoryStorage(); storage.setItem(draftKey(draft),raw)
  assert.equal(listDrafts(storage,context,isCashoutDraftSheet).sources[0].state,'unreadable')
  const unknown = JSON.stringify({ ...draft, context:{...context,unmodeledContext:'not ignored'} })
  assert.equal(readDraft(draftKey(draft),unknown,isCashoutDraftSheet).state,'unreadable')
})
