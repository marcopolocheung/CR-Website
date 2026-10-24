import { STATION_STORES } from '../internal-tools/contracts'
import { weeksInPeriod } from './published-hours'
import type { StoreId, StationId } from '../internal-tools/contracts'
import { sourceTime } from './business-date'
import { snapshotPeriod } from './import-history'
import { sourceNumber } from './validation'
import { reviewHours } from './hours-review'
import { mapHours } from './employee-mapping'
import type { DirectoryRecord, ImportHistoryRecord } from './import-api'
import type { PublicationPage } from './published-hours'
export type ComparisonInput={storeId:StoreId;directory:DirectoryRecord|null;page:PublicationPage;imports:ImportHistoryRecord[];hasMore:boolean;nextCursor?:string|null}
export type Limitation={code:'missing_history'|'more_history'|'unpublished'|'layout'|'legacy_timing'|'unmapped_actual'|'unmapped_schedule'|'duplicate_source'|'overlap'|'excluded_rows'|'partial_period'|'overlapping_actual';storeId?:StoreId;stationId?:StationId;weekStart?:string;count?:number}
export type EmployeeComparison={storeId:StoreId;employeeId:string;name:string;actualHours:number|null;regularHours:number|null;overtimeHours:number|null;scheduledMinutes:number|null;sourceRefs:string[]}
export function defaultImportSelection(inputs:ComparisonInput[]):Set<string>{
 const records=inputs.flatMap(input=>input.imports),parents=new Set(records.map(r=>r.data.supersedesId).filter(Boolean))
 return new Set(records.filter(r=>!parents.has(r.id)).map(r=>`${r.storeId}:${r.id}`))
}
export function compareScheduledActual(inputs:ComparisonInput[],start:string,end:string,selected:Set<string>){
 const limitations:Limitation[]=[],employees=new Map<string,EmployeeComparison>(),unmatchedActual:{storeId:StoreId;jobId:string;sourceRow:number;externalId:string;name:string;hours:number;regular:number;overtime:number}[]=[],unmatchedScheduled:{storeId:StoreId;stationId:StationId;weekStart:string;key:string;label:string;minutes:number}[]=[],intervals:{employeeId:string;storeId:StoreId;start:number;end:number;ref:string}[]=[]
 const employee=(storeId:StoreId,id:string,name:string)=>{
  const key=`${storeId}:${id}`;if(!employees.has(key))employees.set(key,{storeId,employeeId:id,name,actualHours:null,regularHours:null,overtimeHours:null,scheduledMinutes:null,sourceRefs:[]});return employees.get(key)!
 }
 const sourceExceptions:{storeId:StoreId;jobId:string;sourceRow:number;issues:string[];values:import('./validation').HoursRow}[]=[]
 const excludedImports:{storeId:StoreId;id:string;reason:string}[]=[]
 const sources:{storeId:StoreId;id:string;revision:number;fingerprints:string[];mappingRevision:number}[]=[]
 const storeTotals=inputs.map(input=>{
  const total={storeId:input.storeId,sourceRows:0,includedRows:0,excludedRows:0,sourceHours:0 as number|null,includedHours:0,excludedHours:0 as number|null,regularHours:0,overtimeHours:0,mappedActualHours:0,unmatchedActualHours:0,scheduledMinutes:0,unmappedScheduledMinutes:0,selectedImports:0,skippedDuplicateImports:0,skippedOverlappingImports:0,publishedSnapshots:0}
  if(input.hasMore)limitations.push({code:'more_history',storeId:input.storeId})
  const chosen=input.imports.filter(record=>selected.has(`${input.storeId}:${record.id}`)&&record.data.kind==='hours')
  const fingerprintCounts=new Map<string,number>()
  for(const record of chosen)for(const source of record.data.sources)fingerprintCounts.set(source.fingerprint,(fingerprintCounts.get(source.fingerprint)??0)+1)
  const owners=new Map<string,Set<string>>()
  for(const record of chosen){
   const snapshot=record.data.snapshot;if(snapshot.kind!=='hours')continue
   const mapped=mapHours(snapshot.rows,snapshot.metadata.mapping?.directory??null,input.storeId,snapshot.metadata.fingerprint??'')
   for(const row of reviewHours(snapshot.rows,start,end).included){
    const shared=mapped.find(item=>item.sourceRow===row.sourceRow)?.employee?.id,id=shared?`shared:${shared}`:row.values['Employee External Id'].trim()?`external:${row.values['Employee External Id'].trim()}`:null
    if(!id)continue
    const from=sourceTime(row.values['In Date']),to=sourceTime(row.values['Out Date']),key=`${id}:${from.instant??row.values['In Date']}:${to.instant??row.values['Out Date']}`
    if(!owners.has(key))owners.set(key,new Set());owners.get(key)!.add(record.id)
   }
  }
  const overlapping=new Set([...owners.values()].filter(ids=>ids.size>1).flatMap(ids=>[...ids]))
  for(const record of chosen){
   if(record.data.sources.some(source=>(fingerprintCounts.get(source.fingerprint)??0)>1)){total.skippedDuplicateImports++;excludedImports.push({storeId:input.storeId,id:record.id,reason:'duplicate_source'});continue}
   if(overlapping.has(record.id)){total.skippedOverlappingImports++;excludedImports.push({storeId:input.storeId,id:record.id,reason:'overlapping_actual'});continue}
   const snapshot=record.data.snapshot;if(snapshot.kind!=='hours')continue
   const period=snapshotPeriod(snapshot)
   if(period.start!==start||period.end!==end){limitations.push({code:'partial_period',storeId:input.storeId});excludedImports.push({storeId:input.storeId,id:record.id,reason:'partial_period'});continue}
   const review=reviewHours(snapshot.rows,start,end),mapped=mapHours(snapshot.rows,snapshot.metadata.mapping?.directory??null,input.storeId,snapshot.metadata.fingerprint??'')
   sourceExceptions.push(...review.excluded.map(row=>({storeId:input.storeId,jobId:record.id,sourceRow:row.sourceRow,issues:row.issues,values:row.values})))
   total.selectedImports++;total.sourceRows+=review.rows.length;total.includedRows+=review.included.length;total.excludedRows+=review.excluded.length
   total.sourceHours=total.sourceHours===null||review.totals.source===null?null:total.sourceHours+review.totals.source
   total.excludedHours=total.excludedHours===null||review.totals.excluded===null?null:total.excludedHours+review.totals.excluded
   sources.push({storeId:input.storeId,id:record.id,revision:record.revision,fingerprints:record.data.sources.map(s=>s.fingerprint),mappingRevision:record.data.mappingRevision})
   for(const row of review.included){
    const hours=sourceNumber(row.values['Total Hours'],false)!,regular=sourceNumber(row.values['Regular Hours'],false)!,overtime=sourceNumber(row.values['Overtime Hours'],false)!,identity=mapped.find(m=>m.sourceRow===row.sourceRow)
    total.includedHours+=hours;total.regularHours+=regular;total.overtimeHours+=overtime
    if(!identity?.employee){total.unmatchedActualHours+=hours;unmatchedActual.push({storeId:input.storeId,jobId:record.id,sourceRow:row.sourceRow,externalId:row.values['Employee External Id'],name:row.values.Employee,hours,regular,overtime});continue}
    total.mappedActualHours+=hours;const item=employee(input.storeId,identity.employee.id,identity.employee.name)
    item.actualHours=(item.actualHours??0)+hours;item.regularHours=(item.regularHours??0)+regular;item.overtimeHours=(item.overtimeHours??0)+overtime;item.sourceRefs.push(`${record.id}:row:${row.sourceRow}`)
   }
  }
  if(!total.selectedImports)limitations.push({code:'missing_history',storeId:input.storeId})
  if(total.skippedOverlappingImports)limitations.push({code:'overlapping_actual',storeId:input.storeId,count:total.skippedOverlappingImports})
  if(total.skippedDuplicateImports)limitations.push({code:'duplicate_source',storeId:input.storeId,count:total.skippedDuplicateImports})
  if(total.excludedRows)limitations.push({code:'excluded_rows',storeId:input.storeId,count:total.excludedRows})
  for(const station of Object.keys(STATION_STORES) as StationId[]) for(const week of weeksInPeriod(start,end)) {
   if(STATION_STORES[station]===input.storeId&&!input.page.publications.some(pub=>pub.stationId===station&&pub.weekStart===week)) limitations.push({code:'unpublished',storeId:input.storeId,stationId:station,weekStart:week})
  }
  for(const pub of input.page.publications){
   if(pub.status!=='published'){limitations.push({code:pub.status==='layout_unavailable'||pub.status==='invalid'?'layout':'unpublished',storeId:input.storeId,stationId:pub.stationId,weekStart:pub.weekStart});continue}
   total.publishedSnapshots++
   limitations.push({code:'legacy_timing',storeId:input.storeId,stationId:pub.stationId,weekStart:pub.weekStart})
   const resolve=(key:string,date:string)=>{
    const matches=input.directory?.data.mappings.filter(m=>m.system==='scheduler'&&m.scope===pub.stationId&&m.externalId===key&&m.from<=date&&(!m.until||m.until>=date))??[]
    return matches.length===1?input.directory?.data.employees.find(e=>e.id===matches[0].employeeId)??null:null
   }
   for(const person of pub.people){
    const identity=resolve(person.key,pub.weekStart<start?start:pub.weekStart)
    if(identity){const item=employee(input.storeId,identity.id,identity.name);item.scheduledMinutes??=0;item.sourceRefs.push(`${pub.stationId}:${pub.weekStart}:rev:${pub.revision}:person:${person.index}`)}
   }
   for(const assignment of pub.assignments){
    if(assignment.date<start||assignment.date>end)continue
    const minutes=assignment.end-assignment.start,person=pub.people.find(p=>p.key===assignment.key),identity=resolve(assignment.key,assignment.date)
    total.scheduledMinutes+=minutes
    if(!identity){total.unmappedScheduledMinutes+=minutes;unmatchedScheduled.push({storeId:input.storeId,stationId:pub.stationId,weekStart:pub.weekStart,key:assignment.key,label:person?.label??'',minutes});continue}
    const item=employee(input.storeId,identity.id,identity.name);item.scheduledMinutes=(item.scheduledMinutes??0)+minutes;item.sourceRefs.push(`${pub.stationId}:${pub.weekStart}:rev:${pub.revision}:${assignment.slotId}`)
    const base=Date.parse(assignment.date+'T00:00:00Z');intervals.push({employeeId:identity.id,storeId:input.storeId,start:base+assignment.start*60000,end:base+assignment.end*60000,ref:`${pub.stationId}:${pub.weekStart}:${assignment.slotId}`})
   }
  }
  const unmappedActual=unmatchedActual.filter(row=>row.storeId===input.storeId).length,unmappedSchedule=unmatchedScheduled.filter(row=>row.storeId===input.storeId).length
  if(unmappedActual)limitations.push({code:'unmapped_actual',storeId:input.storeId,count:unmappedActual})
  if(unmappedSchedule)limitations.push({code:'unmapped_schedule',storeId:input.storeId,count:unmappedSchedule})
  return {...total,includedHours:total.selectedImports?total.includedHours:null,regularHours:total.selectedImports?total.regularHours:null,overtimeHours:total.selectedImports?total.overtimeHours:null,scheduledMinutes:total.publishedSnapshots?total.scheduledMinutes:null}
 })
 const overlaps:{employeeId:string;left:string;right:string}[]=[]
 intervals.forEach((a,index)=>intervals.slice(index+1).forEach(b=>{if(a.employeeId===b.employeeId&&a.start<b.end&&b.start<a.end)overlaps.push({employeeId:a.employeeId,left:a.ref,right:b.ref})}))
 if(overlaps.length)limitations.push({code:'overlap',count:overlaps.length})
 const byEmployee=[...employees.values()].sort((a,b)=>a.employeeId.localeCompare(b.employeeId)||a.storeId.localeCompare(b.storeId))
 const combinedEmployees=[...new Set(byEmployee.map(row=>row.employeeId))].map(id=>{
  const rows=byEmployee.filter(row=>row.employeeId===id),sum=(key:'actualHours'|'regularHours'|'overtimeHours'|'scheduledMinutes')=>rows.some(row=>row[key]===null)?null:rows.reduce((sum,row)=>sum+row[key]!,0)
  return {employeeId:id,name:rows[0].name,stores:rows.map(row=>row.storeId),actualHours:sum('actualHours'),regularHours:sum('regularHours'),overtimeHours:sum('overtimeHours'),scheduledMinutes:sum('scheduledMinutes')}
 })
 const nullableSum=(key:'includedHours'|'regularHours'|'overtimeHours'|'scheduledMinutes')=>storeTotals.some(row=>row[key]===null)?null:storeTotals.reduce((sum,row)=>sum+row[key]!,0)
 const combinedTotals={includedHours:nullableSum('includedHours'),regularHours:nullableSum('regularHours'),overtimeHours:nullableSum('overtimeHours'),mappedActualHours:storeTotals.reduce((sum,row)=>sum+row.mappedActualHours,0),unmatchedActualHours:storeTotals.reduce((sum,row)=>sum+row.unmatchedActualHours,0),scheduledMinutes:nullableSum('scheduledMinutes'),unmappedScheduledMinutes:storeTotals.reduce((sum,row)=>sum+row.unmappedScheduledMinutes,0),uniqueMappedEmployees:combinedEmployees.length}

 return {version:1 as const,start,end,generatedAt:new Date().toISOString(),storeTotals,combinedTotals,employees:byEmployee,combinedEmployees,unmatchedActual,unmatchedScheduled,overlaps,limitations,sources,excludedImports,sourceExceptions,directorySnapshots:inputs.map(input=>input.directory),publications:inputs.flatMap(input=>input.page.publications),directoryRevisions:inputs.map(input=>({storeId:input.storeId,revision:input.directory?.revision??null})),hourTargets:'disabled' as const}
}
