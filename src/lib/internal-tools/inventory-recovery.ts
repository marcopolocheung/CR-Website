import type { InventorySheet } from '../inventory'
import type { TranslationKey } from './i18n'
export type ComparisonRow = { id: string; label: string; yours: string; theirs: string }
export function isInventorySheets(value: unknown): value is InventorySheet[] {
  if (!Array.isArray(value)) return false
  return value.every(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.useLabel === 'string' && typeof s.showSup === 'boolean'
    && (s.title === undefined || typeof s.title === 'string') && (s.account === undefined || typeof s.account === 'string') && Array.isArray(s.items)
    && new Set(s.items.map((i: {id?:unknown}) => i?.id)).size === s.items.length
    && s.items.every((i: unknown) => !!i && typeof i === 'object' && ['id','name','sup','use'].every(k => typeof (i as Record<string,unknown>)[k] === 'string') && typeof (i as {gray?:unknown}).gray === 'boolean' && (!('note' in i) || typeof i.note === 'string')))
}
export function inventoryComparison(yours: InventorySheet[], theirs: InventorySheet[], t: (key: TranslationKey) => string): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const text = (value: unknown) => value === undefined ? t('recovery.missingItem') : typeof value === 'boolean' ? t(value ? 'recovery.yes' : 'recovery.no') : String(value)
  const add = (id: string,label: string,a: unknown,b: unknown) => { if (a !== b) rows.push({id,label,yours:text(a),theirs:text(b)}) }
  const a = new Map(yours.map(s => [s.id,s])); const b = new Map(theirs.map(s => [s.id,s]))
  for (const id of new Set([...a.keys(),...b.keys()])) {
    const left = a.get(id); const right = b.get(id); const title = left?.title || right?.title || id
    for (const [key,label] of [['title','recovery.sheetTitle'],['account','recovery.account'],['useLabel','recovery.useLabel'],['showSup','recovery.showSupplier']] as const) add(`${id}.${key}`,`${title} · ${t(label)}`,left?.[key],right?.[key])
    const li = new Map(left?.items.map(i => [i.id,i])); const ri = new Map(right?.items.map(i => [i.id,i]))
    if (JSON.stringify(left?.items.map(i => i.id)) !== JSON.stringify(right?.items.map(i => i.id))) rows.push({id:`${id}.order`,label:`${title} · ${t('recovery.itemOrder')}`,yours:left?.items.map(i => i.name).join(', ') ?? text(undefined),theirs:right?.items.map(i => i.name).join(', ') ?? text(undefined)})
    for (const itemId of new Set([...li.keys(),...ri.keys()])) {
      const l = li.get(itemId); const r = ri.get(itemId); const name = l?.name || r?.name || itemId
      for (const [key,label] of [['name','recovery.inventoryName'],['sup','recovery.inventorySupplier'],['use','recovery.inventoryUse'],['gray','recovery.inventoryGray'],['note','recovery.note']] as const) add(`${id}.${itemId}.${key}`,`${title} · ${name} · ${t(label)}`,l?.[key],r?.[key])
    }
  }
  return rows
}
