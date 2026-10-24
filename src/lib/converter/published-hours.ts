import { businessDate, isStationId, STATION_STORES, type StationId, type StoreId } from '../internal-tools/contracts'
import { canonicalJson } from '../internal-tools/json'
import { dateForDay } from '../scheduler/week'
import { layoutForWeek, templateHashForSlots } from '../schedule-share'
import { expandTemplate } from '../scheduler/data'
import type { WeeklyStaffingTemplate } from '../scheduler/types'
export type PublishedPerson={key:string;label:string;index:number}
export type PublishedAssignment={key:string;date:string;slotId:string;start:number;end:number}
export type Publication={stationId:StationId;weekStart:string;status:'published'|'hidden'|'missing'|'invalid'|'layout_unavailable';revision:number|null;updatedAt:string|null;fingerprint:string|null;people:PublishedPerson[];assignments:PublishedAssignment[];timingBasis:'legacy-estimate';templateSource:string;ruleFingerprint:string|null}
export type PublicationPage={version:1;storeId:StoreId;start:string;end:string;publications:Publication[]}
export function weeksInPeriod(start:string,end:string):string[]{
 if(!businessDate(start)||!businessDate(end)||start>end||Date.parse(end)-Date.parse(start)>62*86400000)throw new Error('Invalid comparison period')
 const first=Date.parse(start+'T00:00:00Z'),sunday=first-new Date(first).getUTCDay()*86400000,result:string[]=[]
 for(let ms=sunday;ms<=Date.parse(end+'T00:00:00Z');ms+=7*86400000)result.push(new Date(ms).toISOString().slice(0,10))
 return result
}
export async function publishedHours(stationId:StationId,weekStart:string,raw:unknown,weekTemplate:WeeklyStaffingTemplate|null,globalTemplate:WeeklyStaffingTemplate|null):Promise<Publication>{
 const empty:Publication={stationId,weekStart,status:raw?'invalid':'missing',revision:null,updatedAt:null,fingerprint:null,people:[],assignments:[],timingBasis:'legacy-estimate',templateSource:'unknown',ruleFingerprint:null}
 if(!raw||typeof raw!=='object')return empty
 const doc=raw as {v?:number;weekStart?:string;rev?:number;updatedAt?:string;visible?:boolean;templateHash?:string;week?:{version?:number;weekStart?:string;people?:string[];slotPeople?:number[]}}
 if(doc.v!==3||doc.weekStart!==weekStart||!Number.isSafeInteger(doc.rev)||doc.rev!<1||typeof doc.updatedAt!=='string'||!Number.isFinite(Date.parse(doc.updatedAt))||typeof doc.templateHash!=='string'||!doc.week||doc.week.weekStart!==weekStart||doc.week.version!==1||!Array.isArray(doc.week.people)||doc.week.people.length>300||!doc.week.people.every(p=>typeof p==='string'&&p.length<=120)||!Array.isArray(doc.week.slotPeople)||!doc.week.slotPeople.every(i=>Number.isInteger(i)&&i>=-1&&i<doc.week!.people!.length))return empty
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson(doc))),fingerprint=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
 const result:Publication={...empty,revision:doc.rev!,updatedAt:doc.updatedAt,fingerprint:'sha256:'+fingerprint,status:doc.visible===false?'hidden':'published',people:doc.week.people.map((label,index)=>({key:`pub:${fingerprint}:${index}`,label,index}))}
 if(doc.visible===false)return result
 const layout=layoutForWeek([weekTemplate,globalTemplate],stationId,doc.templateHash)
 if(!layout.matches||doc.week.slotPeople.length!==layout.slots.length)return {...result,status:'layout_unavailable'}
 result.templateSource=weekTemplate&&templateHashForSlots(expandTemplate(weekTemplate))===doc.templateHash?'current-week-rules':globalTemplate&&templateHashForSlots(expandTemplate(globalTemplate))===doc.templateHash?'current-station-rules':'built-in-rules'
 const ruleDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson(layout.slots)))
 result.ruleFingerprint='sha256:'+Array.from(new Uint8Array(ruleDigest),n=>n.toString(16).padStart(2,'0')).join('')
 const assignments:PublishedAssignment[]=[]
 for(let index=0;index<layout.slots.length;index++){
  const slot=layout.slots[index],person=doc.week.slotPeople[index]
  if(!Number.isInteger(slot.start)||!Number.isInteger(slot.end)||slot.start<0||slot.start>=1440||slot.end<0||slot.end>2880||slot.start===slot.end)return {...result,status:'layout_unavailable'}
  if(person<0)continue
  assignments.push({key:result.people[person].key,date:dateForDay(weekStart,slot.day),slotId:slot.id,start:slot.start,end:slot.end<=slot.start?slot.end+1440:slot.end})
 }
 return {...result,assignments}
}
export function validPublicationPage(raw:unknown,store:StoreId,start:string,end:string):raw is PublicationPage{
 if(!raw||typeof raw!=='object')return false
 const p=raw as PublicationPage
 return p.version===1&&p.storeId===store&&p.start===start&&p.end===end&&Array.isArray(p.publications)&&p.publications.every(v=>isStationId(v.stationId)&&STATION_STORES[v.stationId]===store&&!!businessDate(v.weekStart)&&['published','hidden','missing','invalid','layout_unavailable'].includes(v.status)&&Array.isArray(v.people)&&v.people.every(x=>typeof x.key==='string'&&/^pub:[a-f0-9]{64}:\d+$/.test(x.key)&&typeof x.label==='string'&&Number.isSafeInteger(x.index))&&Array.isArray(v.assignments)&&v.assignments.every(a=>typeof a.key==='string'&&v.people.some(p=>p.key===a.key)&&!!businessDate(a.date)&&Number.isInteger(a.start)&&Number.isInteger(a.end)&&a.start>=0&&a.start<1440&&a.end>a.start&&a.end<=2880))
}
