import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {getPlatformProxy,unstable_splitSqlQuery} from 'wrangler'
import {createJiti} from 'jiti'
const jiti=createJiti(import.meta.url)
const {default:worker}=await jiti.import('./index.ts')
const {saveHoursEvent,saveHoursReview,hoursRecords}=await jiti.import('./special-hours.ts')
const {expandTemplate}=await jiti.import('../../src/lib/scheduler/data.ts')
const {DAYS}=await jiti.import('../../src/lib/scheduler/types.ts')
const {hoursBaseFingerprint,suggestedHoursDecisions,resolveSpecialHours}=await jiti.import('../../src/lib/scheduler/special-hours.ts')
const {buildScheduleSnapshot}=await jiti.import('../../src/lib/schedule-snapshot.ts')
const {templateHashForSlots}=await jiti.import('../../src/lib/schedule-share.ts')
const week='2026-11-22',date='2026-11-26',store='CR3',station='CR3-diningroom',token='synthetic-hours-token'
const template=Object.fromEntries(DAYS.map(day=>[day,[{period:'PM',role:'server',label:'Evening',start:960,end:1320,required:true},{period:'PM',role:'server',label:'Late',start:1200,end:1320,required:false}]]))
const event=(mode='closed',label='Thanksgiving')=>({version:1,date,mode,closeMinute:mode==='early'?1140:null,label})
const mutation=(data,baseRevision=0,operationId=crypto.randomUUID())=>({mutation:{schemaVersion:1,baseRevision,operationId,data}})
function reviewInput(source,target=station,base=expandTemplate(template,week).filter(s=>s.date===date),prior=0){return {...mutation({version:1,date,stationId:target,eventRevision:source.revision,event:source.data,baseFingerprint:hoursBaseFingerprint(base),decisions:suggestedHoursDecisions(base,source.data)},prior),baseSlots:buildScheduleSnapshot(base).slots}}
async function database(fn){const platform=await getPlatformProxy({configPath:'worker/wrangler.local.jsonc',persist:false,remoteBindings:false});try{
  for(const name of ['0001_core.sql','0002_domain_relations.sql','0003_atomic_history.sql'])await platform.env.INTERNAL_DB.batch(unstable_splitSqlQuery(await readFile('worker/migrations/'+name,'utf8')).map(sql=>platform.env.INTERNAL_DB.prepare(sql)))
  await fn({...platform.env,SCHEDULE_WRITE_TOKEN:token})
}finally{await platform.dispose()}}
async function api(env,path,method='GET',body,code=token){return worker.fetch(new Request('http://local'+path,{method,headers:{Authorization:'Bearer '+code,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env)}

test('dated events are atomic, retryable, isolated by store, and station reviews have independent revisions',async()=>database(async env=>{
  const db=env.INTERNAL_DB,input=mutation(event('early'),0,'create-event'),created=await saveHoursEvent(db,store,date,input)
  assert.ok(created.ok);assert.equal(created.record.revision,1)
  const competing=await Promise.all(['Storm','Holiday'].map(label=>saveHoursEvent(db,store,date,mutation(event('early',label),1))))
  assert.equal(competing.filter(r=>r.ok).length,1);assert.equal(competing.find(r=>!r.ok).status,409)
  assert.deepEqual(await saveHoursEvent(db,store,date,input),{...created,replayed:true})
  const latest=(await hoursRecords(db,store,date,date)).events[0]
  const dining=await saveHoursReview(db,store,station,date,reviewInput(latest));assert.ok(dining.ok)
  const kitchen=await saveHoursReview(db,store,'CR3-kitchen',date,reviewInput(latest,'CR3-kitchen'));assert.ok(kitchen.ok)
  assert.equal(dining.record.revision,1);assert.equal(kitchen.record.revision,1)
  assert.equal((await hoursRecords(db,'CR2',date,date)).events.length,0)
  assert.equal((await hoursRecords(db,store,'2026-11-29','2026-12-05')).events.length,0)
  assert.equal((await db.prepare('SELECT count(*) n FROM change_events').first()).n,4)
}))
test('stale source reviews and invalid cleanup choices are refused, while confirmed retries replay once',async()=>database(async env=>{
  const db=env.INTERNAL_DB,created=await saveHoursEvent(db,store,date,mutation(event('early'))),input=reviewInput(created.record)
  const saved=await saveHoursReview(db,store,station,date,input);assert.ok(saved.ok)
  assert.deepEqual(await saveHoursReview(db,store,station,date,input),{...saved,replayed:true})
  const invalid=structuredClone(input);invalid.mutation.baseRevision=1;invalid.mutation.operationId='invalid-finish';invalid.mutation.data.decisions[0].end=900
  assert.equal((await saveHoursReview(db,store,station,date,invalid)).status,400)
  await saveHoursEvent(db,store,date,mutation(event('closed'),1))
  const stale=reviewInput(created.record);stale.mutation.baseRevision=1
  assert.equal((await saveHoursReview(db,store,station,date,stale)).status,409)
}))
test('manager API validates scope and unconfigured service; publication must match the latest reviewed event and shifts',async()=>database(async env=>{
  const endpoint=`/api/internal/special-hours/${store}`,created=await api(env,endpoint+'/'+date,'PUT',mutation(event('early')))
  assert.equal(created.status,200);const source=(await created.json()).record
  assert.equal((await api(env,endpoint+'?start='+week+'&end=2026-11-28','GET',undefined,'wrong')).status,401)
  assert.equal((await api({...env,INTERNAL_DB:undefined},endpoint+'?start='+week+'&end=2026-11-28')).status,503)
  assert.equal((await api(env,endpoint+'/'+date+'/review/CR2-kitchen','PUT',reviewInput(source))).status,400)
  for(const target of [station,'CR3-kitchen']){
    assert.equal((await api(env,`/api/template?restaurant=${target}&weekStart=${week}`,'PUT',{template,baseRev:0})).status,201)
    assert.equal((await api(env,endpoint+'/'+date+'/review/'+target,'PUT',reviewInput(source,target))).status,200)
  }
  const data=await hoursRecords(env.INTERNAL_DB,store,week,'2026-11-28'),base=expandTemplate(template,week),effective=resolveSpecialHours(base,data.events,data.reviews,station)
  const snapshot=buildScheduleSnapshot(effective.slots,'published',effective.days)
  const body={week:{version:1,weekStart:week,name:'Synthetic hours',people:['Synthetic'],slotPeople:effective.slots.map(()=>0)},snapshot,templateHash:templateHashForSlots(effective.slots),visible:true,baseRev:0}
  const publish=`/api/schedule/${week}?restaurant=${station}`
  assert.equal((await api(env,publish,'PUT',{...body,snapshot:buildScheduleSnapshot(base),templateHash:templateHashForSlots(base),week:{...body.week,slotPeople:base.map(()=>0)}})).status,409)
  assert.equal((await api(env,publish,'PUT',body)).status,201)
  const page=await(await api(env,endpoint+'?start='+week+'&end=2026-11-28')).json()
  assert.equal(page.stations.find(s=>s.stationId===station).published.eventRevision,1)
  assert.equal(page.stations.find(s=>s.stationId==='CR3-kitchen').published,null)
  const before=await env.SCHEDULES.get(`r:${station}:golden:${week}`)
  const unavailable={...env,INTERNAL_DB:undefined}
  const absent=await api(unavailable,endpoint+'?start='+week+'&end=2026-11-28')
  assert.equal(absent.status,503);assert.equal((await absent.json()).error.code,'unavailable')
  const bypass={...body,baseRev:1,snapshot:buildScheduleSnapshot(base),templateHash:templateHashForSlots(base),week:{...body.week,slotPeople:base.map(()=>0)}}
  assert.equal((await api(unavailable,publish,'PUT',bypass)).status,503)
  assert.equal(await env.SCHEDULES.get(`r:${station}:golden:${week}`),before)
  await api(env,endpoint+'/'+date,'PUT',mutation(event('closed'),1))
  assert.equal((await api(env,publish,'PUT',{...body,baseRev:1})).status,409)
  assert.equal(await env.SCHEDULES.get(`r:${station}:golden:${week}`),before)
  const staff=await(await api(env,publish)).json();assert.equal(staff.snapshot.specialHours[0].mode,'early')
}))
test('all seven explicit closures publish zero assignments and remain distinct from empty normal weeks',async()=>database(async env=>{
  const base=expandTemplate(template,week)
  await api(env,`/api/template?restaurant=${station}&weekStart=${week}`,'PUT',{template,baseRev:0})
  for(let i=0;i<7;i++){
    const d=new Date(Date.parse(week+'T00:00:00Z')+i*86400000).toISOString().slice(0,10),data={...event(),date:d}
    const created=await saveHoursEvent(env.INTERNAL_DB,store,d,mutation(data));assert.ok(created.ok)
    const day=base.filter(s=>s.date===d),input={...mutation({version:1,date:d,stationId:station,eventRevision:1,event:data,baseFingerprint:hoursBaseFingerprint(day),decisions:[]}),baseSlots:buildScheduleSnapshot(day).slots}
    assert.ok((await saveHoursReview(env.INTERNAL_DB,store,station,d,input)).ok)
  }
  const data=await hoursRecords(env.INTERNAL_DB,store,week,'2026-11-28'),resolved=resolveSpecialHours(base,data.events,data.reviews,station)
  assert.equal(resolved.slots.length,0);assert.equal(resolved.pending.length,0)
  const snapshot=buildScheduleSnapshot([],'published',resolved.days),body={week:{version:1,weekStart:week,name:'Closed week',people:[],slotPeople:[]},snapshot,templateHash:templateHashForSlots([]),visible:true,baseRev:0}
  assert.equal((await api(env,`/api/schedule/${week}?restaurant=${station}`,'PUT',body)).status,201)
  const staff=await(await api(env,`/api/schedule/${week}?restaurant=${station}`)).json()
  assert.equal(staff.snapshot.specialHours.length,7);assert.deepEqual(staff.week.slotPeople,[])
}))
