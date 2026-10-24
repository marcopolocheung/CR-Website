import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{getPlatformProxy,unstable_splitSqlQuery}from'wrangler';import{createJiti}from'jiti';
const jiti=createJiti(import.meta.url);const{historySnapshot}=await jiti.import('../../scripts/fixtures/import-history.ts');const{historyData}=await jiti.import('../../src/lib/converter/import-history.ts');const{saveHistory,historyRecord,historyPage}=await jiti.import('./import-history.ts');
async function database(fn){const p=await getPlatformProxy({configPath:'worker/wrangler.local.jsonc',persist:false,remoteBindings:false});try{for(const name of ['0001_core.sql','0002_domain_relations.sql','0003_atomic_history.sql'])await p.env.INTERNAL_DB.batch(unstable_splitSqlQuery(await readFile('worker/migrations/'+name,'utf8')).map(s=>p.env.INTERNAL_DB.prepare(s)));await fn(p.env.INTERNAL_DB)}finally{await p.dispose()}}
const input=(id,data,operation='create')=>({id,mutation:{schemaVersion:1,baseRevision:0,operationId:operation,data}})
test('same source identity has one immutable root; retry and deliberate reprocessing preserve history',async()=>{
 await database(async db=>{
  const data=await historyData(historySnapshot(),'Synthetic reviewer'),id='imp_'+data.identity,body=input(id,data)
  const attempts=await Promise.all([saveHistory(db,'CR3',body),saveHistory(db,'CR3',input(id,data,'other-writer'))]);assert.equal(attempts.filter(r=>r.ok).length,1);assert.equal(attempts.find(r=>!r.ok).status,409)
  const success=attempts.find(r=>r.ok),winner=success===attempts[0]?body:input(id,data,'other-writer');assert.deepEqual(await saveHistory(db,'CR3',winner),{...success,replayed:true})
  const newer=await historyData(historySnapshot(),'Synthetic reprocessor',id),child='10000000-0000-4000-8000-000000000010'
  assert.ok((await saveHistory(db,'CR3',input(child,newer,'reprocess'))).ok)
  assert.equal((await historyRecord(db,'CR3',id)).data.reviewedBy,'Synthetic reviewer')
  assert.equal((await historyRecord(db,'CR3',child)).data.supersedesId,id)
  assert.equal((await historyPage(db,'CR3','hours','2026-10-01','2026-10-31','')).records.length,2)
  assert.equal((await historyPage(db,'CR3','hours','2026-10-02','2026-10-31','')).records.length,0)
  assert.equal((await historyPage(db,'CR2','hours','2026-10-01','2026-10-31','')).records.length,0)
  assert.equal((await db.prepare('SELECT count(*) n FROM change_events').first()).n,2)
 })
})
test('forged identity, raw bodies, overwritten history and wrong-context lineage fail without mutation',async()=>{
 await database(async db=>{
  const data=await historyData(historySnapshot(),'Synthetic reviewer'),id='imp_'+data.identity
  assert.equal((await saveHistory(db,'CR3',input(id,{...data,identity:'f'.repeat(64)}))).status,400)
  assert.equal((await saveHistory(db,'CR3',input(id,{...data,rawFile:'not-allowed'}))).status,400)
  assert.equal((await saveHistory(db,'CR3',{...input(id,data),mutation:{...input(id,data).mutation,baseRevision:1}})).status,400)
  assert.equal((await saveHistory(db,'CR3',input('10000000-0000-4000-8000-000000000010',{...data,supersedesId:'missing'}))).status,400)
  assert.equal((await db.prepare('SELECT count(*) n FROM records').first()).n,0)
 })
})
