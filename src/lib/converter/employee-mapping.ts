import { businessDate, isStationId, STATION_STORES, type StoreId } from '../internal-tools/contracts'
import type { HoursRow } from './validation'
import { sourceTime } from './business-date'
export type ImportEmployee={id:string;name:string;active:boolean}
export type ImportMapping={id:string;system:'toast'|'scheduler';scope:string;externalId:string;employeeId:string;from:string;until:string|null;reviewedBy:string}
export type ImportDirectory={version:1;employees:ImportEmployee[];mappings:ImportMapping[];hourTargets:'disabled'}
export const emptyDirectory=():ImportDirectory=>({version:1,employees:[],mappings:[],hourTargets:'disabled'})
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const keys=(v:object,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k))
export function validDirectory(value:unknown,store:StoreId):value is ImportDirectory {
 if(!object(value)||!keys(value,['version','employees','mappings','hourTargets'])||value.version!==1||value.hourTargets!=='disabled'||!Array.isArray(value.employees)||value.employees.length>300||!Array.isArray(value.mappings)||value.mappings.length>2000)return false
 if(!value.employees.every(e=>object(e)&&keys(e,['id','name','active'])&&uuid(e.id)&&text(e.name,120)&&typeof e.active==='boolean')||new Set(value.employees.map(e=>e.id)).size!==value.employees.length)return false
 const employees=new Set(value.employees.map(e=>e.id)),mappings=value.mappings as ImportMapping[]
 if(!mappings.every(m=>object(m)&&keys(m,['id','system','scope','externalId','employeeId','from','until','reviewedBy'])&&uuid(m.id)&&['toast','scheduler'].includes(m.system)&&text(m.externalId,200)&&employees.has(m.employeeId)&&!!businessDate(m.from)&&(m.until===null||!!businessDate(m.until)&&m.until>=m.from)&&text(m.reviewedBy,120)&&(m.system==='toast'?m.scope===store:isStationId(m.scope)&&STATION_STORES[m.scope]===store)))return false
 if(new Set(mappings.map(m=>m.id)).size!==mappings.length)return false
 return !mappings.some((a,i)=>mappings.slice(i+1).some(b=>a.system===b.system&&a.scope===b.scope&&a.externalId===b.externalId&&a.from<=(b.until??'9999-12-31')&&b.from<=(a.until??'9999-12-31')))
}
export function sourceEmployeeKey(row:HoursRow,fingerprint:string):string|null {
 const id=row['Employee External Id'].trim()
 return id||(/^sha256:[a-f0-9]{64}$/.test(fingerprint)&&row.__sourceRow?`row:${fingerprint}:${row.__sourceRow}`:null)
}
export function mapHours(rows:HoursRow[],directory:ImportDirectory|null,store:StoreId,fingerprint:string){
 return rows.map((row,index)=>{
  const key=sourceEmployeeKey(row,fingerprint),date=sourceTime(row['In Date']).date
  const matches=directory?.mappings.filter(m=>m.system==='toast'&&m.scope===store&&m.externalId===key&&date>=m.from&&(!m.until||date<=m.until))??[]
  const mapping=matches.length===1?matches[0]:null,employee=mapping?directory?.employees.find(e=>e.id===mapping.employeeId)??null:null
  return {sourceRow:row.__sourceRow??index+2,key,mapping,employee,values:row}
 })
}

export function ambiguousNames(rows:HoursRow[],mapped:ReturnType<typeof mapHours>):boolean {
 const names=new Map<string,Set<string>>()
 for(const row of mapped){const name=row.values.Employee.trim();if(!names.has(name))names.set(name,new Set());names.get(name)!.add(row.key??`row:${row.sourceRow}`)}
 return mapped.some(row=>(names.get(row.values.Employee.trim())?.size??0)>1&&!row.employee)
}
