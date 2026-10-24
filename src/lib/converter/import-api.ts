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
