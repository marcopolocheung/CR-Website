import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHoursText, buildHoursWorkbook } from './parseCSV'
import { reviewHours } from './hours-review'
import { HOURS_COLUMNS, type HoursRow } from './validation'
const row=(values:Partial<HoursRow>={}):HoursRow=>({'Employee External Id':'e1',Employee:'Synthetic','Job Title':'Cook','In Date':'10/24/2026 11:00 PM','Out Date':'10/25/2026 02:00 AM','Total Hours':'3','Regular Hours':'2.5','Overtime Hours':'0.5',...values})
test('inclusive range owns whole overnight source shift with no payroll recalculation',()=>{
 const r=reviewHours([row()],'2026-10-24','2026-10-24');assert.equal(r.included.length,1);assert.equal(r.totals.regular,2.5);assert.equal(r.totals.overtime,0.5)
 assert.equal(reviewHours([row()],'2026-10-25','2026-10-25').excluded.length,1)
 const sheet=buildHoursWorkbook(r.included.map(r=>r.values)).getWorksheet('All Employees')!
 assert.equal(sheet.getCell('G2').value,2.5);assert.equal(sheet.getCell('H2').value,0.5)
})
test('open punches, invalid dates, DST ambiguity, missing IDs and source row numbers stay visible',()=>{
 const input=[row({'Out Date':''}),row({'In Date':'02/30/2026 08:00 AM'}),row({'In Date':'11/01/2026 01:30 AM','Out Date':'11/01/2026 03:00 AM'}),row({'Employee External Id':''})]
 const csv=[HOURS_COLUMNS.join(','),'',...input.map(r=>HOURS_COLUMNS.map(c=>r[c]).join(','))].join('\n')
 assert.equal(parseHoursText(csv).value,null)
 const parsed=parseHoursText(csv,true);assert.equal(parsed.value!.length,4);assert.equal(parsed.value![0].__sourceRow,3)
 const review=reviewHours(parsed.value!,'2026-01-01','2026-12-31')
 assert.equal(review.rows.length,4);assert.equal(review.excluded.length,3);assert.equal(review.blocked,true)
 assert.ok(review.rows[0].issues.includes('open'));assert.ok(review.rows[1].issues.includes('date'));assert.ok(review.rows[2].issues.includes('ambiguous'));assert.ok(review.rows[3].issues.includes('identity'))
 assert.equal(review.totals.source,12);assert.equal(review.totals.included!+review.totals.excluded!,review.totals.source)
})
test('reversed times, malformed numeric values and invalid periods cannot export as accepted rows',()=>{
 assert.ok(reviewHours([row({'Out Date':'10/24/2026 10:00 PM'})],'2026-10-24','2026-10-24').rows[0].issues.includes('reversed'))
 const bad=reviewHours([row({'Total Hours':'oops'})],'2026-10-24','2026-10-24');assert.equal(bad.totals.source,null);assert.equal(bad.included.length,0)
 assert.equal(reviewHours([row()],'2026-12-01','2026-01-01').validPeriod,false)
 assert.equal(parseHoursText(HOURS_COLUMNS.join(',')+'\ne1,Synthetic',true).value,null)
})
