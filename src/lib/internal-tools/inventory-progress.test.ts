import assert from 'node:assert/strict'
import test from 'node:test'
import { CHECK, DEFAULT_SHEETS, type InventoryCounts, type InventorySheet } from '../inventory'
import { countState, inventoryProgressTotals, inventoryProgressKey, readInventoryProgress, saveInventoryProgress, visibleInventory, type InventoryProgress } from './inventory-progress'
const catalog:InventorySheet[]=[{id:'source-sheet',title:'Source section',useLabel:'Use',showSup:true,items:['blank','zero','fraction','text','enough','skip','order-only'].map(id=>({id,name:id,sup:'D',use:'2',gray:false}))}]
const counts:InventoryCounts={zero:{inv:'0',order:'2'},fraction:{inv:'1 1/2',order:'1'},text:{inv:'3B/2T',order:''},enough:{inv:CHECK,order:''},'order-only':{inv:'',order:'4'}}
const envelope=():InventoryProgress=>({schemaVersion:1,storeId:'CR3',date:'2026-11-18',updatedAt:'2026-11-18T12:00:00Z',catalogRevision:2,catalog:structuredClone(catalog),counts:structuredClone(counts),skipped:['skip'],sectionId:'source-sheet'})
function device(){const data=new Map<string,string>();return{data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)}}}
test('zero/fractions/text/Enough/skips are distinct; orders do not mark a count entered',()=>{
 const skipped=new Set(['skip']);assert.deepEqual(catalog[0].items.map(item=>countState(counts,skipped,item.id)),['untouched','zero','measured','text','enough','skipped','untouched'])
 assert.deepEqual(inventoryProgressTotals(catalog,counts,skipped),{total:7,entered:3,enough:1,skipped:1,remaining:2})
 assert.equal(countState({...counts,skip:{inv:'0',order:''}},skipped,'skip'),'zero')
 const remaining=visibleInventory(catalog,counts,skipped,{suppliers:[],search:'',section:'source-sheet',mode:'remaining'});assert.deepEqual(remaining[0].items.map(item=>item.id),['blank','order-only'])
 const ordering=visibleInventory(catalog,counts,skipped,{suppliers:[],search:'',section:'',mode:'ordering'});assert.deepEqual(ordering[0].items.map(item=>item.id),['zero','fraction','order-only'])
 assert.equal(inventoryProgressTotals(catalog,counts,skipped).total,7)
})
test('device envelopes preserve raw notation, captured catalog and IDs across rename/removal, with legacy wire shapes',()=>{
 const storage=device(),value=envelope();assert.equal(saveInventoryProgress(storage,value).saved,true)
 value.catalog[0].items[0].name='Changed outside snapshot';value.catalog[0].items.pop()
 const recovered=readInventoryProgress(storage,'2026-11-18');assert.equal(recovered.state,'ready')
 if(recovered.state==='ready'){assert.equal(recovered.value.catalog[0].items[0].name,'blank');assert.equal(recovered.value.catalog[0].items.length,7);assert.equal(recovered.value.counts.fraction.inv,'1 1/2');assert.deepEqual(recovered.value.skipped,['skip'])}
 assert.deepEqual(Object.keys(JSON.parse(storage.getItem('cr-inventory')!)).sort(),['counts','date'])
 assert.equal(readInventoryProgress(storage,'2026-11-19').state,'missing')
})
test('unsupported/corrupt progress and legacy recovery bytes survive writes; denied storage reports failure',()=>{
 for(const raw of ['{broken',JSON.stringify({...envelope(),schemaVersion:99}),JSON.stringify({...envelope(),storeId:'CR2'})]) {
  const storage=device(),key=inventoryProgressKey('2026-11-18');storage.setItem(key,raw)
  assert.equal(readInventoryProgress(storage,'2026-11-18').state,'unreadable');assert.equal(saveInventoryProgress(storage,envelope()).saved,false);assert.equal(storage.getItem(key),raw)
 }
 const storage=device();storage.setItem('cr-inventory','{legacy recovery bytes');const result=saveInventoryProgress(storage,envelope());assert.equal(result.saved,false);assert.equal(result.sources[0].raw,'{legacy recovery bytes');assert.equal(storage.getItem('cr-inventory'),'{legacy recovery bytes')
 assert.equal(saveInventoryProgress({...storage,setItem(){throw new Error('quota')}},envelope()).saved,false)
})

test('reviewed catalog adoption preserves removed IDs and never moves counts to a same-name new ID',async()=>{
 const {mergeReviewedCatalog}=await import('./inventory-progress')
 const captured:InventorySheet[]=[{id:'section',useLabel:'Use',showSup:true,items:[{id:'old-id',name:'Same name',use:'2',sup:'D',gray:false},{id:'stable-id',name:'Before rename',use:'1',sup:'L',gray:false}]}]
 const current:InventorySheet[]=[{...captured[0],items:[{...captured[0].items[1],name:'After rename'},{...captured[0].items[0],id:'new-id'}]}]
 const merged=mergeReviewedCatalog(captured,current),values={ 'old-id':{inv:'1/2',order:'2'},'stable-id':{inv:'0',order:'1'} }
 assert.deepEqual(merged[0].items.map(item=>item.id),['stable-id','new-id','old-id'])
 assert.equal(merged[0].items[0].name,'After rename');assert.equal(countState(values,new Set(),'new-id'),'untouched');assert.equal(countState(values,new Set(),'old-id'),'measured')
 assert.deepEqual(inventoryProgressTotals(merged,values,new Set()),{total:3,entered:2,enough:0,skipped:0,remaining:1})
})

test('built-in paper catalog with optional undefined notes checkpoints and resumes exact counts',()=>{
 const storage=device(),value={...envelope(),catalog:structuredClone(DEFAULT_SHEETS),sectionId:DEFAULT_SHEETS[0].id}
 const first=DEFAULT_SHEETS[0].items[0].id;value.counts={[first]:{inv:'3B/2T',order:''}};value.skipped=[]
 assert.equal(saveInventoryProgress(storage,value).saved,true)
 const recovered=readInventoryProgress(storage,value.date);assert.equal(recovered.state,'ready')
 if(recovered.state==='ready'){assert.equal(recovered.value.counts[first].inv,'3B/2T');assert.equal(recovered.value.catalog.length,DEFAULT_SHEETS.length)}
})
