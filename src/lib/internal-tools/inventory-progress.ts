import { CHECK, filterBySupplier, parseAmount, suggestOrder, type InventoryCounts, type InventorySheet } from '../inventory'
import { businessDate } from './contracts'
import { isInventorySheets } from './inventory-recovery'

export const INVENTORY_LEGACY_KEY = 'cr-inventory'
export const inventoryProgressKey = (date: string) => `cr-inventory-progress:v1:CR3:${date}`
export type InventoryProgress = { schemaVersion: 1; storeId: 'CR3'; date: string; updatedAt: string; catalogRevision: number; catalog: InventorySheet[]; counts: InventoryCounts; skipped: string[]; sectionId: string | null }
export type CountState = 'untouched' | 'zero' | 'measured' | 'text' | 'enough' | 'skipped'
type Store = Pick<Storage,'getItem'|'setItem'>
export type DeviceRead<T> = { state:'ready'; value:T } | { state:'missing' } | { state:'unreadable'; key:string; raw:string } | { state:'unavailable' }
export function validInventoryCounts(value: unknown): value is InventoryCounts {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(entry =>
    !!entry && typeof entry === 'object' && !Array.isArray(entry) && Object.entries(entry).every(([key,v]) =>
      (key === 'inv' || key === 'order') ? typeof v === 'string' : key === 'done' && typeof v === 'boolean'))
}
export function validProgressCatalog(value: unknown): value is InventorySheet[] {
  if (!isInventorySheets(value)) return false
  const ids=value.flatMap(sheet=>sheet.items.map(item=>item.id))
  return new Set(value.map(sheet=>sheet.id)).size===value.length && new Set(ids).size===ids.length && ids.every(Boolean)
}
export function validInventoryProgress(value: unknown, date: string): value is InventoryProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v=value as InventoryProgress
  return Object.keys(v).every(key=>['schemaVersion','storeId','date','updatedAt','catalogRevision','catalog','counts','skipped','sectionId'].includes(key))
    && v.schemaVersion===1 && v.storeId==='CR3' && !!businessDate(v.date) && v.date===date && typeof v.updatedAt==='string' && Number.isFinite(Date.parse(v.updatedAt))
    && Number.isSafeInteger(v.catalogRevision) && v.catalogRevision>=0 && validProgressCatalog(v.catalog) && validInventoryCounts(v.counts)
    && Array.isArray(v.skipped) && v.skipped.every(id=>typeof id==='string'&&!!id) && new Set(v.skipped).size===v.skipped.length
    && (v.sectionId===null || typeof v.sectionId==='string' && v.catalog.some(sheet=>sheet.id===v.sectionId))
}
function read<T>(storage: Pick<Storage,'getItem'>, key: string, validate: (value: unknown)=>value is T): DeviceRead<T> {
  let raw:string|null
  try { raw=storage.getItem(key) } catch { return {state:'unavailable'} }
  if(raw===null)return {state:'missing'}
  try { const value:unknown=JSON.parse(raw);return validate(value)?{state:'ready',value}:{state:'unreadable',key,raw} }
  catch { return {state:'unreadable',key,raw} }
}
export function readInventoryProgress(storage: Pick<Storage,'getItem'>, date:string) { return read(storage,inventoryProgressKey(date),(value):value is InventoryProgress=>validInventoryProgress(value,date)) }
export function readLegacyInventory(storage: Pick<Storage,'getItem'>, key=INVENTORY_LEGACY_KEY, date?:string) {
  return read(storage,key,(value):value is {date:string;counts:InventoryCounts}=>!!value&&typeof value==='object'&&Object.keys(value).every(key=>['date','counts'].includes(key))&&!!businessDate((value as {date:string}).date)&&(!date||(value as {date:string}).date===date)&&validInventoryCounts((value as {counts:unknown}).counts))
}
/** Additive metadata plus unchanged legacy count shapes. Unreadable originals are never overwritten. */
export function saveInventoryProgress(storage: Store, envelope:InventoryProgress):{saved:boolean;sources:{key:string;raw:string}[]} {
  if(!validInventoryProgress(envelope,envelope.date))return {saved:false,sources:[]}
  const sources:{key:string;raw:string}[]=[];let saved=true
  const legacy={date:envelope.date,counts:envelope.counts}
  for(const [key,value,prior] of [
    [inventoryProgressKey(envelope.date),envelope,readInventoryProgress(storage,envelope.date)],
    [`cr-inventory-day:${envelope.date}`,legacy,readLegacyInventory(storage,`cr-inventory-day:${envelope.date}`,envelope.date)],
    [INVENTORY_LEGACY_KEY,legacy,readLegacyInventory(storage)],
  ] as const) {
    if(prior.state==='unreadable'){sources.push({key,raw:prior.raw});saved=false;continue}
    if(prior.state==='unavailable'){saved=false;continue}
    try { const raw=JSON.stringify(value);storage.setItem(key,raw);if(storage.getItem(key)!==raw)saved=false } catch { saved=false }
  }
  return {saved,sources}
}
export function countState(counts:InventoryCounts, skipped:ReadonlySet<string>, id:string):CountState {
  const raw=(counts[id]?.inv??'').trim()
  if(raw===CHECK)return 'enough'
  if(raw) { const number=parseAmount(raw);return number===0?'zero':number===null?'text':'measured' }
  return skipped.has(id)?'skipped':'untouched'
}
export function inventoryProgressTotals(catalog:InventorySheet[],counts:InventoryCounts,skipped:ReadonlySet<string>) {
  const result={total:0,entered:0,enough:0,skipped:0,remaining:0}
  for(const item of catalog.flatMap(sheet=>sheet.items)) {
    result.total++;const state=countState(counts,skipped,item.id)
    if(state==='untouched')result.remaining++
    else if(state==='enough')result.enough++
    else if(state==='skipped')result.skipped++
    else result.entered++
  }
  return result
}
export function needsOrdering(item:InventorySheet['items'][number],counts:InventoryCounts):boolean {
  const order=counts[item.id]?.order ?? suggestOrder(item.use,counts[item.id]?.inv??'')
  return !!order.trim() && parseAmount(order)!==0
}
export function visibleInventory(catalog:InventorySheet[],counts:InventoryCounts,skipped:ReadonlySet<string>,filters:{suppliers:string[];section:string;search:string;mode:'all'|'remaining'|'ordering';pinnedId?:string|null}) {
  const query=filters.search.trim().toLocaleLowerCase()
  return filterBySupplier(catalog,filters.suppliers).filter(sheet=>!filters.section||sheet.id===filters.section)
    .map(sheet=>({...sheet,items:sheet.items.filter(item=>(!query||`${item.name} ${item.sup} ${item.note??''}`.toLocaleLowerCase().includes(query))&&(filters.mode==='all'||item.id===filters.pinnedId||filters.mode==='remaining'&&countState(counts,skipped,item.id)==='untouched'||filters.mode==='ordering'&&needsOrdering(item,counts)))})).filter(sheet=>sheet.items.length)
}

/** Explicit review adopts current attributes by ID, retaining removed IDs in their captured sections. */
export function mergeReviewedCatalog(captured:InventorySheet[],current:InventorySheet[]):InventorySheet[] {
  const result=structuredClone(current),ids=new Set(current.flatMap(sheet=>sheet.items.map(item=>item.id)))
  for(const old of captured){const removed=old.items.filter(item=>!ids.has(item.id));if(!removed.length)continue;const target=result.find(sheet=>sheet.id===old.id);if(target)target.items.push(...structuredClone(removed));else result.push({...structuredClone(old),items:structuredClone(removed)})}
  return result
}
