import { historySnapshot } from './import-history'
import { historyData } from '../../src/lib/converter/import-history'
import { publishedHours } from '../../src/lib/converter/published-hours'
import { templateHashForSlots } from '../../src/lib/schedule-share'
import { expandTemplate } from '../../src/lib/scheduler/data'
import { DAYS, type WeeklyStaffingTemplate } from '../../src/lib/scheduler/types'
import type { StoreId, StationId } from '../../src/lib/internal-tools/contracts'
import type { ComparisonInput } from '../../src/lib/converter/scheduled-actual'
export const SHARED_ID='10000000-0000-4000-8000-000000000001'
export function comparisonTemplate():WeeklyStaffingTemplate{return Object.fromEntries(DAYS.map(day=>[day,day==='Wednesday'?[{period:'AM',role:'Cook',label:'Synthetic Cook',start:480,end:960,required:true}]:[]])) as WeeklyStaffingTemplate}
export async function comparisonFixture(storeId:StoreId='CR3'):Promise<ComparisonInput>{
 const station=`${storeId}-kitchen` as StationId,template=comparisonTemplate(),doc={v:3,weekStart:'2026-10-18',rev:2,updatedAt:'2026-10-19T12:00:00.000Z',visible:true,templateHash:templateHashForSlots(expandTemplate(template)),week:{version:1,weekStart:'2026-10-18',name:'Synthetic',people:['Duplicate name'],slotPeople:[0]}}
 const pub=await publishedHours(station,'2026-10-18',doc,template,null),snapshot=historySnapshot()
 snapshot.metadata.location=`CHINA ROSE #${storeId==='CR3'?'3 - 7046 W':'2 - 2535 SW'} MILITARY DR`
 snapshot.output!.filename=`${storeId}_26_1001-26_1031_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`
 const directory={version:1 as const,hourTargets:'disabled' as const,employees:[{id:SHARED_ID,name:'Explicit shared identity',active:true}],mappings:[{id:'10000000-0000-4000-8000-000000000002',system:'toast' as const,scope:storeId,externalId:'EMP-B',employeeId:SHARED_ID,from:'2026-10-01',until:null,reviewedBy:'Synthetic reviewer'},{id:'10000000-0000-4000-8000-000000000003',system:'scheduler' as const,scope:station,externalId:pub.people[0].key,employeeId:SHARED_ID,from:'2026-10-01',until:null,reviewedBy:'Synthetic reviewer'}]}
 snapshot.metadata.mapping={revision:1,directory}
 const data=await historyData(snapshot,'Synthetic reviewer')
 const record={schemaVersion:1,family:'employee-mapping',id:'imports-directory',storeId,revision:1,context:{kind:'undated'},createdAt:'2026-10-24T12:00:00.000Z',updatedAt:'2026-10-24T12:00:00.000Z',data:directory}
 const job={schemaVersion:1,family:'import',id:'imp_'+data.identity,storeId,revision:1,context:{kind:'period',start:'2026-10-01',end:'2026-10-31'},createdAt:'2026-10-24T12:00:00.000Z',updatedAt:'2026-10-24T12:00:00.000Z',data}
 return {storeId,directory:record,page:{version:1,storeId,start:'2026-10-01',end:'2026-10-31',publications:[pub]},imports:[job],hasMore:false} as ComparisonInput
}
