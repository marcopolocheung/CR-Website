import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {getPlatformProxy,unstable_splitSqlQuery} from 'wrangler';import {createJiti} from 'jiti';
const jiti=createJiti(import.meta.url);const {saveDirectory,directoryRecord}=await jiti.import('./import-directory.ts');const {default:worker}=await jiti.import('./index.ts');
const one='10000000-0000-4000-8000-000000000001',two='10000000-0000-4000-8000-000000000002';
const directory=()=>({version:1,hourTargets:'disabled',employees:[{id:one,name:'Same name',active:true},{id:two,name:'Same name',active:false}],mappings:[]});
const input=(base,operation,data=directory())=>({preparer:'Synthetic reviewer',mutation:{schemaVersion:1,baseRevision:base,operationId:operation,data}})
async function database(fn){const p=await getPlatformProxy({configPath:'worker/wrangler.local.jsonc',persist:false,remoteBindings:false});try{for(const name of ['0001_core.sql','0002_domain_relations.sql','0003_atomic_history.sql'])await p.env.INTERNAL_DB.batch(unstable_splitSqlQuery(await readFile('worker/migrations/'+name,'utf8')).map(s=>p.env.INTERNAL_DB.prepare(s)));await fn(p.env)}finally{await p.dispose()}}
test('directory writes atomically preserve inactive identities and history, CAS conflicts and exact retry',async()=>{
 await database(async({INTERNAL_DB:db})=>{
  const first=await saveDirectory(db,'CR3',input(0,'create'));assert.ok(first.ok);assert.equal(first.record.revision,1)
  assert.deepEqual((await directoryRecord(db,'CR3')).data,directory());assert.equal(await directoryRecord(db,'CR2'),null)
  const changed=directory();changed.employees[0].name='Renamed'
  const attempts=await Promise.all([saveDirectory(db,'CR3',input(1,'edit-a',changed)),saveDirectory(db,'CR3',input(1,'edit-b',directory()))]);assert.equal(attempts.filter(r=>r.ok).length,1);assert.equal(attempts.find(r=>!r.ok).status,409)
  assert.deepEqual(await saveDirectory(db,'CR3',input(0,'create')),{...first,replayed:true})
  const removed=directory();removed.employees.pop();assert.equal((await saveDirectory(db,'CR3',input(2,'delete-history',removed))).status,400)
  assert.equal((await db.prepare('SELECT count(*) AS n FROM change_events').first()).n,2)
  const original=await db.prepare('SELECT snapshot_json FROM change_events WHERE revision=1').first();assert.equal(JSON.parse(original.snapshot_json).data.employees[1].active,false)
 })
})
test('manager-only additive route distinguishes absent backend, unauthorized and saved result',async()=>{
 await database(async env=>{
  const path='http://local/api/internal/import-directory/CR3';const configured={...env,SCHEDULE_WRITE_TOKEN:'synthetic-secret'}
  assert.equal((await worker.fetch(new Request(path),configured)).status,401)
  assert.equal((await worker.fetch(new Request(path,{headers:{Authorization:'Bearer synthetic-secret'}}),{SCHEDULES:env.SCHEDULES,SCHEDULE_WRITE_TOKEN:'synthetic-secret'})).status,503)
  const response=await worker.fetch(new Request(path,{method:'PUT',headers:{Authorization:'Bearer synthetic-secret','Content-Type':'application/json'},body:JSON.stringify(input(0,'route-create'))}),configured)
  assert.equal(response.status,200);assert.equal((await response.json()).record.revision,1)
  const loaded=await worker.fetch(new Request(path,{headers:{Authorization:'Bearer synthetic-secret'}}),configured);assert.equal((await loaded.json()).record.data.employees.length,2)
 })
})
