import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { salesFixtures } from '../../../scripts/fixtures/imports'
import { salesContext, needsContextReview, validSalesContext, weekday } from './sales-context'
import { sourceTime } from './business-date'
import { fetchCashoutSnapshot } from '../cashout-store'
const sources=()=>Object.fromEntries(Object.entries(salesFixtures()).map(([slot,workbook])=>[slot,{name:slot+'.xlsx',workbook}])) as Parameters<typeof salesContext>[0]
test('weekday derives only from a valid selected calendar date',()=>{
 assert.equal(weekday('2026-10-20'),'TUE');assert.equal(weekday('2026-10-21'),'WED');assert.equal(weekday('2026-02-30'),'')
})
test('matching metadata, missing metadata and mismatched source store/date stay distinct',()=>{
 const input=sources();assert.equal(needsContextReview(salesContext(input),'2026-10-20','CR3'),true)
 for(const source of Object.values(input))XLSX.utils.book_append_sheet(source.workbook,XLSX.utils.aoa_to_sheet([['Business date','Store'],['2026-10-20','CR3']]),'Report context')
 const matching=salesContext(input);assert.equal(needsContextReview(matching,'2026-10-20','CR3'),false)
 assert.equal(needsContextReview(matching,'2026-10-21','CR3'),true);assert.equal(needsContextReview(matching,'2026-10-20','CR2'),true)
 assert.equal(validSalesContext(matching),true);assert.equal(validSalesContext({...matching,token:'secret'}),false)
})
test('timestamp parsing rejects normalization, DST gaps and repeats; offsets disambiguate',()=>{
 assert.equal(sourceTime('02/30/2026 08:00 AM').issue,'invalid')
 assert.equal(sourceTime('03/08/2026 02:30 AM').issue,'invalid')
 assert.equal(sourceTime('11/01/2026 01:30 AM').issue,'ambiguous')
 assert.equal(sourceTime('2026-11-01T01:30:00-05:00').issue,null)
 assert.equal(sourceTime('2026-07-02T04:00:00Z').date,'2026-07-01')
 assert.equal(sourceTime('10/24/2026 11:00 PM').date,'2026-10-24')
})
test('saved cash-out digest binds exact retrieved context and distinguishes missing from zero',async()=>{
 const original=globalThis.fetch
 const doc={store:'CR3',date:'2026-10-20',updatedAt:'2026-10-21T01:00:00Z',sheet:{am:[],pm:[],zReport:''},totals:{amDeposit:0,pmDeposit:120,amOverShort:null,pmOverShort:0}}
 try {
 globalThis.fetch=async()=>new Response(JSON.stringify(doc),{status:200})
 const first=await fetchCashoutSnapshot('CR3','2026-10-20','synthetic')
 assert.equal(first?.totals.amDeposit,0);assert.equal(first?.totals.amOverShort,null);assert.match(first!.link.revision,/^sha256:[a-f0-9]{64}$/)
 assert.equal((await fetchCashoutSnapshot('CR3','2026-10-20','synthetic'))?.link.revision,first?.link.revision)
 doc.totals.pmDeposit++;assert.notEqual((await fetchCashoutSnapshot('CR3','2026-10-20','synthetic'))?.link.revision,first?.link.revision)
 await assert.rejects(fetchCashoutSnapshot('CR2','2026-10-20','synthetic'))
 globalThis.fetch=async()=>new Response('{}',{status:404});assert.equal(await fetchCashoutSnapshot('CR3','2026-10-20','synthetic'),null)
 }finally{globalThis.fetch=original}
})
