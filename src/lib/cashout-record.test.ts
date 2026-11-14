import test from 'node:test'
import assert from 'node:assert/strict'
import { readCashoutRecord, readCashoutHistory, parseCashoutLookup, lookupDates, sameCashoutPayload } from './cashout-record'
import { fetchSavedCashoutRecord, fetchCashoutDay, fetchCashoutHistory } from './cashout-store'
import { cashRecovery, freezeCashAttempt, readCashRecovery, writeCashRecovery, cashRecoveryKey, assessCashSave } from './internal-tools/cashout-save'
import { newDraft } from './internal-tools/drafts'
import { businessDate } from './internal-tools/contracts'
import { changeAmount, type CashoutDraftSheet } from './internal-tools/cashout-draft'
const sheet = { am: [{name:'AM sample',counts:[0,1,0,0,0,0,0,0,0,0,0],toast:''}], pm: [],zReport:'0',extraMoney:'20' }
const totals = {amDeposit:-5000,pmDeposit:0,amOverShort:null,pmOverShort:0,deposit:-3000,overShort:null,zOverShort:-3000}
const doc = {v:1,store:'CR2',date:'2026-11-14',sheet,totals,updatedAt:'2026-11-14T18:00:00.000Z'}
const draft = () => newDraft({task:'cash-out',storeId:'CR2',businessDate:businessDate(doc.date)!},'Synthetic preparer',sheet)
const storage = () => {
  const bytes = new Map<string,string>()
  return {bytes,getItem:(key:string) => bytes.get(key) ?? null,setItem:(key:string,value:string) => {bytes.set(key,value)}}
}
test('links validate real dates, exact context and duplicate parameters before selecting a day', () => {
  assert.deepEqual(parseCashoutLookup(''),{store:'CR3',date:null})
  for (const store of ['CR2','CR3']) assert.deepEqual(parseCashoutLookup(`store=${store}&date=2026-11-14`),{store,date:'2026-11-14'})
  for (const search of ['date=2026-11-14','store=CR4','store=CR2&date=2026-02-30','store=CR2&date=','store=CR2&store=CR3','store=CR2&date=2026-11-14&date=2026-11-13']) assert.equal(parseCashoutLookup(search),null,search)
  assert.equal(lookupDates(doc.date).length,30)
  assert.equal(lookupDates(doc.date)[29],'2026-10-16')
})
test('saved reader retains all paper values, stored totals, time and comparison-only identity',async () => {
  const record = await readCashoutRecord(doc,'CR2',doc.date)
  assert.deepEqual(record.sheet,sheet)
  assert.deepEqual(record.totals,totals)
  assert.match(record.fingerprint,/^sha256:[0-9a-f]{64}$/)
  assert.equal('preparer' in record,false)
  assert.equal('countInputs' in record.sheet.am[0],false)
  const reordered = await readCashoutRecord({...doc,totals:{...totals},sheet:{...sheet}},'CR2',doc.date)
  assert.equal(record.fingerprint,reordered.fingerprint)
  const newer = await readCashoutRecord({...doc,updatedAt:'2026-11-14T19:00:00.000Z'},'CR2',doc.date)
  assert.notEqual(newer.fingerprint,record.fingerprint)
})
test('malformed or mismatched saved responses are rejected without returning partial work',async () => {
  const cases = [null,{}, {...doc,store:'CR3'},{...doc,date:'2026-11-13'},{...doc,updatedAt:'bad'},
    {...doc,sheet:{...sheet,am:[{...sheet.am[0],counts:[1]}]}},
    {...doc,sheet:{...sheet,am:[{...sheet.am[0],counts:[Infinity,...Array(10).fill(0)]}]}},
    {...doc,sheet:{...sheet,am:[{...sheet.am[0],countInputs:Array(11).fill('')}]}},
    {...doc,sheet:{...sheet,extraMoney:'-1'}},{...doc,totals:{...totals,deposit:null}}, {...doc,totals:{amDeposit:0}}]
  for (const value of cases) await assert.rejects(readCashoutRecord(value,'CR2',doc.date))
})
test('history distinguishes an empty window from invalid lists, duplicate days and out-of-window rows', () => {
  const row = {date:doc.date,totals,updatedAt:doc.updatedAt}
  assert.deepEqual(readCashoutHistory({days:[]},doc.date),[])
  assert.deepEqual(readCashoutHistory({days:[row]},doc.date),[row])
  for (const value of [{},{days:[row,row]},{days:[{...row,date:'2026-10-15'}]},{days:[{...row,totals:{}}]}]) assert.throws(() => readCashoutHistory(value,doc.date))
})
test('HTTP readers preserve sheet exports and distinguish missing, invalid, failure and invalid input without a fetch',async () => {
  const original = globalThis.fetch; let response = new Response(JSON.stringify(doc)); let calls = 0
  globalThis.fetch = async () => {calls++; return response.clone()}
  try {
    assert.deepEqual(await fetchCashoutDay('CR2',doc.date,'synthetic'),sheet)
    response = new Response('{}',{status:404}); assert.equal(await fetchSavedCashoutRecord('CR2',doc.date,'synthetic'),null)
    response = new Response('{}'); await assert.rejects(fetchSavedCashoutRecord('CR2',doc.date,'synthetic'))
    response = new Response('{}',{status:503}); await assert.rejects(fetchCashoutHistory('CR2',doc.date,'synthetic'))
    const before = calls; await assert.rejects(fetchSavedCashoutRecord('CR2','2026-02-30','synthetic')); assert.equal(calls,before)
  } finally {globalThis.fetch = original}
})
test('frozen requests detach raw metadata and comparison from later editor input', () => {
  const source: CashoutDraftSheet = {...sheet,am:[changeAmount(sheet.am[0],1,'50.00')]}
  const attempt = freezeCashAttempt(source)
  source.am[0].counts[1] = 99; source.am[0].amountInputs![1] = '4950.00'
  assert.equal(attempt.input.sheet.am[0].counts[1],1)
  assert.equal(attempt.source.am[0].amountInputs![1],'50.00')
  assert.equal('amountInputs' in attempt.input.sheet.am[0],false)
  assert.equal(sameCashoutPayload({...attempt.input,sheet:{...attempt.input.sheet,extraMoney:undefined}},{...attempt.input,sheet:{...attempt.input.sheet,extraMoney:''}}),true)
})
test('uncertain recovery is additive, credential-free, bound to the exact draft and preserves unreadable original bytes', () => {
  const d = draft(), s = storage(), value = {...cashRecovery(d,null),attempt:freezeCashAttempt(sheet)}
  assert.equal(writeCashRecovery(s,d,value),true)
  assert.deepEqual(readCashRecovery(s,d),{state:'ready',value})
  assert.equal(JSON.stringify(value).includes('synthetic'),false)
  const key = cashRecoveryKey(d)
  for (const raw of ['{broken',JSON.stringify({...value,v:2}),JSON.stringify({...value,store:'CR3'}),JSON.stringify({...value,authorization:'secret'}),JSON.stringify({...value,attempt:{...value.attempt,input:{...value.attempt.input,token:'secret'}}})]) {
    s.bytes.set(key,raw); assert.equal(readCashRecovery(s,d).state,'unreadable'); assert.equal(writeCashRecovery(s,d,value),false); assert.equal(s.getItem(key),raw)
  }
  const denied = {getItem:() => null,setItem:() => {throw new Error('denied')}}
  assert.equal(writeCashRecovery(denied,d,value),false)
})
test('assessment requires exact read-back match, explicit retry or replacement; fingerprints are comparison identities', async () => {
  const d = draft(), saved = await readCashoutRecord(doc,'CR2',doc.date), recovery = cashRecovery(d,saved.fingerprint)
  assert.equal(assessCashSave(saved,recovery),'replace')
  assert.equal(assessCashSave(saved,{...recovery,baseline:null}),'changed')
  assert.equal(assessCashSave(null,recovery),'new')
  const attempted = {...recovery,attempt:freezeCashAttempt(sheet)}
  assert.equal(assessCashSave(saved,attempted),'matched')
  assert.equal(assessCashSave(null,attempted),'retry')
  const divergent = await readCashoutRecord({...doc,sheet:{...sheet,extraMoney:'30'}},'CR2',doc.date)
  assert.equal(assessCashSave(divergent,attempted),'diverged')
})
test('resuming a device draft carries its source recovery into the new ID without rewriting source bytes', () => {
  const source = draft(), s = storage()
  const envelope = {...cashRecovery(source,null),attempt:freezeCashAttempt(sheet)}
  assert.equal(writeCashRecovery(s,source,envelope),true)
  const original = s.getItem(cashRecoveryKey(source))
  const resumed = newDraft(source.context,'Resumed preparer',source.payload,{source})
  const read = readCashRecovery(s,resumed)
  assert.equal(read.state,'ready')
  if (read.state !== 'ready') throw new Error('unreachable')
  assert.deepEqual(read.value,{...envelope,draftId:resumed.id})
  assert.equal(writeCashRecovery(s,resumed,read.value),true)
  assert.equal(s.getItem(cashRecoveryKey(source)),original)
})
