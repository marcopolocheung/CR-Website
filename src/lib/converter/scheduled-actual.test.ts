import test from 'node:test'
import assert from 'node:assert/strict'
import { comparisonFixture, comparisonTemplate, SHARED_ID } from '../../../scripts/fixtures/scheduled-actual'
import { compareScheduledActual, defaultImportSelection } from './scheduled-actual'
import { publishedHours, weeksInPeriod } from './published-hours'
import { templateHashForSlots } from '../schedule-share'
import { expandTemplate } from '../scheduler/data'
test('shared employee counted once across stores while source totals and unmatched hours reconcile',async()=>{
 const inputs=await Promise.all([comparisonFixture('CR2'),comparisonFixture('CR3')]),report=compareScheduledActual(inputs,'2026-10-01','2026-10-31',defaultImportSelection(inputs))
 assert.equal(report.combinedTotals.includedHours,48);assert.equal(report.combinedTotals.mappedActualHours,34);assert.equal(report.combinedTotals.unmatchedActualHours,14)
 assert.equal(report.combinedTotals.scheduledMinutes,960);assert.equal(report.combinedTotals.uniqueMappedEmployees,1);assert.equal(report.combinedEmployees[0].employeeId,SHARED_ID);assert.equal(report.combinedEmployees[0].actualHours,34)
 assert.equal(report.overlaps.length,1);assert.ok(report.limitations.some(l=>l.code==='overlap'))
 for(const total of report.storeTotals){assert.equal(total.includedHours,total.mappedActualHours+total.unmatchedActualHours);assert.equal(total.sourceHours,total.includedHours!+total.excludedHours!)}
 assert.equal(report.unmatchedActual.length,2);assert.equal(report.hourTargets,'disabled')
})
test('missing mappings or imports remain unavailable rather than measured zero; explicit OFF is zero',async()=>{
 const input=await comparisonFixture();input.directory!.data.mappings=input.directory!.data.mappings.filter(m=>m.system!=='scheduler')
 let report=compareScheduledActual([input],'2026-10-01','2026-10-31',defaultImportSelection([input]));assert.equal(report.employees[0].scheduledMinutes,null);assert.equal(report.unmatchedScheduled.length,1)
 input.imports=[];report=compareScheduledActual([input],'2026-10-01','2026-10-31',new Set());assert.equal(report.storeTotals[0].includedHours,null);assert.equal(report.combinedTotals.includedHours,null)
 const off=await comparisonFixture();off.page.publications[0].assignments=[];report=compareScheduledActual([off],'2026-10-01','2026-10-31',defaultImportSelection([off]));assert.equal(report.employees[0].scheduledMinutes,0)
})
test('duplicate selected versions are quarantined; default selection keeps linked leaf only',async()=>{
 const input=await comparisonFixture(),root=input.imports[0],child=structuredClone(root);child.id='10000000-0000-4000-8000-000000000010' as typeof root.id;child.data.supersedesId=root.id;input.imports.push(child)
 const selection=defaultImportSelection([input]);assert.equal(selection.size,1);assert.equal(selection.has(`CR3:${child.id}`),true)
 let report=compareScheduledActual([input],'2026-10-01','2026-10-31',selection);assert.equal(report.combinedTotals.includedHours,24)
 report=compareScheduledActual([input],'2026-10-01','2026-10-31',new Set(input.imports.map(r=>`CR3:${r.id}`)));assert.equal(report.storeTotals[0].skippedDuplicateImports,2);assert.equal(report.combinedTotals.includedHours,null)
})
test('unpublished, missing, malformed and incompatible schedules are explicit limitations',async()=>{
 const input=await comparisonFixture();input.page.publications[0].status='hidden';input.hasMore=true
 const report=compareScheduledActual([input],'2026-10-01','2026-10-31',defaultImportSelection([input]));assert.equal(report.storeTotals[0].scheduledMinutes,null);assert.ok(report.limitations.some(l=>l.code==='unpublished'));assert.ok(report.limitations.some(l=>l.code==='more_history'))
 assert.equal((await publishedHours('CR3-kitchen','2026-10-18',null,null,null)).status,'missing')
 assert.equal((await publishedHours('CR3-kitchen','2026-10-18',{},null,null)).status,'invalid')
 assert.throws(()=>weeksInPeriod('2026-01-01','2026-12-31'));assert.deepEqual(weeksInPeriod('2026-10-21','2026-10-24'),['2026-10-18'])
})
test('legacy layout hashes do not pin times: rule fingerprints and estimates expose changes',async()=>{
 const template=comparisonTemplate(),doc={v:3,weekStart:'2026-10-18',rev:2,updatedAt:'2026-10-19T12:00:00.000Z',visible:true,templateHash:templateHashForSlots(expandTemplate(template)),week:{version:1,weekStart:'2026-10-18',name:'Synthetic',people:['Same name'],slotPeople:[0]}}
 const before=await publishedHours('CR3-kitchen','2026-10-18',doc,template,null);template.Wednesday[0].end=1020
 const after=await publishedHours('CR3-kitchen','2026-10-18',doc,template,null)
 assert.equal(before.fingerprint,after.fingerprint);assert.notEqual(before.ruleFingerprint,after.ruleFingerprint);assert.equal(after.timingBasis,'legacy-estimate');assert.equal(after.assignments[0].end-before.assignments[0].end,60)
 const wrong=await publishedHours('CR3-kitchen','2026-10-18',{...doc,templateHash:'00000000'},template,null);assert.equal(wrong.status,'layout_unavailable');assert.equal(wrong.assignments.length,0)
})
test('different byte fingerprints do not double-count repeated identified attendance rows',async()=>{
 const input=await comparisonFixture(),other=structuredClone(input.imports[0]);other.id='other-source' as typeof other.id
 other.data.sources[0].fingerprint='sha256:'+'d'.repeat(64)
 if(other.data.snapshot.kind==='hours')other.data.snapshot.metadata.fingerprint=other.data.sources[0].fingerprint
 input.imports.push(other)
 const report=compareScheduledActual([input],'2026-10-01','2026-10-31',defaultImportSelection([input]))
 assert.equal(report.storeTotals[0].skippedOverlappingImports,2);assert.equal(report.combinedTotals.includedHours,null);assert.ok(report.limitations.some(l=>l.code==='overlapping_actual'))
})
test('overnight overlaps are visible; excluded source rows and partial periods stay in evidence',async()=>{
 const input=await comparisonFixture(),pub=input.page.publications[0]
 pub.assignments=[{...pub.assignments[0],date:'2026-10-21',start:1380,end:1560},{...pub.assignments[0],slotId:'next-day',date:'2026-10-22',start:0,end:120}]
 const snapshot=input.imports[0].data.snapshot
 if(snapshot.kind==='hours')snapshot.rows.push({...snapshot.rows[0],__sourceRow:9,'Out Date':''})
 const report=compareScheduledActual([input],'2026-10-01','2026-10-31',defaultImportSelection([input]))
 assert.equal(report.overlaps.length,1);assert.equal(report.sourceExceptions.length,1);assert.equal(report.sourceExceptions[0].sourceRow,9);assert.equal(report.sourceExceptions[0].values['Out Date'],'')
 const partial=compareScheduledActual([input],'2026-10-02','2026-10-31',defaultImportSelection([input]));assert.equal(partial.combinedTotals.includedHours,null);assert.ok(partial.limitations.some(l=>l.code==='partial_period'))
})
