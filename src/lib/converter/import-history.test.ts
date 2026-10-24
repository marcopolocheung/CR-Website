import test from 'node:test'
import assert from 'node:assert/strict'
import { historySnapshot } from '../../../scripts/fixtures/import-history'
import { historyIdentity, historyData, validHistoryData } from './import-history'
import { readSalesFile } from './validation'
import { salesFixtures } from '../../../scripts/fixtures/imports'
import * as XLSX from 'xlsx'
test('source identity uses bytes/context/parser/mapping revision, never filename or upload time',async()=>{
 const first=historySnapshot(),renamed=historySnapshot();renamed.sourceName='renamed.csv'
 assert.equal(await historyIdentity(first),await historyIdentity(renamed))
 renamed.metadata.fingerprint='sha256:'+'c'.repeat(64);assert.notEqual(await historyIdentity(first),await historyIdentity(renamed))
 renamed.metadata.fingerprint=first.metadata.fingerprint;renamed.metadata.startDate='2026-10-02';assert.notEqual(await historyIdentity(first),await historyIdentity(renamed))
})
test('history retains reviewed values and output metadata without raw uploads or workbook bytes',async()=>{
 const snapshot=historySnapshot(),data=await historyData(snapshot,'Synthetic reviewer')
 assert.equal(validHistoryData(data,'CR3'),true);assert.equal(validHistoryData(data,'CR2'),false)
 assert.equal(data.snapshot.output,null);assert.equal(data.output.sha256,snapshot.output!.sha256)
 assert.equal(JSON.stringify(data).includes('base64'),false)
 assert.equal(validHistoryData({...data,token:'secret'},'CR3'),false)
 assert.equal(validHistoryData({...data,snapshot:{...data.snapshot,output:snapshot.output}},'CR3'),false)
 assert.equal(validHistoryData({...data,sources:[{...data.sources[0],fingerprint:'filename-only'}]},'CR3'),false)
 assert.equal(validHistoryData({...data,output:{...data.output,filename:'wrong.xlsx'}},'CR3'),false)
})
test('deliberate reprocess preserves explicit lineage and source exception rows',async()=>{
 const snapshot=historySnapshot();snapshot.rows.push({...snapshot.rows[0],__sourceRow:10,'Out Date':''})
 const data=await historyData(snapshot,'Synthetic reviewer','earlier-import')
 assert.equal(data.supersedesId,'earlier-import');assert.equal(validHistoryData(data,'CR3'),true)
 if(data.snapshot.kind==='hours')assert.equal(data.snapshot.rows.length,4)
})
test('sales source fingerprint comes from the exact bytes read once',async()=>{
 const bytes=XLSX.write(salesFixtures().general,{type:'array',bookType:'xlsx'}) as ArrayBuffer
 let reads=0
 const file={name:'source.xlsx',size:bytes.byteLength,arrayBuffer:async()=>{reads++;return bytes}}
 const result=await readSalesFile(file,'general');assert.ok(result.value);assert.equal(reads,1)
 const digest=await crypto.subtle.digest('SHA-256',bytes)
 assert.equal(result.fingerprint,'sha256:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''))
})
