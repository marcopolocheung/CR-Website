'use client'
import type { InventoryCounts, InventoryItem, InventorySheet } from '@/lib/inventory'
import { CHECK, suggestOrder } from '@/lib/inventory'
import { countState } from '@/lib/internal-tools/inventory-progress'
import { useInternalLanguage } from './InternalLanguage'
import { Button } from './ui/controls'
import styles from './inventory-count.module.css'

export default function InventoryCountRows({sheets,counts,skipped,onInv,onOrder,onSkip,onFocus,retained}:{sheets:InventorySheet[];counts:InventoryCounts;skipped:ReadonlySet<string>;retained:ReadonlySet<string>;onInv:(item:InventoryItem,value:string)=>void;onOrder:(item:InventoryItem,value:string)=>void;onSkip:(item:InventoryItem,skip:boolean)=>void;onFocus:(id:string|null)=>void}) {
  const {t}=useInternalLanguage()
  return <>{sheets.map(sheet=><section key={sheet.id} className={styles.section} aria-labelledby={`count-section-${sheet.id}`}>
    <h2 id={`count-section-${sheet.id}`}>{sheet.title||sheet.id}</h2>
    {sheet.account&&<p>{t('inventoryCount.account')}: {sheet.account}</p>}
    <ul>{sheet.items.map(item=>{
      const raw=counts[item.id]?.inv??'',order=counts[item.id]?.order??'',state=countState(counts,skipped,item.id)
      const inputId=`inventory-on-hand-${item.id}`
      return <li key={item.id} data-count-id={item.id} data-count-state={state} className={styles.row}
        onFocusCapture={()=>onFocus(item.id)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))onFocus(null)}}>
        <div className={styles.item}>
          <h3>{item.name}</h3>{retained.has(item.id)&&<p>{t('inventoryCount.retainedId',{id:item.id})}</p>}
          <p id={`${inputId}-context`}>{t('inventoryCount.supplier')}: {item.sup||t('inventoryCount.noSupplier')} · {sheet.useLabel}: {item.use||'—'}{item.note&&` · ${item.note}`}</p>
          <p id={`${inputId}-state`} className={styles.state}>{t(`inventoryCount.state.${state}`)}</p>
        </div>
        <div className={styles.entry}><label htmlFor={inputId}>{t('inventoryCount.onHand')}</label>
          <input id={inputId} value={raw} maxLength={12} aria-describedby={`${inputId}-context ${inputId}-state`} onChange={event=>onInv(item,event.target.value)} />
        </div>
        <div className={styles.rowActions}>
          <Button aria-pressed={state==='enough'} onClick={()=>onInv(item,state==='enough'?'':CHECK)}>{t('inventoryCount.enough')}</Button>
          {(state==='untouched'||state==='skipped')&&<Button onClick={()=>onSkip(item,state!=='skipped')}>{t(state==='skipped'?'inventoryCount.undoSkip':'inventoryCount.skip')}</Button>}
        </div>
        <details className={styles.order}><summary>{t('inventoryCount.order')}: {order||'—'}</summary>
          <label htmlFor={`inventory-order-${item.id}`}>{t('inventoryCount.orderOverride')}</label>
          <input id={`inventory-order-${item.id}`} value={order} maxLength={12} onChange={event=>onOrder(item,event.target.value)} />
          <p>{t('inventoryCount.suggested')}: {suggestOrder(item.use,raw)||'—'}</p>
        </details>
      </li>
    })}</ul>
  </section>)}</>
}
