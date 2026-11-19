import assert from 'node:assert/strict'
import test from 'node:test'
import { checkpointImport } from './import-checkpoint'
import { isImportSnapshot, type ImportSnapshot } from './import-snapshot'
import { validateHoursRows } from './validation'
import { hoursRecords } from '../../../scripts/fixtures/imports'
import { readDraft } from '../internal-tools/drafts'
const snapshot: ImportSnapshot = { version:1,kind:'hours',sourceName:'synthetic.csv',rows:validateHoursRows(hoursRecords).value!,metadata:{location:'CHINA ROSE #3 - 7046 W MILITARY DR',startDate:'2026-10-01',endDate:'2026-10-31',preparer:'Synthetic'},output:null }
function device() { const values=new Map<string,string>();return {values,get length(){return values.size},key:(index:number)=>[...values.keys()][index]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}} }
test('replacement checkpoints add independent compatible device copies and retain original recovery bytes',()=>{
 const storage=device();storage.setItem('unreadable-recovery','{future bytes')
 assert.equal(checkpointImport(storage,snapshot,'Synthetic'),true)
 const first=[...storage.values].find(([key])=>key!=='unreadable-recovery')!
 assert.equal(checkpointImport(storage,snapshot,'Second editor'),true)
 assert.equal(storage.values.size,3);assert.equal(storage.getItem(first[0]),first[1]);assert.equal(storage.getItem('unreadable-recovery'),'{future bytes')
 const source=readDraft(first[0],first[1],isImportSnapshot);assert.equal(source.state,'ready')
 if(source.state==='ready')assert.deepEqual(source.draft.payload,snapshot)
})
test('unprepared work, missing preparer, invalid snapshots and denied storage cannot authorize replacement',()=>{
 const storage=device()
 assert.equal(checkpointImport(storage,null,'Synthetic'),false)
 assert.equal(checkpointImport(storage,snapshot,''),false)
 assert.equal(checkpointImport(storage,{...snapshot,version:99} as unknown as ImportSnapshot,'Synthetic'),false)
 assert.equal(checkpointImport({...storage,setItem(){throw new Error('quota')}},snapshot,'Synthetic'),false)
 assert.equal(storage.values.size,0)
})
