import test from 'node:test'
import assert from 'node:assert/strict'
import { MutationRecovery, SingleFlight, type RecoveryResult } from './recovery'
import { decodeCapabilities } from './compatibility'
import { apiError, recordId, revision, utcTimestamp, type Json, type MutationEnvelope, type RecordEnvelope } from './contracts'
import { inventoryComparison, isInventorySheets } from './inventory-recovery'
import { translate } from './i18n'
import type { InventorySheet } from '../inventory'
const caps = decodeCapabilities(200,{schemaVersion:1,services:{form:{readVersions:[1],writeVersions:[1],atomicRevisions:true,idempotentOperations:true}}})
const target = {storeId:'CR3',family:'form',id:'fixture-record',action:'submit'} as const
const record = (data: Json, rev=1): RecordEnvelope<Json> => ({schemaVersion:1,storeId:'CR3',family:'form',id:recordId('fixture-record')!,revision:revision(rev)!,createdAt:utcTimestamp('2026-10-24T12:00:00.000Z')!,updatedAt:utcTimestamp('2026-10-24T12:00:00.000Z')!,context:{kind:'undated'},data})

test('one in-flight operation coalesces repeated submissions and snapshots its original data',async()=>{
  const session = new MutationRecovery<Json>(target,caps)
  let calls=0;let release!:()=>void
  const held = new Promise<void>(resolve=>{release=resolve})
  const data={narrative:'Original',missing:null,zero:0}
  const adapter=async(m:MutationEnvelope<Json>):Promise<RecoveryResult<Json>>=>{calls++;await held;return{ok:true,record:record(m.data)}}
  const first=session.submit(data,0,adapter);const second=session.submit(data,0,adapter)
  data.narrative='Newer unsent edit'
  assert.equal(session.state,'sending')
  release();const [a,b]=await Promise.all([first,second])
  assert.equal(calls,1);assert.deepEqual(a,b)
  assert.deepEqual(session.localCopy(),{narrative:'Original',missing:null,zero:0})
  assert.equal(data.narrative,'Newer unsent edit')
  await session.submit({narrative:'Original',missing:null,zero:0},0,adapter)
  assert.equal(calls,1,'Identical acknowledged submit must not create another event')
})
test('offline/timeout and authorization failures retain payload and identity through retry/checkpoint',async()=>{
  const session=new MutationRecovery<Json>(target,caps)
  const seen:string[]=[];let calls=0
  const secret='synthetic-transport-only-token'
  const adapter=async(m:MutationEnvelope<Json>):Promise<RecoveryResult<Json>>=>{
    assert.ok(secret);seen.push(m.operationId);calls++
    if(calls===1)throw new DOMException('timeout','AbortError')
    if(calls===2){const error=new Error('code denied');error.name='StoreAuthError';throw error}
    return{ok:true,record:record(m.data)}
  }
  await session.submit({input:'invalid but retained'},0,adapter)
  const checkpoint=JSON.stringify(session.checkpoint())
  assert.ok(!checkpoint.includes(secret))
  const restored=new MutationRecovery<Json>(target,caps,JSON.parse(checkpoint))
  const auth=await restored.retry(adapter);assert.ok(!auth.ok);assert.equal(auth.status,401)
  assert.deepEqual(restored.localCopy(),{input:'invalid but retained'})
  const done=await restored.retry(adapter);assert.ok(done.ok)
  assert.equal(new Set(seen).size,1)
})
test('uncertain operations cannot be changed/reused with new content or another target',async()=>{
  const session=new MutationRecovery<Json>(target,caps)
  let calls=0
  const unavailable=async():Promise<RecoveryResult<Json>>=>{calls++;return{ok:false,status:503,body:apiError('unavailable')}}
  await session.submit({input:'A'},0,unavailable)
  const id=session.checkpoint()!.attempt.operationId
  const blocked=await session.submit({input:'B'},0,unavailable)
  assert.ok(!blocked.ok);assert.equal(blocked.body.error.code,'operation_reused')
  assert.equal(calls,1);assert.equal(session.checkpoint()!.attempt.operationId,id)
  assert.deepEqual(session.localCopy(),{input:'A'})
  assert.throws(()=>new MutationRecovery<Json>({...target,id:'other-record'},caps,session.checkpoint()!))
  const unsafe=JSON.parse(JSON.stringify(session.checkpoint()))
  unsafe.attempt.Authorization='synthetic-transport-only'
  assert.throws(()=>new MutationRecovery<Json>(target,caps,unsafe))
})
test('conflict reload/copy preserves local input and original base until explicit server selection',async()=>{
  const session=new MutationRecovery<Json>(target,caps);let calls=0
  const adapter=async():Promise<RecoveryResult<Json>>=>{calls++;return{ok:false,status:409,body:apiError('revision_conflict',{currentRevision:revision(4)!})}}
  await session.submit({name:'Local version'},2,adapter)
  await session.retry(adapter);assert.equal(calls,1,'No blind conflict retry')
  await session.reload(async()=>record({name:'Remote version'},4))
  assert.deepEqual(session.localCopy(),{name:'Local version'})
  assert.equal(session.checkpoint()!.attempt.baseRevision,2)
  assert.deepEqual(session.serverCopy()!.data,{name:'Remote version'})
  const reviewed=session.acceptServer();assert.equal(reviewed.revision,4)
  assert.equal(session.checkpoint(),null)
})
test('legacy/unavailable capability and malformed server snapshots fail closed without clearing input',async()=>{
  assert.throws(()=>new MutationRecovery(target,decodeCapabilities(404,null)))
  const session=new MutationRecovery<Json>(target,caps)
  const failed=await session.submit({name:'Keep'},0,async m=>({ok:true,record:{...record(m.data),id:recordId('other')!}}))
  assert.ok(!failed.ok);assert.equal(failed.body.error.code,'unavailable')
  assert.deepEqual(session.localCopy(),{name:'Keep'})
  await assert.rejects(session.reload(async()=>({...record({}),schemaVersion:2} as unknown as RecordEnvelope<Json>)))
})
test('single-flight guard resets after failure and allows a deliberate later retry',async()=>{
  const flight=new SingleFlight<void>();let calls=0
  const fail=()=>{calls++;return Promise.reject(new Error('offline'))}
  await Promise.allSettled([flight.run(fail),flight.run(fail)])
  assert.equal(calls,1)
  await flight.run(async()=>{calls++});assert.equal(calls,2)
})
test('inventory comparison uses stable IDs and retains raw units/names in either language',()=>{
  const yours:InventorySheet[]=[{id:'fixture-sheet',title:'Original title',useLabel:'Use',showSup:true,items:[{id:'item-1',name:'Nombre original',sup:'L',use:'1/2',gray:false}]}]
  const theirs=structuredClone(yours);theirs[0].items[0].name='Different name';theirs[0].items[0].use='3'
  assert.equal(isInventorySheets(yours),true)
  const rows=inventoryComparison(yours,theirs,key=>translate('es',key))
  assert.equal(rows.length,2)
  assert.ok(rows.some(row=>row.label.includes('Nombre') && row.yours==='Nombre original' && row.theirs==='Different name'))
  assert.ok(rows.some(row=>row.yours==='1/2' && row.theirs==='3'))
  assert.equal(yours[0].items[0].use,'1/2')
  assert.equal(isInventorySheets([{id:'bad',items:[null]}]),false)
  assert.equal(isInventorySheets([{...yours[0],items:[...yours[0].items,...yours[0].items]}]),false)
})
