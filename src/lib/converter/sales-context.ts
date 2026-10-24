import * as XLSX from 'xlsx'
import { businessDate, isStoreId, type StoreId } from '../internal-tools/contracts'
import { importStore } from './import-snapshot'
import { sourceTime, weekday, DATE_POLICY } from './business-date'
import type { SalesSources } from './sales-review'
export type CashoutLink={ storeId: StoreId; date: string; updatedAt: string; revision: string }
export type SalesContext={ policy: string; sources: {slot: string; dates:string[]; stores:string[]; uncertain:boolean}[]; reason:string; cashout:CashoutLink|null }
export function salesContext(sources:SalesSources,cashout:CashoutLink|null=null):SalesContext {
 return {policy:DATE_POLICY,reason:'',cashout,sources:Object.entries(sources).map(([slot,source])=>{
   const dates=new Set<string>(),stores=new Set<string>();let uncertain=false
   for(const name of source.workbook.SheetNames){
    const records=XLSX.utils.sheet_to_json<Record<string,unknown>>(source.workbook.Sheets[name])
    for(const row of records)for(const [key,value] of Object.entries(row)){
      if(/^(business date|date|start date|end date)$/i.test(key)){
       const serial=typeof value==='number'?XLSX.SSF.parse_date_code(value):null
       const raw=serial?`${String(serial.y).padStart(4,'0')}-${String(serial.m).padStart(2,'0')}-${String(serial.d).padStart(2,'0')}`:String(value??'')
       const parsed=sourceTime(raw);if(!parsed.issue&&parsed.date)dates.add(parsed.date);else uncertain=true
      }
      if(/^(store|location|restaurant)$/i.test(key)){
       const raw=String(value??'').trim(),store=isStoreId(raw)?raw:importStore(raw)
       if(store)stores.add(store);else uncertain=true
      }
    }
   }
   return {slot,dates:[...dates],stores:[...stores],uncertain}
 })}
}
export function needsContextReview(context:SalesContext|undefined,date:string,store:StoreId|null):boolean {
 return !context||!businessDate(date)||!store||context.sources.some(s=>s.uncertain||s.dates.length!==1||s.dates[0]!==date||s.stores.length!==1||s.stores[0]!==store)
}
export function validSalesContext(value:unknown):value is SalesContext {
 if(!value||typeof value!=='object')return false
 const v=value as SalesContext
 return Object.keys(v).every(k=>['policy','sources','reason','cashout'].includes(k))&&v.policy===DATE_POLICY&&typeof v.reason==='string'&&v.reason.length<=1000&&Array.isArray(v.sources)&&v.sources.length===3&&new Set(v.sources.map(s=>s.slot)).size===3&&v.sources.every(s=>['general','lunch','dinner'].includes(s.slot)&&Object.keys(s).every(k=>['slot','dates','stores','uncertain'].includes(k))&&typeof s.uncertain==='boolean'&&Array.isArray(s.dates)&&s.dates.every(d=>businessDate(d))&&Array.isArray(s.stores)&&s.stores.every(isStoreId))&&(v.cashout===null||!!v.cashout&&Object.keys(v.cashout).every(k=>['storeId','date','updatedAt','revision'].includes(k))&&isStoreId(v.cashout.storeId)&&!!businessDate(v.cashout.date)&&typeof v.cashout.updatedAt==='string'&&Number.isFinite(Date.parse(v.cashout.updatedAt))&&/^sha256:[a-f0-9]{64}$/.test(v.cashout.revision))
}
export {weekday}
