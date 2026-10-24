import test from 'node:test';import assert from 'node:assert/strict';import{getPlatformProxy}from'wrangler';import{createJiti}from'jiti';
const jiti=createJiti(import.meta.url);const{default:worker,goldenKey}=await jiti.import('./index.ts');const{defaultTemplateForRestaurant,expandTemplate}=await jiti.import('../../src/lib/scheduler/data.ts');const{templateHashForSlots}=await jiti.import('../../src/lib/schedule-share.ts');
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
