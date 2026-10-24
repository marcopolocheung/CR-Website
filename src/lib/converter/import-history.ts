import { businessDate, isStoreId, type StoreId } from '../internal-tools/contracts'
import { canonicalJson } from '../internal-tools/json'
import { importStore, isImportSnapshot, type ImportSnapshot } from './import-snapshot'
import { needsContextReview } from './sales-context'
import { reviewHours } from './hours-review'
import { mapHours, ambiguousNames } from './employee-mapping'
export type ImportSource={slot:string;filename:string;fingerprint:string}
export type HistoryData={version:1;kind:'sales'|'hours';identity:string;parserVersion:string;workbookMappingVersion:string;mappingRevision:number;sources:ImportSource[];snapshot:ImportSnapshot;output:{filename:string;sha256:string};supersedesId:string|null;reviewedBy:string;accepted:true}
export const PARSER_VERSION='imports-v1.1'
export function snapshotPeriod(snapshot:ImportSnapshot){return snapshot.kind==='sales'?{start:snapshot.review.form.date,end:snapshot.review.form.date}:{start:snapshot.metadata.startDate,end:snapshot.metadata.endDate}}
export function snapshotStore(snapshot:ImportSnapshot):StoreId|null{return importStore(snapshot.kind==='sales'?snapshot.review.form.location:snapshot.metadata.location)}
export function historySources(snapshot:ImportSnapshot):ImportSource[]{
 return snapshot.kind==='sales'?snapshot.review.sources.map(s=>({slot:s.slot,filename:s.filename,fingerprint:s.fingerprint??''})):[{slot:'hours',filename:snapshot.sourceName,fingerprint:snapshot.metadata.fingerprint??''}]
}
export async function historyIdentity(snapshot:ImportSnapshot):Promise<string>{
 const identity={kind:snapshot.kind,storeId:snapshotStore(snapshot),period:snapshotPeriod(snapshot),parserVersion:PARSER_VERSION,workbookMappingVersion:'legacy-workbook-v1',mappingRevision:snapshot.kind==='hours'?snapshot.metadata.mapping?.revision??0:0,sources:historySources(snapshot).map(({slot,fingerprint})=>({slot,fingerprint})).sort((a,b)=>a.slot.localeCompare(b.slot))}
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson(identity)))
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
}
export async function historyData(snapshot:ImportSnapshot,preparer:string,supersedesId:string|null=null):Promise<HistoryData>{
 if(!snapshot.output)throw new Error('Generate the reviewed workbook first')
 return {version:1,kind:snapshot.kind,identity:await historyIdentity(snapshot),parserVersion:PARSER_VERSION,workbookMappingVersion:'legacy-workbook-v1',mappingRevision:snapshot.kind==='hours'?snapshot.metadata.mapping?.revision??0:0,sources:historySources(snapshot),snapshot:{...snapshot,output:null},output:{filename:snapshot.output.filename,sha256:snapshot.output.sha256},supersedesId,reviewedBy:preparer,accepted:true}
}
export function validHistoryData(value:unknown,store:StoreId):value is HistoryData {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const v=value as HistoryData
 if(!Object.keys(v).every(k=>['version','kind','identity','parserVersion','workbookMappingVersion','mappingRevision','sources','snapshot','output','supersedesId','reviewedBy','accepted'].includes(k))||v.version!==1||v.accepted!==true||!isImportSnapshot(v.snapshot)||v.snapshot.output!==null||snapshotStore(v.snapshot)!==store||v.kind!==v.snapshot.kind||v.parserVersion!==PARSER_VERSION||v.workbookMappingVersion!=='legacy-workbook-v1'||typeof v.identity!=='string'||!/^[a-f0-9]{64}$/.test(v.identity)||!Number.isSafeInteger(v.mappingRevision)||v.mappingRevision<0||v.mappingRevision!==(v.snapshot.kind==='hours'?v.snapshot.metadata.mapping?.revision??0:0)||typeof v.reviewedBy!=='string'||!v.reviewedBy.trim()||v.reviewedBy.length>120||!(v.supersedesId===null||typeof v.supersedesId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v.supersedesId)))return false
 const expected=historySources(v.snapshot)
 if(!Array.isArray(v.sources)||canonicalJson(v.sources)!==canonicalJson(expected)||!v.sources.every(s=>typeof s.fingerprint==='string'&&/^sha256:[a-f0-9]{64}$/.test(s.fingerprint)&&typeof s.filename==='string'&&s.filename.length<=255))return false
 if(!v.output||Object.keys(v.output).some(k=>!['filename','sha256'].includes(k))||typeof v.output.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.output.sha256)||typeof v.output.filename!=='string')return false
 const period=snapshotPeriod(v.snapshot);if(!businessDate(period.start)||!businessDate(period.end)||period.start>period.end||!isStoreId(store))return false
 const snapshot=v.snapshot
 if(snapshot.kind==='sales'){
  if(needsContextReview(snapshot.review.context,snapshot.review.form.date,store)&&!snapshot.review.context?.reason.trim())return false
  const d=snapshot.review.form.date
  return v.output.filename===`${d.slice(2,4)}-${d.slice(5,7)}${d.slice(8,10)}_${store}_Daily_Sales_Report.xlsx`
 }
 const d=snapshot.metadata,review=reviewHours(snapshot.rows,d.startDate,d.endDate),mapped=mapHours(snapshot.rows,d.mapping?.directory??null,store,d.fingerprint??'')
 if(!review.validPeriod||!review.included.length||review.included.some(row=>!row.values.Employee.trim()||!row.values['Employee External Id'].trim()&&!mapped.find(m=>m.sourceRow===row.sourceRow)?.employee)||ambiguousNames(review.included.map(r=>r.values),mapped.filter(m=>review.included.some(r=>r.sourceRow===m.sourceRow))))return false
 const format=(d:string)=>`${d.slice(2,4)}_${d.slice(5,7)}${d.slice(8,10)}`
 return v.output.filename===`${store}_${format(d.startDate)}-${format(d.endDate)}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`
}
