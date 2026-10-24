import { validHistoryData, snapshotPeriod, type HistoryData } from './import-history'
import { requestJson } from '../cashout-store'
import { validDirectory, type ImportDirectory } from './employee-mapping'
import { revision, type RecordEnvelope, type StoreId } from '../internal-tools/contracts'
export class ImportApiError extends Error {
 constructor(public code:'unauthorized'|'backend_unconfigured'|'conflict'|'unavailable'|'invalid'){super(code)}
}
export function importFailure(status:number):ImportApiError {
 return new ImportApiError(status===401||status===403?'unauthorized':status===404||status===503?'backend_unconfigured':status===409?'conflict':status===400?'invalid':'unavailable')
}
export type DirectoryRecord=RecordEnvelope<ImportDirectory>
export async function getDirectory(store:StoreId,token:string):Promise<DirectoryRecord|null>{
 const {status,body}=await requestJson(`/api/internal/import-directory/${store}`,token)
 if(status!==200)throw importFailure(status)
 const record=(body as {record?:DirectoryRecord}|null)?.record
 if(record===null)return null
 if(!record||record.storeId!==store||record.id!=='imports-directory'||revision(record.revision)===null||!validDirectory(record.data,store))throw new ImportApiError('invalid')
 return record
}
export async function putDirectory(store:StoreId,token:string,record:DirectoryRecord|null,data:ImportDirectory,preparer:string,operationId:string):Promise<DirectoryRecord>{
 const {status,body}=await requestJson(`/api/internal/import-directory/${store}`,token,{method:'PUT',body:JSON.stringify({preparer,mutation:{schemaVersion:1,baseRevision:record?.revision??0,operationId,data}})})
 if(status!==200)throw importFailure(status)
 const saved=(body as {record?:DirectoryRecord}|null)?.record
 if(!saved||saved.storeId!==store||revision(saved.revision)===null||!validDirectory(saved.data,store))throw new ImportApiError('invalid')
 return saved
}

export type ImportHistoryRecord=RecordEnvelope<HistoryData>
export async function getHistory(store:StoreId,kind:'sales'|'hours',start:string,end:string,token:string,cursor=''):Promise<{records:ImportHistoryRecord[];nextCursor:string|null}>{
 const query=new URLSearchParams({kind,start,end,cursor})
 const {status,body}=await requestJson(`/api/internal/import-history/${store}?${query}`,token)
 if(status!==200)throw importFailure(status)
 const page=body as {records?:ImportHistoryRecord[];nextCursor?:string|null}|null
 if(!Array.isArray(page?.records)||!(page.nextCursor===null||typeof page.nextCursor==='string')||!page.records.every(record=>record.storeId===store&&validHistoryData(record.data,store)&&record.data.kind===kind&&snapshotPeriod(record.data.snapshot).start===start&&snapshotPeriod(record.data.snapshot).end===end))throw new ImportApiError('invalid')
 return {records:page.records,nextCursor:page.nextCursor}
}
export async function putHistory(store:StoreId,token:string,id:string,data:HistoryData,operationId:string):Promise<ImportHistoryRecord>{
 const {status,body}=await requestJson(`/api/internal/import-history/${store}`,token,{method:'POST',body:JSON.stringify({id,mutation:{schemaVersion:1,baseRevision:0,operationId,data}})})
 if(status!==200)throw importFailure(status)
 const saved=(body as {record?:ImportHistoryRecord}|null)?.record
 if(!saved||saved.storeId!==store||!validHistoryData(saved.data,store))throw new ImportApiError('invalid')
 return saved
}
