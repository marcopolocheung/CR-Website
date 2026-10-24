import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyDirectory, mapHours, validDirectory, ambiguousNames, sourceEmployeeKey } from './employee-mapping'
import { hoursRecords } from '../../../scripts/fixtures/imports'
import { validateHoursRows } from './validation'
const one='10000000-0000-4000-8000-000000000001',two='10000000-0000-4000-8000-000000000002',map='10000000-0000-4000-8000-000000000003'
const fingerprint='sha256:'+'a'.repeat(64)
const rows=()=>validateHoursRows(hoursRecords,[],true).value!
test('same names are distinct and never matched without reviewed scoped IDs',()=>{
 const data=emptyDirectory(),input=rows();input[0].Employee='Same Name';input[1].Employee='Same Name'
 data.employees=[{id:one,name:'Same Name',active:true},{id:two,name:'Same Name',active:false}]
 assert.equal(mapHours(input,data,'CR3',fingerprint).every(r=>!r.employee),true)
 assert.equal(ambiguousNames(input,mapHours(input,data,'CR3',fingerprint)),true)
 data.mappings=[{id:map,system:'toast',scope:'CR3',externalId:'EMP-B',employeeId:two,from:'2026-10-01',until:'2026-10-31',reviewedBy:'Synthetic reviewer'}]
 assert.equal(validDirectory(data,'CR3'),true)
 assert.equal(mapHours(input,data,'CR3',fingerprint)[0].employee?.active,false)
 assert.equal(mapHours(input,data,'CR2',fingerprint)[0].employee,null)
 data.employees[1].name='Renamed';assert.equal(mapHours(input,data,'CR3',fingerprint)[0].employee?.id,two)
})
test('missing external IDs use exact fingerprint and physical row, never a guessed name',()=>{
 const input=rows()[0];input['Employee External Id']=''
 assert.equal(sourceEmployeeKey(input,''),null);assert.equal(sourceEmployeeKey(input,fingerprint),`row:${fingerprint}:2`)
 const data=emptyDirectory();data.employees=[{id:one,name:'Explicit identity',active:true}]
 data.mappings=[{id:map,system:'toast',scope:'CR3',externalId:sourceEmployeeKey(input,fingerprint)!,employeeId:one,from:'2026-10-01',until:null,reviewedBy:'Synthetic'}]
 assert.equal(mapHours([input],data,'CR3',fingerprint)[0].employee?.id,one)
 assert.equal(mapHours([input],data,'CR3','sha256:'+'b'.repeat(64))[0].employee,null)
})
test('unknown fields, guessed IDs, missing provenance and overlapping effective mappings fail validation',()=>{
 const data=emptyDirectory();data.employees=[{id:one,name:'Synthetic',active:true}]
 assert.equal(validDirectory({...data,token:'secret'},'CR3'),false)
 assert.equal(validDirectory({...data,employees:[{id:'name-derived',name:'Synthetic',active:true}]},'CR3'),false)
 data.mappings=[{id:map,system:'toast',scope:'CR3',externalId:'source',employeeId:one,from:'2026-10-01',until:'2026-10-31',reviewedBy:'Synthetic'}]
 assert.equal(validDirectory(data,'CR3'),true)
 assert.equal(validDirectory({...data,mappings:[...data.mappings,{...data.mappings[0],id:two}]},'CR3'),false)
 assert.equal(validDirectory({...data,mappings:[{...data.mappings[0],reviewedBy:''}]},'CR3'),false)
 assert.equal(validDirectory({...data,mappings:[{...data.mappings[0],scope:'CR2'}]},'CR3'),false)
})
