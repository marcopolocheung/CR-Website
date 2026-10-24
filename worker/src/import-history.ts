import type { D1Database } from '@cloudflare/workers-types'
import { apiError, recordId, type StoreId, type RecordEnvelope, type MutationEnvelope, businessDate } from '../../src/lib/internal-tools/contracts'
import { historyIdentity, snapshotPeriod, validHistoryData, type HistoryData } from '../../src/lib/converter/import-history'
import { uuid } from '../../src/lib/converter/employee-mapping'
import { mutateRecord } from './record-mutations'
export type HistoryRecord=RecordEnvelope<HistoryData>
function envelope(row:{id:string;data_json:string;revision:number;created_at:string;updated_at:string},store:StoreId):HistoryRecord{
 const data=JSON.parse(row.data_json)
 if(!validHistoryData(data,store))throw new Error('Unsupported import record')
 const p=snapshotPeriod(data.snapshot)
 return {schemaVersion:1,family:'import',id:row.id,storeId:store,context:data.kind==='sales'?{kind:'day',businessDate:p.start}:{kind:'period',...p},revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,data} as HistoryRecord
}
export async function historyRecord(db:D1Database,store:StoreId,id:string):Promise<HistoryRecord|null>{
 const row=await db.prepare("SELECT id,data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='import' AND id=?").bind(store,id).first<Parameters<typeof envelope>[0]>()
 return row?envelope(row,store):null
}
export async function historyPage(db:D1Database,store:StoreId,kind:string,start:string,end:string,cursor:string){
 if(!['sales','hours'].includes(kind)||!businessDate(start)||!businessDate(end)||start>end||kind==='sales'&&start!==end||cursor&&!recordId(cursor))throw new Error('Invalid import query')
 const result=await db.prepare(`SELECT id,data_json,revision,created_at,updated_at FROM records WHERE store_id=? AND family='import' AND json_extract(data_json,'$.kind')=?
 AND ((context_kind='day' AND business_date=? AND ?=?) OR (context_kind='period' AND period_start=? AND period_end=?)) AND (?='' OR id<?) ORDER BY id DESC LIMIT 11`)
 .bind(store,kind,start,start,end,start,end,cursor,cursor).all<Parameters<typeof envelope>[0]>()
 return {records:result.results.slice(0,10).map(row=>envelope(row,store)),nextCursor:result.results.length>10?result.results[9].id:null}
}
export async function saveHistory(db:D1Database,store:StoreId,raw:unknown){
 const body=raw as {id?:string;mutation?:MutationEnvelope<HistoryData>}|null
 if(!body?.id||!recordId(body.id)||!body.mutation||body.mutation.baseRevision!==0||!validHistoryData(body.mutation.data,store))return {ok:false as const,status:400,body:apiError('validation_failed')}
 const data=body.mutation.data,p=snapshotPeriod(data.snapshot)
 if(await historyIdentity(data.snapshot)!==data.identity||(!data.supersedesId&&body.id!==`imp_${data.identity}`)||data.supersedesId&&!uuid(body.id))return {ok:false as const,status:400,body:apiError('validation_failed')}
 if(data.supersedesId){
  const parent=await historyRecord(db,store,data.supersedesId)
  if(!parent||parent.id===body.id||parent.data.kind!==data.kind||JSON.stringify(snapshotPeriod(parent.data.snapshot))!==JSON.stringify(p))return {ok:false as const,status:400,body:apiError('validation_failed')}
 }
 return mutateRecord(db,{storeId:store,family:'import',id:body.id,context:data.kind==='sales'?{kind:'day',businessDate:businessDate(p.start)!}:{kind:'period',start:businessDate(p.start)!,end:businessDate(p.end)!},callerScope:'manager',action:'record-reviewed-import',actor:{kind:'entered-label',label:data.reviewedBy}},body.mutation,value=>validHistoryData(value,store)?[]:[{path:'data',code:'invalid_import'}])
}
