import { businessDate } from '../internal-tools/contracts'
import { sourceTime } from './business-date'
import { sourceNumber, type HoursRow } from './validation'
export type HoursIssue='period'|'open'|'date'|'ambiguous'|'reversed'|'hours'|'outside'|'identity'
export type ReviewedHoursRow={ sourceRow:number; values:HoursRow; date:string; issues:HoursIssue[]; included:boolean }
export function reviewHours(rows:HoursRow[],start:string,end:string) {
 const validPeriod=!!businessDate(start)&&!!businessDate(end)&&start<=end
 const reviewed:ReviewedHoursRow[]=rows.map((values,index)=>{
  const issues:HoursIssue[]=[],from=sourceTime(values['In Date']),to=sourceTime(values['Out Date'])
  if(!validPeriod)issues.push('period')
  if(!values['Out Date'].trim())issues.push('open')
  else if(from.issue==='ambiguous'||to.issue==='ambiguous')issues.push('ambiguous')
  else if(from.issue||to.issue)issues.push('date')
  else if(to.date<from.date||(from.instant!==null&&to.instant!==null&&to.instant<from.instant))issues.push('reversed')
  if(!values['In Date'].trim()||from.issue==='invalid') {if(!issues.includes('date'))issues.push('date')}
  const numeric=['Total Hours','Regular Hours','Overtime Hours'].map(key=>sourceNumber(values[key as keyof HoursRow],false))
  if(numeric.some(n=>n===null||n<0))issues.push('hours')
  if(validPeriod&&from.date&&(from.date<start||from.date>end))issues.push('outside')
  if(!values['Employee External Id'].trim()||!values.Employee.trim())issues.push('identity')
  return {sourceRow:values.__sourceRow??index+2,values,date:from.date,issues,included:!issues.some(i=>i!=='identity')}
 })
 const total=(list:ReviewedHoursRow[],key:'Total Hours'|'Regular Hours'|'Overtime Hours')=>{
  const values=list.map(row=>sourceNumber(row.values[key],false))
  return values.some(v=>v===null)?null:(values as number[]).reduce((a,b)=>a+b,0)
 }
 const included=reviewed.filter(row=>row.included),excluded=reviewed.filter(row=>!row.included)
 return {rows:reviewed,included,excluded,blocked:included.some(row=>row.issues.includes('identity')),validPeriod,
  totals:{source:total(reviewed,'Total Hours'),included:total(included,'Total Hours'),excluded:total(excluded,'Total Hours'),regular:total(included,'Regular Hours'),overtime:total(included,'Overtime Hours')}}
}
