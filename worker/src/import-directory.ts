import type { D1Database } from '@cloudflare/workers-types'
import { apiError, type StoreId, type RecordEnvelope, type MutationEnvelope } from '../../src/lib/internal-tools/contracts'
import { validDirectory, type ImportDirectory } from '../../src/lib/converter/employee-mapping'
import { canonicalJson } from '../../src/lib/internal-tools/json'
import { mutateRecord } from './record-mutations'
export async function directoryRecord(db:D1Database,store:StoreId):Promise<RecordEnvelope<ImportDirectory>|null>{
 const row=await db.prepare("SELECT data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='employee-mapping' AND id='imports-directory'").bind(store).first<{data_json:string;revision:number;created_at:string;updated_at:string}>()
 if(!row)return null
 const data=JSON.parse(row.data_json)
 if(!validDirectory(data,store))throw new Error('Invalid directory record')
 return {schemaVersion:1,family:'employee-mapping',id:'imports-directory',storeId:store,context:{kind:'undated'},revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,data} as RecordEnvelope<ImportDirectory>
}
export async function saveDirectory(db:D1Database,store:StoreId,raw:unknown){
 const body=raw as {mutation?:MutationEnvelope<ImportDirectory>;preparer?:string}|null
 if(!body||typeof body.preparer!=='string'||!body.preparer.trim()||body.preparer.length>120||!body.mutation||!validDirectory(body.mutation.data,store))return {ok:false as const,status:400,body:apiError('validation_failed')}
 const previous=await directoryRecord(db,store)
 const preparer=body.preparer
 return mutateRecord(db,{storeId:store,family:'employee-mapping',id:'imports-directory',context:{kind:'undated'},callerScope:'manager',action:'review-directory',actor:{kind:'entered-label',label:preparer}},body.mutation,data=>{
  if(!validDirectory(data,store))return [{path:'data',code:'invalid_directory'}]
  if(previous?.data.employees.some(old=>!data.employees.some(e=>e.id===old.id)))return [{path:'employees',code:'preserve_inactive_identity'}]
  if(data.mappings.some(mapping=>{const old=previous?.data.mappings.find(m=>m.id===mapping.id);return (!old||canonicalJson(old)!==canonicalJson(mapping))&&mapping.reviewedBy!==preparer.trim()}))return [{path:'mappings',code:'review_provenance_required'}]
  return []
 })
}
