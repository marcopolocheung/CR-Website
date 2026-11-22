import test from 'node:test';import assert from 'node:assert/strict';import{getPlatformProxy}from'wrangler';import{createJiti}from'jiti';
const jiti=createJiti(import.meta.url);const{default:worker,goldenKey}=await jiti.import('./index.ts');const{defaultTemplateForRestaurant,expandTemplate}=await jiti.import('../../src/lib/scheduler/data.ts');const{templateHashForSlots}=await jiti.import('../../src/lib/schedule-share.ts');
const {buildScheduleSnapshot}=await jiti.import('../../src/lib/schedule-snapshot.ts')
test('manager-only published snapshot reader preserves KV and marks missing/hidden weeks explicitly',async()=>{
 const proxy=await getPlatformProxy({configPath:'worker/wrangler.local.jsonc',persist:false,remoteBindings:false})
 try{
 const env={...proxy.env,SCHEDULE_WRITE_TOKEN:'synthetic-reader-token'},slots=expandTemplate(defaultTemplateForRestaurant('CR3-kitchen')),doc={v:3,weekStart:'2026-10-18',rev:2,updatedAt:'2026-10-19T12:00:00.000Z',visible:true,templateHash:templateHashForSlots(slots),week:{version:1,weekStart:'2026-10-18',name:'Synthetic',people:['Synthetic'],slotPeople:slots.map((_,i)=>i===0?0:-1)}}
 const key=goldenKey('2026-10-18','CR3-kitchen'),original=JSON.stringify(doc);await env.SCHEDULES.put(key,original)
 const url='http://local/api/internal/import-schedules/CR3?start=2026-10-18&end=2026-10-24',headers={Authorization:'Bearer synthetic-reader-token'}
 assert.equal((await worker.fetch(new Request(url),env)).status,401)
 const response=await worker.fetch(new Request(url,{headers}),env);assert.equal(response.status,200);const page=await response.json();assert.equal(page.publications.length,2)
 const published=page.publications.find(p=>p.stationId==='CR3-kitchen');assert.equal(published.status,'published');assert.equal(published.revision,2);assert.match(published.fingerprint,/^sha256:/);assert.equal(published.timingBasis,'legacy-estimate');assert.ok(published.ruleFingerprint)
 assert.equal(page.publications.find(p=>p.stationId==='CR3-diningroom').status,'missing');assert.equal(await env.SCHEDULES.get(key),original)
 await env.SCHEDULES.put(key,JSON.stringify({...doc,visible:false}));const hidden=await(await worker.fetch(new Request(url,{headers}),env)).json();assert.equal(hidden.publications.find(p=>p.stationId==='CR3-kitchen').status,'hidden');assert.equal(hidden.publications.find(p=>p.stationId==='CR3-kitchen').assignments.length,0)
 assert.equal((await worker.fetch(new Request('http://local/api/internal/import-schedules/CR3?start=2026-01-01&end=2026-12-31',{headers}),env)).status,400)
 }finally{await proxy.dispose()}
})

test('real local KV keeps published times stable through rule saves and a failed publication',async()=>{
 const proxy=await getPlatformProxy({configPath:'worker/wrangler.local.jsonc',persist:false,remoteBindings:false})
 try{
 const env={...proxy.env,INTERNAL_DB:undefined,SCHEDULE_WRITE_TOKEN:'synthetic-snapshot-token'},headers={Authorization:'Bearer synthetic-snapshot-token','Content-Type':'application/json'}
 const station='CR3-kitchen',week='2026-11-22',template=defaultTemplateForRestaurant(station),slots=expandTemplate(template)
 const body={week:{version:1,weekStart:week,name:'Synthetic snapshot',people:['Synthetic'],slotPeople:slots.map((_,i)=>i===0?0:-1)},templateHash:templateHashForSlots(slots),snapshot:buildScheduleSnapshot(slots),visible:true,baseRev:0}
 const publish=(data)=>worker.fetch(new Request(`http://local/api/schedule/${week}?restaurant=${station}`,{method:'PUT',headers,body:JSON.stringify(data)}),env)
 assert.equal((await publish(body)).status,201)
 const original=await env.SCHEDULES.get(goldenKey(week,station))
 const changed=structuredClone(template);changed.Sunday[0].end-=60
 assert.equal((await worker.fetch(new Request(`http://local/api/template?restaurant=${station}&weekStart=${week}`,{method:'PUT',headers,body:JSON.stringify({template:changed,baseRev:0})}),env)).status,201)
 assert.equal(await env.SCHEDULES.get(goldenKey(week,station)),original)
 const next={...body,snapshot:buildScheduleSnapshot(expandTemplate(changed))}
 assert.equal((await publish(next)).status,409)
 const url=`http://local/api/internal/import-schedules/CR3?start=${week}&end=2026-11-28`
 const read=async()=>{const response=await worker.fetch(new Request(url,{headers}),env);assert.equal(response.status,200);return(await response.json()).publications.find(p=>p.stationId===station)}
 const before=await read();assert.equal(before.timingBasis,'published-snapshot');assert.equal(before.assignments[0].end,slots[0].end)
 assert.equal((await publish({...next,baseRev:1})).status,200)
 const after=await read();assert.equal(after.assignments[0].end,slots[0].end-60);assert.equal(after.revision,2)
 }finally{await proxy.dispose()}
})
