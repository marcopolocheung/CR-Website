'use client'
import { useManagerSession } from './ManagerSession'
import { useWorkspaceVisible } from './WorkspaceVisibility'

import InventoryCountRows from './InventoryCountRows'
import { InternalTheme } from './ui/Theme'
import { Paper, Button } from './ui/controls'
import styles from './inventory-count.module.css'
import { inventoryProgressKey, readInventoryProgress, readLegacyInventory, saveInventoryProgress, validProgressCatalog, countState, inventoryProgressTotals, visibleInventory, mergeReviewedCatalog, type InventoryProgress } from '@/lib/internal-tools/inventory-progress'
import { useShellTask } from './ShellTask'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { inventoryHistoryWindow, validatedInventoryHistory, savedInventoryCatalog, inventoryReportCatalog, sameInventoryFields } from '@/lib/internal-tools/inventory-history'
import { CodeGate } from './CashOut'
import { useInternalLanguage } from './InternalLanguage'
import { useConfirmation, focusField } from './Feedback'
import { useNavigationProtection, useWorkTransitions } from './NavigationProtection'
import { downloadDraftSource } from './DraftChooser'
import RecoveryPanel from './RecoveryPanel'
import { businessDate } from '@/lib/internal-tools/contracts'
import { SingleFlight } from '@/lib/internal-tools/recovery'
import { inventoryComparison, isInventorySheets } from '@/lib/internal-tools/inventory-recovery'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import {
  CHECK,
  DEFAULT_SHEETS,
  filterBySupplier,
  listProblem,
  newItemId,
  ordersBySupplier,
  suggestOrder,
  supplierCodes,
  type InventoryCounts,
  type InventoryItem,
  type InventorySheet,
} from '@/lib/inventory'
import { fetchInventoryHistory, fetchInventoryList, saveInventoryDay, saveInventoryList, type InventoryDay } from '@/lib/inventory-store'
import { StoreAuthError, StoreConflictError, StoreUnavailableError } from '@/lib/schedule-store'

// The paper sheets have five INV / ORDER pairs: four earlier counts plus today.
const PAST_COLUMNS = 4
// Printed row shading and pen color from the clipboard sheets.
const GRAY = 'bg-[#c9c9c9]'
const INK = 'text-blue-800'

const today = () => new Date().toLocaleDateString('en-CA')
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
const button = 'min-h-11 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50'
const cellBorder = 'border border-black'
const chip = (on: boolean) => `min-h-11 min-w-11 px-3 rounded-lg text-sm font-semibold border ${on ? 'bg-zinc-900 text-white border-zinc-900' : 'border-gray-300 hover:bg-gray-50'}`
// Comparison tables scroll within their view on narrow screens.
const pastOnly = 'print:table-cell'
// New rows get a temporary id until the list is saved; real ids never start with "-".
const isNewId = (id: string) => id.startsWith('-')
let nextNewId = 0
const VIEWS = ['count', 'orders', 'catalog', 'history'] as const
type InventoryView = typeof VIEWS[number]
type PrintMode = 'full' | 'checklist' | 'history'
const hashView = (): InventoryView => {
  const hash = window.location.hash.slice(1)
  return VIEWS.includes(hash as InventoryView) ? hash as InventoryView : 'count'
}


/** CR3 supply inventory: the clipboard sheets on screen, behind the manager code. */
export default function Inventory() {
  // Manager token lives in memory only, like cash out.
  const { token, unlock: setToken, expire: lock } = useManagerSession()
  return <InventoryBook token={token} onUnlock={setToken} onLocked={lock} />
}

function InventoryBook({ token, onUnlock, onLocked }: { token: string; onUnlock: (token: string) => void; onLocked: () => void }) {
  const { t: tr } = useInternalLanguage()
  const session = useManagerSession(), sessionRef = useRef(session); sessionRef.current = session
  const confirmation = useConfirmation(), visible = useWorkspaceVisible(), transitions = useWorkTransitions()
  const tokenRef = useRef(token); tokenRef.current = token
  const mounted = useRef(true), restored = useRef(false), mutation = useRef(0), loadSequence = useRef(0), hasLocal = useRef(false)
  const listSaving = useRef(new SingleFlight<void>())
  const [date, setDate] = useState(today), [counts, setCounts] = useState<InventoryCounts>({}), [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [acknowledged, setAcknowledged] = useState<{date:string;counts:InventoryCounts}|null>(null)
  const [history, setHistory] = useState<InventoryDay[]>([]), [loaded, setLoaded] = useState(false), [historyReady, setHistoryReady] = useState(false)
  const [status, setStatus] = useState<string | Message>(''), [busy, setBusy] = useState(false)
  const [view, setView] = useState<InventoryView>('count')
  const viewHeading = useRef<HTMLHeadingElement>(null)
  const [orderSupplier, setOrderSupplier] = useState(''), [focusedOrder, setFocusedOrder] = useState<string | null>(null)
  const [lookupDate, setLookupDate] = useState('')
  const lookupDateRef = useRef(lookupDate); lookupDateRef.current = lookupDate
  const [browse, setBrowse] = useState<{to:string;days:InventoryDay[]} | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [browseBusy, setBrowseBusy] = useState(false), [browseError, setBrowseError] = useState(false)
  const browseSequence = useRef(0)
  const [printMode, setPrintMode] = useState<PrintMode | null>(null)
  const requestedPrint = useRef<PrintMode | null>(null)
  useEffect(() => {
    const follow = () => { if(!visible)return; setView(hashView()); requestAnimationFrame(() => viewHeading.current?.focus()) }
    follow()
    window.addEventListener('hashchange', follow)
    window.addEventListener('popstate', follow)
    return () => { window.removeEventListener('hashchange', follow); window.removeEventListener('popstate', follow) }
  }, [visible])
  useEffect(() => {
    const before = () => flushSync(() => setPrintMode(requestedPrint.current ?? (view === 'history' ? 'history' : 'full')))
    const after = () => { requestedPrint.current = null; setPrintMode(null) }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [view])
  function openView(event: MouseEvent<HTMLAnchorElement>, next: InventoryView) {
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return
    event.preventDefault()
    // Preserve Next's history metadata so Forward never reloads the manager session.
    if(window.location.hash!==`#${next}`)window.history.pushState(window.history.state,'',`#${next}`)
    setView(next);requestAnimationFrame(()=>viewHeading.current?.focus())
  }
  function printReport(mode: PrintMode) {
    requestedPrint.current = mode
    flushSync(() => setPrintMode(mode))
    window.print()
  }
  const [catalogAvailable,setCatalogAvailable] = useState(false)
  const [sheets, setSheets] = useState<InventorySheet[]>(DEFAULT_SHEETS), [listRev, setListRev] = useState(0), [sharedRev, setSharedRev] = useState(0)
  const [countCatalog, setCountCatalog] = useState<InventorySheet[] | null>(null), [countCatalogRev, setCountCatalogRev] = useState(0)
  const [section, setSection] = useState(''), [search, setSearch] = useState(''), [filter, setFilter] = useState<'all'|'remaining'|'ordering'>('all'), [focusedItem, setFocusedItem] = useState<string | null>(null)
  const [draft, setDraft] = useState<InventorySheet[] | null>(null), [picked, setPicked] = useState<string[]>([])
  const draftRef = useRef(draft); draftRef.current = draft
  const dateRef = useRef(date); dateRef.current = date
  const countsRef = useRef(counts); countsRef.current = counts
  const skippedRef = useRef(skipped); skippedRef.current = skipped
  const catalogRef = useRef(countCatalog); catalogRef.current = countCatalog
  const listRevRef = useRef(listRev); listRevRef.current = listRev
  const [catalogSource, setCatalogSource] = useState<string | null>(null)
  const [catalogRecovery, setCatalogRecovery] = useState<{ baseRevision: number; sheets: InventorySheet[] } | null>(null)
  const [conflict,setConflict] = useState(false), [serverList,setServerList] = useState<{rev:number;sheets:InventorySheet[] | null} | null>(null)
  const [countDirty,setCountDirty] = useState(false), [deviceSaved,setDeviceSaved] = useState(false), [deviceFailed,setDeviceFailed] = useState(false)
  const deviceRef = useRef(deviceSaved); deviceRef.current = deviceSaved
  const [catalogArchives,setCatalogArchives] = useState<{key:string;raw:string}[]>([])
  const serverListRef=useRef(serverList);serverListRef.current=serverList
  const [recoverySources,setRecoverySources] = useState<{key:string;raw:string}[]>([])
  const pendingRequests = useRef({ generation: session.generation, count: 0 })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadSequence.current++ } }, [])
  useEffect(() => { pendingRequests.current={generation:session.generation,count:0};setBusy(false);loadSequence.current++;browseSequence.current++;setBrowseBusy(false);listSaving.current=new SingleFlight<void>() }, [session.generation])

  function envelope(): InventoryProgress | null {
    return countCatalog ? {schemaVersion:1,storeId:'CR3',date,updatedAt:new Date().toISOString(),catalogRevision:countCatalogRev,catalog:countCatalog,counts,skipped:[...skipped],sectionId:section || null} : null
  }
  function protectProgress() {
    const value=envelope()
    if(!value)return !countDirty
    try {
      const result=saveInventoryProgress(localStorage,value)
      if(result.sources.length)setRecoverySources(old=>[...old.filter(source=>!result.sources.some(next=>next.key===source.key)),...result.sources])
      setDeviceSaved(result.saved);setDeviceFailed(!result.saved)
      return result.saved
    } catch {setDeviceSaved(false);setDeviceFailed(true);return false}
  }
  const checkpoint = () => {
    if (!loaded) return true
    if((historyReady||hasLocal.current||countDirty)&&!protectProgress())return false
    try {
      if (draft) localStorage.setItem('cr-inventory-catalog-recovery-v1', JSON.stringify({ schemaVersion: 1, storeId: 'CR3', baseRevision: listRev, sheets: draft }))
      return true
    } catch { setDeviceSaved(false); setStatus({key:'feedback.storageFailed'}); return false }
  }
  useNavigationProtection({ dirty: !!draft || countDirty, deviceSaved: !draft && deviceSaved, busy, checkpoint,
    leave: () => { loadSequence.current++;mutation.current++;setDraft(null);setConflict(false);setServerList(null);restored.current=false;setLoaded(false);setCounts({});setSkipped(new Set());setCountCatalog(null);setCountDirty(false);setHistoryReady(false) } })

  const run = useCallback(async (task: (generation:number) => Promise<string | Message | void>) => {
    const generation=sessionRef.current.generation
    if(pendingRequests.current.generation!==generation)pendingRequests.current={generation,count:0}
    pendingRequests.current.count++;setBusy(true);setStatus('')
    try {
      const message=await task(generation)
      if(mounted.current&&tokenRef.current===token&&sessionRef.current.generation===generation&&message)setStatus(message)
    } catch(caught) {
      if(!mounted.current||tokenRef.current!==token||sessionRef.current.generation!==generation)return
      setStatus({key:errorKey(caught)});if(caught instanceof StoreAuthError)onLocked()
    } finally {
      if(pendingRequests.current.generation===generation){pendingRequests.current.count--;if(mounted.current)setBusy(pendingRequests.current.count>0)}
    }
  },[onLocked,token])

  function readLocal(next:string, global?:{date:string;counts:InventoryCounts}) {
    mutation.current++;hasLocal.current=false;setAcknowledged(null);setHistoryReady(false);setHistory([]);setFocusedItem(null);setSearch('');setFilter('all');setPicked([])
    let localCounts:InventoryCounts={},localCatalog:InventorySheet[]|null=null,localSkipped=new Set<string>(),localSection='',revision=0,ready=false
    const originals:{key:string;raw:string}[]=[];let readDenied=false
    try {
      const latest=readLegacyInventory(localStorage)
      if(latest.state==='unreadable')originals.push(latest)
      if(latest.state==='unavailable')readDenied=true
      if(!global&&latest.state==='ready')global=latest.value
      const progress=readInventoryProgress(localStorage,next)
      if(progress.state==='unavailable')readDenied=true
      if(progress.state==='ready') {
        localCounts=progress.value.counts;localCatalog=progress.value.catalog;localSkipped=new Set(progress.value.skipped);localSection=progress.value.sectionId??'';revision=progress.value.catalogRevision;ready=true;hasLocal.current=true
      } else {
        if(progress.state==='unreadable')originals.push(progress)
        const prior=readLegacyInventory(localStorage,`cr-inventory-day:${next}`,next)
        if(prior.state==='ready')localCounts=prior.value.counts
        else {if(prior.state==='unreadable')originals.push(prior);if(global?.date===next)localCounts=global.counts}
        hasLocal.current=!!Object.keys(localCounts).length
      }
    } catch {setDeviceFailed(true)}
    dateRef.current=next;countsRef.current=localCounts;catalogRef.current=localCatalog;skippedRef.current=localSkipped
    setDate(next);setCounts(localCounts);setCountCatalog(localCatalog);setCountCatalogRev(revision);setSkipped(localSkipped);setSection(localSection);setHistoryReady(ready)
    setCountDirty(hasLocal.current);setDeviceSaved(ready);setRecoverySources(originals);setDeviceFailed(readDenied||!!originals.length)
    try {const archives=[];for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);if(key?.startsWith(`cr-inventory-progress-archive:v1:CR3:${next}:`)){const raw=localStorage.getItem(key);if(raw!==null)archives.push({key,raw})}}setCatalogArchives(archives)}catch{setCatalogArchives([])}
  }
  function loadRemote(start:string) {
    const request=++loadSequence.current,at=mutation.current
    void run(async generation => {
      const live=()=>mounted.current&&tokenRef.current===token&&sessionRef.current.generation===generation&&loadSequence.current===request&&dateRef.current===start
      const list=await fetchInventoryList(token)
      if(!Number.isSafeInteger(list.rev)||list.rev<0||(list.sheets!==null&&!validProgressCatalog(list.sheets)))throw new StoreUnavailableError()
      if(!live())return
      const catalog=list.sheets??DEFAULT_SHEETS;setCatalogAvailable(true)
      setSheets(catalog);setSharedRev(list.rev)
      if(!draftRef.current)setListRev(list.rev);else if(list.rev!==listRevRef.current){setConflict(true);setServerList(list)}
      if(!catalogRef.current){const captured=structuredClone(catalog);catalogRef.current=captured;setCountCatalog(captured);setCountCatalogRev(list.rev)}
      const days=validatedInventoryHistory(await fetchInventoryHistory(start,token),start)
      if(!live())return
      setHistory(days)
      if(!hasLocal.current&&mutation.current===at){const values=days.find(day=>day.date===start)?.counts??{};countsRef.current=values;setCounts(values);hasLocal.current=true}
      setHistoryReady(true)
    })
  }
  // Local progress retains its captured catalog; reauthentication never applies a newer list over it.
  useEffect(() => {
    if(!token||!visible)return
    let start=dateRef.current
    if(!restored.current) {
      let global:{date:string;counts:InventoryCounts}|undefined
      try { const prior=readLegacyInventory(localStorage);if(prior.state==='ready')global=prior.value;else if(prior.state==='unreadable')setRecoverySources(old=>[...old,prior]) } catch {setDeviceFailed(true)}
      start=global?.date??today();readLocal(start,global)
      try {
        const raw=localStorage.getItem('cr-inventory-catalog-recovery-v1')
        if(raw){setCatalogSource(raw);const saved=JSON.parse(raw);if(saved.schemaVersion===1&&saved.storeId==='CR3'&&Number.isSafeInteger(saved.baseRevision)&&saved.baseRevision>=0&&isInventorySheets(saved.sheets))setCatalogRecovery({baseRevision:saved.baseRevision,sheets:saved.sheets})}
      } catch { /* Retain original catalog recovery bytes. */ }
      setLoaded(true);restored.current=true
    }
    loadRemote(start)
  },[run,token,visible,session.generation])

  useEffect(() => { if(loaded&&countCatalog&&(historyReady||countDirty))protectProgress() },[date,counts,skipped,section,countCatalog,countCatalogRev,loaded,historyReady,countDirty])

  // Read-only browsing has its own context and generation. It never calls readLocal,
  // protectProgress, or a PUT, and never replaces the working comparison baseline.
  async function loadSavedDays(to: string) {
    if (!token || !businessDate(to)) return
    const request = ++browseSequence.current, generation = sessionRef.current.generation, credential = token
    const live = () => mounted.current && request === browseSequence.current && tokenRef.current === credential && sessionRef.current.generation === generation && lookupDateRef.current === to
    setBrowseBusy(true); setBrowseError(false)
    try {
      const days = validatedInventoryHistory(await fetchInventoryHistory(to,credential),to)
      if (!live()) return
      setBrowse({to,days}); setSelectedDate(days[0]?.date ?? '')
    } catch (caught) {
      if (!live()) return
      setBrowseError(true)
      if (caught instanceof StoreAuthError) onLocked()
    } finally { if (live()) setBrowseBusy(false) }
  }
  useEffect(() => {
    if (!token) { browseSequence.current++; setBrowse(null); setBrowseBusy(false); return }
    if (view !== 'history' || !loaded) return
    if (!lookupDate) {
      lookupDateRef.current = date; setLookupDate(date); void loadSavedDays(date)
    } else if (!browse && !browseBusy && !browseError) void loadSavedDays(lookupDate)
  }, [token,view,loaded,session.generation])
  // Catalog edits are recoverable after reload even before a handoff or save.
  useEffect(() => {
    if (!loaded || !draft) return
    try {
      localStorage.setItem('cr-inventory-catalog-recovery-v1',JSON.stringify({schemaVersion:1,storeId:'CR3',baseRevision:listRev,sheets:draft}))
    } catch { setStatus({key:'feedback.storageFailed'}) }
  }, [loaded,draft,listRev])
  const changeDate=(next:string)=>{
    if(!businessDate(next)||next===date)return
    void transitions.change(()=>{readLocal(next);loadRemote(next)})
  }
  const save=()=>run(async generation=>{
    const submitted=counts,savedDate=date,at=mutation.current
    await saveInventoryDay(savedDate,submitted,token)
    const live=()=>mounted.current&&tokenRef.current===token&&sessionRef.current.generation===generation&&dateRef.current===savedDate
    if(!live())return
    setAcknowledged({date:savedDate,counts:structuredClone(submitted)})
    const same=mutation.current===at&&countsRef.current===submitted
    if(same&&deviceRef.current)setCountDirty(false)
    const acknowledgment=():Message=>({key:mutation.current===at&&countsRef.current===submitted?'inventoryCount.saved':'inventoryCount.olderSaved',params:{date:savedDate}})
    setStatus(acknowledgment())
    try {const days=validatedInventoryHistory(await fetchInventoryHistory(savedDate,token),savedDate);if(live())setHistory(days)}
    catch(caught){if(!live())return;if(caught instanceof StoreAuthError)onLocked();return {key:mutation.current===at&&countsRef.current===submitted?'inventoryCount.savedHistoryFailed':'inventoryCount.olderHistoryFailed',params:{date:savedDate}}}
    return acknowledgment()
  })

  const saveList = () => {
    if (!draft || conflict) return
    const problem = listProblem(draft)
    if (problem) return setStatus(problem)
    const candidate = draft
    return listSaving.current.run(() => run(async generation => {
      // Fresh IDs cannot reuse a retired name slug and inherit older count history.
      const taken = new Set(candidate.flatMap(sh => sh.items.map(i => i.id)))
      const next = candidate.map(sh => ({ ...sh, items: sh.items.map(i => ({ ...i, name: i.name.trim(), id: isNewId(i.id) ? newItemId(`item-${crypto.randomUUID()}`, taken) : i.id })) }))
      try {
        const rev = await saveInventoryList(next, listRev, token)
        if (!mounted.current || (tokenRef.current !== token || sessionRef.current.generation !== generation)) return
        setListRev(rev); setSharedRev(rev)
      } catch (caught) {
        if (!mounted.current || (tokenRef.current !== token || sessionRef.current.generation !== generation)) return
        if (caught instanceof StoreConflictError) {
          // Keep the original base revision. Reading a newer revision must not
          // silently turn the next save into permission to overwrite it.
          setConflict(true); setServerList(null)
          return {key:'recovery.conflict'}
        }
        throw caught
      }
      try { const raw = localStorage.getItem('cr-inventory-catalog-recovery-v1'); if (raw) localStorage.setItem(`cr-inventory-catalog-recovery-archive:${crypto.randomUUID()}`, raw); localStorage.removeItem('cr-inventory-catalog-recovery-v1'); setCatalogSource(null); setCatalogRecovery(null) } catch { setStatus({key:'feedback.storageFailed'}) }
      setSheets(next)
      if (draftRef.current === candidate) setDraft(null)
      return {key:'recovery.listSaved'}
    }))
  }
  const reloadList = () => run(async generation => {
    const latest = await fetchInventoryList(token)
    if (!Number.isSafeInteger(latest.rev) || latest.rev < 0 || (latest.sheets !== null && !isInventorySheets(latest.sheets))) throw new StoreUnavailableError()
    if (mounted.current && tokenRef.current === token && sessionRef.current.generation === generation) { setServerList(latest); setSheets(latest.sheets??DEFAULT_SHEETS); setSharedRev(latest.rev) }
  })
  const useServer = async () => {
    const generation=sessionRef.current.generation,candidate=draftRef.current,source=serverList
    if (!serverList || !await confirmation.ask({key:'recovery.replaceConfirm'},true,{key:'recovery.useServer'})) return
    if(generation!==sessionRef.current.generation||candidate!==draftRef.current||source!==serverListRef.current)return
    try { const raw = localStorage.getItem('cr-inventory-catalog-recovery-v1'); if (raw) localStorage.setItem(`cr-inventory-catalog-recovery-archive:${crypto.randomUUID()}`, raw); localStorage.removeItem('cr-inventory-catalog-recovery-v1'); setCatalogSource(null); setCatalogRecovery(null) } catch { setStatus({key:'feedback.storageFailed'}); return }
    if(generation!==sessionRef.current.generation||candidate!==draftRef.current||source!==serverListRef.current)return
    setSheets(serverList.sheets ?? DEFAULT_SHEETS); setListRev(serverList.rev); setSharedRev(serverList.rev)
    setDraft(null); setConflict(false); setServerList(null)
    requestAnimationFrame(() => focusField('inventory-edit-list'))
  }
  const cancelList = async () => {
    const generation=sessionRef.current.generation,candidate=draftRef.current
    if (!await confirmation.ask({key:'recovery.dropList'},true)) return
    if(generation!==sessionRef.current.generation||candidate!==draftRef.current)return
    try { const raw = localStorage.getItem('cr-inventory-catalog-recovery-v1'); if (raw) localStorage.setItem(`cr-inventory-catalog-recovery-archive:${crypto.randomUUID()}`, raw); localStorage.removeItem('cr-inventory-catalog-recovery-v1'); setCatalogSource(null); setCatalogRecovery(null) } catch { setStatus({key:'feedback.storageFailed'}); return }
    setListRev(sharedRev); setDraft(null); setConflict(false); setServerList(null)
    requestAnimationFrame(() => focusField('inventory-edit-list'))
  }

  const resumeCatalog = () => {
    if (!catalogRecovery) return
    void transitions.change(() => {
      setDraft(structuredClone(catalogRecovery.sheets))
      setConflict(catalogRecovery.baseRevision !== listRev)
      setListRev(catalogRecovery.baseRevision)
      setServerList(null)
    })
  }

  const changed=()=>{mutation.current++;hasLocal.current=true;setCountDirty(true);setDeviceSaved(false);setStatus('')}
  const setInv=(item:InventoryItem,inv:string)=>{changed();setSkipped(old=>{const next=new Set(old);next.delete(item.id);return next});setCounts(current=>({...current,[item.id]:{inv,order:suggestOrder(item.use,inv)}}))}
  const setOrder=(item:InventoryItem,order:string)=>{changed();setCounts(current=>({...current,[item.id]:{...current[item.id],inv:current[item.id]?.inv??'',order}}))}
  const setDone=(item:InventoryItem,done:boolean)=>{changed();setCounts(current=>({...current,[item.id]:{...current[item.id],done}}))}
  const setSkip=(item:InventoryItem,skip:boolean)=>{if(skip&&countState(countsRef.current,skippedRef.current,item.id)!=='untouched')return;changed();setSkipped(old=>{const next=new Set(old);if(skip)next.add(item.id);else next.delete(item.id);return next})}
  const clearCounts=async()=>{if(!historyReady&&!hasLocal.current)return;const at=mutation.current,day=dateRef.current,generation=sessionRef.current.generation,source=countsRef.current;if(!await confirmation.ask({key:'inventoryCount.clearConfirm'},true))return;if(at!==mutation.current||day!==dateRef.current||generation!==sessionRef.current.generation||source!==countsRef.current)return;changed();setCounts({});setSkipped(new Set())}

  const adoptCatalog=async()=>{
    const generation=sessionRef.current.generation,day=dateRef.current,at=mutation.current,current=sheets,captured=countCatalog
    if(!captured||!catalogAvailable||!canAdopt||(!historyReady&&!hasLocal.current)||busy||!await confirmation.ask({key:'inventoryCount.adoptConfirm'},true))return
    if(generation!==sessionRef.current.generation||day!==dateRef.current||at!==mutation.current||catalogRef.current!==captured||!checkpoint())return
    try {
      const key=`cr-inventory-progress-archive:v1:CR3:${day}:${crypto.randomUUID()}`,raw=localStorage.getItem(inventoryProgressKey(day))
      if(raw===null)throw new Error('storage')
      localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw new Error('storage')
      const merged=mergeReviewedCatalog(captured,current)
      setCatalogArchives(old=>[...old,{key,raw}]);setCountCatalog(merged);catalogRef.current=merged;setCountCatalogRev(listRev);setSection(value=>merged.some(sheet=>sheet.id===value)?value:'');setFocusedItem(null);changed()
    }catch{setDeviceFailed(true);setDeviceSaved(false)}
  }

  useShellTask('inventory', { context: token ? `CR3 · ${date}` : null, onLock: token ? onLocked : undefined })
  const past = history.filter(d => d.date < date).slice(0, PAST_COLUMNS).reverse()
  const catalog=countCatalog??[]
  const totals=inventoryProgressTotals(catalog,counts,skipped)
  const differences=countCatalog&&catalogAvailable?inventoryComparison(countCatalog,sheets,tr):[]
  const canAdopt=!!countCatalog&&catalogAvailable&&(countCatalogRev!==listRev||inventoryComparison(countCatalog,mergeReviewedCatalog(countCatalog,sheets),tr).length>0)
  const currentIds=new Set(sheets.flatMap(sheet=>sheet.items.map(item=>item.id)))
  const retainedIds=new Set(catalogAvailable?catalog.flatMap(sheet=>sheet.items.filter(item=>!currentIds.has(item.id)).map(item=>item.id)):[])
  const knownIds=new Set(catalog.flatMap(sheet=>sheet.items.map(item=>item.id)))
  const orphanIds=[...new Set([...Object.keys(counts),...skipped])].filter(id=>!knownIds.has(id))
  const suppliers = [...new Set(catalog.flatMap(sh => sh.items.flatMap(i => supplierCodes(i.sup))))]
  const shown = visibleInventory(catalog,counts,skipped,{suppliers:picked.filter(code=>suppliers.includes(code)),section,search,mode:filter,pinnedId:focusedItem})
  const orderCatalog = filterBySupplier(catalog, orderSupplier ? [orderSupplier] : [])
  const orders = ordersBySupplier(orderCatalog, counts)
  // A cleared override must stay editable until focus leaves its row.
  const editingOrder = orderCatalog.flatMap(sheet=>sheet.items).find(item=>item.id===focusedOrder)
  if (editingOrder && !orders.some(group=>group.lines.some(line=>line.item.id===editingOrder.id))) {
    let group = orders.find(group=>group.sup===(editingOrder.sup||'No supplier'))
    if (!group) { group={sup:editingOrder.sup||'No supplier',lines:[]}; orders.push(group) }
    group.lines.push({item:editingOrder,order:counts[editingOrder.id]?.order??'',done:!!counts[editingOrder.id]?.done})
  }
  const fullOrders = ordersBySupplier(catalog, counts)
  const orderText = [`CR3 order ${date}`, ...orders.map(g => `\n${g.sup}\n${g.lines.map(l => `  ${l.item.name}: ${l.order}`).join('\n')}`)].join('\n')
  const selected = browse?.days.find(day => day.date === selectedDate)
  const savedLabels = useMemo(() => {
    let storage: Storage | null = null
    try { storage = localStorage } catch { /* Device catalog unavailable; use shared labels. */ }
    return savedInventoryCatalog(storage,selected?.date ?? '',catalogAvailable?sheets:[])
  }, [selected,sheets,catalogAvailable])
  const selectedPast = selected ? browse!.days.filter(day => day.date < selected.date).slice(0,PAST_COLUMNS).reverse() : []
  const reportCatalog = inventoryReportCatalog(catalog,[counts,...past.map(day=>day.counts)],tr('inventoryViews.unknownIds'))
  const savedReportCatalog = selected ? inventoryReportCatalog(savedLabels.catalog,[selected.counts,...selectedPast.map(day=>day.counts)],tr('inventoryViews.unknownIds')) : []
  const savedFields = acknowledged?.date===date ? acknowledged.counts : history.find(day=>day.date===date)?.counts
  const workingSaved = !!savedFields && sameInventoryFields(savedFields,counts)
  const workingLabel = tr(workingSaved ? 'inventoryViews.workingSaved' : 'inventoryViews.workingDraft')
  const canCount = !!countCatalog && (historyReady || hasLocal.current)

  return (
    <InternalTheme><div className={styles.workspace}>
      {!token && visible && <CodeGate onUnlock={onUnlock} title={tr('nav.inventory')} />}
      <div hidden={!token}>
        <div className={styles.screen}>
          <nav aria-label={tr('inventoryViews.navigation')} className={styles.views}>
            {VIEWS.map(value=><a key={value} href={`#${value}`} aria-current={view===value?'page':undefined}
              onClick={event=>openView(event,value)}>{tr(`inventoryViews.${value}`)}</a>)}
          </nav>
          <div className={styles.context}>
            <div><label htmlFor="inventory-date">{tr('inventoryCount.date')}</label>
              <input id="inventory-date" type="date" value={date} onChange={event=>changeDate(event.target.value)} /></div>
            {(view==='count'||view==='orders')&&<>
              <Button id="inventory-save" onClick={save} variant="primary" disabled={busy||!canCount}>{tr('inventoryCount.save')}</Button>
              <Button data-print-full disabled={!countCatalog} onClick={()=>printReport('full')}>{tr('inventoryViews.printFull')}</Button>
            </>}
          </div>
          <h2 data-inventory-heading ref={viewHeading} tabIndex={-1} className={styles.viewHeading}>{tr(`inventoryViews.${view}`)}</h2>
          <p role="status" className="my-3">{typeof status==='string'?status:tr(status.key,status.params)}</p>

          <section hidden={view!=='count'} data-inventory-view="count">
            <p>{tr('inventoryCount.units')}</p><p className="my-3">{tr('inventoryCount.deviceOnly')}</p>
            {deviceFailed&&<p role="alert" className="my-3 text-red-800">{tr('inventoryCount.deviceFailed')}</p>}
            <p data-inventory-device>{tr(deviceSaved?'inventoryCount.deviceSaved':'inventoryCount.devicePending')}</p>
            <dl className={styles.progress} aria-label={tr('inventoryCount.progress')} data-inventory-progress>
              {(['entered','enough','skipped','remaining','total'] as const).map(key=><div key={key}><dt>{tr(`inventoryCount.${key}`)}</dt><dd data-inventory-total={key}>{totals[key]}</dd></div>)}
            </dl>
            {recoverySources.length>0&&<details><summary>{tr('inventoryCount.recovery')}</summary><p>{tr('inventoryCount.recoveryNote')}</p>{recoverySources.map(source=><div key={source.key}><p className="break-all">{source.key}</p><Button onClick={()=>downloadDraftSource(source.raw)}>{tr('drafts.downloadSource')}</Button></div>)}</details>}
            <details><summary>{tr('inventoryCount.currentCopy')}</summary><Button disabled={!countCatalog} onClick={()=>{const value=envelope();if(value)downloadDraftSource(JSON.stringify(value))}}>{tr('inventoryCount.downloadProgress')}</Button></details>
            {canAdopt&&<p className="my-3"><a href="#catalog" onClick={event=>openView(event,'catalog')} className="underline">{tr('inventoryCount.catalogChanged')}</a></p>}
            {!!catalogSource&&<p className="my-3"><a href="#catalog" onClick={event=>openView(event,'catalog')} className="underline">{tr('session.catalogDraft')}</a></p>}
            {!!orphanIds.length&&<details data-inventory-orphans><summary>{tr('inventoryCount.orphans')}</summary><ul>{orphanIds.map(id=><li key={id}>{id}: {counts[id]?.inv??'—'} · {counts[id]?.order??'—'}{skipped.has(id)&&` · ${tr('inventoryCount.state.skipped')}`}</li>)}</ul></details>}
            {!countCatalog&&<div><p role="status">{tr(busy?'inventoryCount.loadingCatalog':'inventoryCount.catalogUnavailable')}</p><Button disabled={busy} onClick={()=>loadRemote(date)}>{tr('inventoryCount.retryLoad')}</Button></div>}
            <div className={styles.filters}>
              <div><label htmlFor="inventory-search">{tr('inventoryCount.search')}</label><input id="inventory-search" type="search" value={search} onChange={event=>{setFocusedItem(null);setSearch(event.target.value)}}/></div>
              <div><label htmlFor="inventory-section">{tr('inventoryCount.section')}</label><select id="inventory-section" value={section} onChange={event=>{setFocusedItem(null);setSection(event.target.value)}}><option value="">{tr('inventoryCount.allSections')}</option>{catalog.map(sheet=><option key={sheet.id} value={sheet.id}>{sheet.title||sheet.id}</option>)}</select></div>
              <div><label htmlFor="inventory-filter">{tr('inventoryCount.filter')}</label><select id="inventory-filter" value={filter} onChange={event=>{setFocusedItem(null);setFilter(event.target.value as typeof filter)}}><option value="all">{tr('inventoryCount.all')}</option><option value="remaining">{tr('inventoryCount.remaining')}</option><option value="ordering">{tr('inventoryCount.needsOrdering')}</option></select></div>
            </div>
            <div role="group" aria-label={tr('inventoryCount.showSuppliers')} className="flex flex-wrap items-center gap-2 mb-6">
              <span>{tr('inventoryCount.supplierFilter')}:</span>
              <button type="button" aria-pressed={!picked.length} onClick={()=>setPicked([])} className={chip(!picked.length)}>{tr('inventoryCount.all')}</button>
              {suppliers.map(code=><button key={code} type="button" aria-pressed={picked.includes(code)} onClick={()=>setPicked(values=>values.includes(code)?values.filter(c=>c!==code):[...values,code])} className={chip(picked.includes(code))}>{code}</button>)}
            </div>
            <Paper emphasis="active">
              {!shown.length&&countCatalog&&<p>{tr('inventoryCount.noRows')}</p>}
              {!historyReady&&!hasLocal.current&&<p role="status">{tr(busy?'inventoryCount.loadingDay':'inventoryCount.dayUnavailable')} {!busy&&<Button onClick={()=>loadRemote(date)}>{tr('inventoryCount.retryLoad')}</Button>}</p>}
              <fieldset disabled={!canCount} className="min-w-0"><InventoryCountRows sheets={shown} counts={counts} skipped={skipped} retained={retainedIds} onInv={setInv} onOrder={setOrder} onSkip={setSkip} onFocus={setFocusedItem}/></fieldset>
            </Paper>
            <div className="my-5 flex flex-wrap gap-3"><Button id="inventory-save-bottom" variant="primary" disabled={busy||!canCount} onClick={save}>{tr('inventoryCount.saveBottom')}</Button><Button disabled={busy||!canCount} onClick={()=>void clearCounts()}>{tr('inventoryCount.clear')}</Button></div>
          </section>

          <section hidden={view!=='orders'} data-inventory-view="orders">
            <p>{tr('inventoryViews.manual')}</p>
            <div className={styles.context}>
              <div><label htmlFor="inventory-order-supplier">{tr('inventoryViews.checklistSupplier')}</label><select id="inventory-order-supplier" value={orderSupplier} onChange={event=>setOrderSupplier(event.target.value)}><option value="">{tr('inventoryCount.all')}</option>{[...new Set([...suppliers,...(orderSupplier?[orderSupplier]:[])])].map(code=><option key={code}>{code}</option>)}</select></div>
              <Button disabled={!orders.length} onClick={()=>navigator.clipboard.writeText(orderText).then(()=>setStatus({key:'inventoryCount.copied'}),()=>setStatus({key:'inventoryCount.copyFailed'}))}>{tr('inventoryCount.copy')}</Button>
              <Button disabled={!countCatalog} onClick={()=>printReport('checklist')}>{tr('inventoryViews.printChecklist')}</Button>
            </div>
            <Paper emphasis="active"><fieldset disabled={!canCount} className="min-w-0"><OrderChecklist orders={orders} counts={counts} onDone={setDone} onOrder={setOrder} onFocusOrder={setFocusedOrder}/></fieldset></Paper>
          </section>

          <section hidden={view!=='catalog'} data-inventory-view="catalog">
            {catalogSource&&!draft&&<div className="my-4 border border-gray-300 p-3"><p>{tr(catalogRecovery?'session.catalogDraft':'drafts.unreadable')}</p>{catalogRecovery&&<Button disabled={busy} onClick={resumeCatalog}>{tr('session.resumeCatalog')}</Button>}<Button onClick={()=>downloadDraftSource(catalogSource)}>{tr('drafts.downloadSource')}</Button></div>}
            <p>{catalogAvailable?tr('inventoryViews.sharedCatalog',{revision:sharedRev}):tr('inventoryViews.unavailableLabels')}</p>
            {draft?<>
              <p className="my-3">{tr('inventoryCount.editHelp')}</p>
              <div className={styles.context}><Button variant="primary" disabled={busy||conflict} onClick={saveList}>{tr('recovery.saveList')}</Button><Button disabled={busy} onClick={cancelList}>{tr('feedback.cancel')}</Button></div>
              <RecoveryPanel message={{key:conflict?'recovery.conflict':'recovery.localList'}} copyText={()=>JSON.stringify({storeId:'CR3',baseRevision:listRev,sheets:draft},null,2)} busy={busy} retryLabel={{key:'recovery.retryLegacy'}} onRetry={!conflict?saveList:undefined} onReload={conflict?reloadList:undefined} onUseServer={serverList?useServer:undefined} rows={serverList?inventoryComparison(draft,serverList.sheets??DEFAULT_SHEETS,tr):undefined}/>
              <fieldset disabled={busy} className="min-w-0">{draft.map((sheet,index)=><EditSheetTable key={sheet.id} sheet={sheet} onChange={items=>setDraft(value=>value&&value.map((sh,i)=>i===index?{...sh,items}:sh))}/>)}</fieldset>
            </>:<>
              <div className={styles.context}><Button id="inventory-edit-list" hidden={!!catalogSource} disabled={busy||!catalogAvailable} onClick={()=>{setConflict(false);setServerList(null);setDraft(structuredClone(sheets))}}>{tr('inventoryViews.editCatalog')}</Button></div>
              {catalogAvailable?<Paper emphasis="active"><CatalogTables sheets={sheets}/></Paper>:<div><p>{tr(busy?'inventoryCount.loadingCatalog':'inventoryCount.catalogUnavailable')}</p><Button disabled={busy} onClick={()=>loadRemote(date)}>{tr('inventoryCount.retryLoad')}</Button></div>}
            </>}
            {countCatalog&&<details className="my-5" data-inventory-catalog-difference><summary>{tr('inventoryCount.catalogChanged')}</summary><p>{tr('inventoryCount.catalogSnapshot',{revision:countCatalogRev})}</p><p>{tr('inventoryCount.retained')}</p><Button disabled={busy||!!draft||!canAdopt||!canCount} onClick={()=>void adoptCatalog()}>{tr('inventoryCount.adopt')}</Button><ul>{differences.map(row=><li key={row.id} className="break-words"><strong>{row.label}</strong> <code>{row.id}</code>: {row.yours} → {row.theirs}</li>)}</ul>{!differences.length&&<p>{tr('inventoryViews.noDifferences')}</p>}</details>}
            {!!catalogArchives.length&&<details><summary>{tr('inventoryCount.archives')}</summary>{catalogArchives.map(source=><div key={source.key}><p className="break-all">{source.key}</p><Button onClick={()=>downloadDraftSource(source.raw)}>{tr('drafts.downloadSource')}</Button></div>)}</details>}
          </section>

          <section hidden={view!=='history'} data-inventory-view="history">
            <p>{tr('inventoryViews.historyHelp')}</p>
            <div className={styles.context}><div><label htmlFor="inventory-history-end">{tr('inventoryViews.historyEnd')}</label><input id="inventory-history-end" type="date" value={lookupDate} onChange={event=>{browseSequence.current++;lookupDateRef.current=event.target.value;setLookupDate(event.target.value);setBrowseBusy(false);setBrowseError(false)}}/></div><Button disabled={browseBusy||!businessDate(lookupDate)} onClick={()=>void loadSavedDays(lookupDate)}>{tr('inventoryViews.loadDays')}</Button></div>
            {browseBusy&&<p role="status">{tr('inventoryViews.loadingHistory')}</p>}
            {browseError&&<p role="alert">{tr('inventoryViews.historyFailed')}</p>}
            {browse&&<div data-history-results>
              <p>{tr('inventoryViews.window',inventoryHistoryWindow(browse.to))}</p>
              {lookupDate!==browse.to&&<p data-history-stale role="status">{tr('inventoryViews.stale')}</p>}
              {!browse.days.length?<p>{tr('inventoryViews.empty')}</p>:<>
                <ul className={styles.savedDays}>{browse.days.map(day=><li key={day.date}><Button aria-pressed={day.date===selectedDate} onClick={()=>setSelectedDate(day.date)}>{day.date}</Button><span>{tr('inventoryViews.savedTime',{time:day.updatedAt})}</span></li>)}</ul>
                {selected&&<Paper emphasis="active"><div data-history-record>
                  <h3 className={styles.recordHeading}>{tr('inventoryViews.savedRecord',{date:selected.date})}</h3><p>{tr('inventoryViews.savedTime',{time:selected.updatedAt})}</p>
                  <CatalogProvenance source={savedLabels.source} revision={savedLabels.revision} available={catalogAvailable||savedLabels.source==='device'}/>
                  <div className="my-4"><Button onClick={()=>printReport('history')}>{tr('inventoryViews.printSaved')}</Button></div>
                  <SavedFields sheets={inventoryReportCatalog(savedLabels.catalog,[selected.counts],tr('inventoryViews.unknownIds'))} counts={selected.counts}/>
                </div></Paper>}
              </>}
            </div>}
            <details className={styles.comparison} data-inventory-comparison><summary>{tr('inventoryViews.compare')}</summary><p>{workingLabel} · {date}</p><p>{tr('inventoryViews.comparisonHelp')}</p><div className={styles.reportScroll} tabIndex={0} role="region" aria-label={tr('inventoryViews.compare')}>{reportCatalog.map(sheet=><SheetTable key={sheet.id} sheet={sheet} date={date} past={past} counts={counts} onInv={setInv} onOrder={setOrder} retained={retainedIds} columnState={workingLabel} readOnly/>)}</div></details>
          </section>
          {confirmation.dialog}
        </div>

        <div className={styles.printSheets}>
          {(printMode===null||printMode==='full')&&<><h2>CR3 inventory · {date}</h2><p>{workingLabel}</p><p>{tr('inventoryViews.workingCatalog',{revision:countCatalogRev})}</p>{reportCatalog.map(sheet=><SheetTable key={sheet.id} sheet={sheet} date={date} past={past} counts={counts} onInv={setInv} onOrder={setOrder} retained={retainedIds} columnState={workingLabel} readOnly/>)}<h2>{tr('inventoryCount.orderList')} · {shortDate(date)}</h2><p>{tr('inventoryViews.manual')}</p><OrderChecklist orders={fullOrders}/></>}
          {printMode==='checklist'&&<><h2>CR3 {tr('inventoryViews.orders')} · {date}</h2><p>{tr('inventoryViews.checklistSupplier')}: {orderSupplier||tr('inventoryCount.all')}</p><p>{tr('inventoryViews.manual')}</p><OrderChecklist orders={orders}/></>}
          {printMode==='history'&&(selected?<><h2>CR3 · {tr('inventoryViews.savedRecord',{date:selected.date})}</h2><p>{tr('inventoryViews.savedTime',{time:selected.updatedAt})}</p><CatalogProvenance source={savedLabels.source} revision={savedLabels.revision} available={catalogAvailable||savedLabels.source==='device'}/>{savedReportCatalog.map(sheet=><SheetTable key={sheet.id} sheet={sheet} date={selected.date} past={selectedPast} counts={selected.counts} onInv={setInv} onOrder={setOrder} columnState={tr('inventoryViews.savedColumn')} showIds readOnly/>)}<h2>{tr('inventoryCount.orderList')} · {selected.date}</h2><p>{tr('inventoryViews.manual')}</p><OrderChecklist orders={ordersBySupplier(savedReportCatalog,selected.counts)}/></>:<p>{tr('inventoryViews.empty')}</p>)}
        </div>
      </div>
    </div></InternalTheme>
  )
}

function OrderChecklist({orders,counts,onDone,onOrder,onFocusOrder}:{orders:ReturnType<typeof ordersBySupplier>;counts?:InventoryCounts;onFocusOrder?:(id:string|null)=>void;onDone?:(item:InventoryItem,done:boolean)=>void;onOrder?:(item:InventoryItem,order:string)=>void}) {
  const {t}=useInternalLanguage()
  return <div data-inventory-orders>{!orders.length?<p>{t('inventoryCount.noOrders')}</p>:orders.map(group=><section key={group.sup} className="my-5 break-inside-avoid"><h3 className="font-bold border-b border-black mb-2">{group.sup}</h3><ul>{group.lines.map(line=><li key={line.item.id} className={styles.checklistRow}>
    {onDone?<label className={styles.mark}><input type="checkbox" aria-label={`${line.item.name} ${t('inventoryCount.ordered')}`} checked={line.done} onChange={event=>onDone(line.item,event.target.checked)}/><span>{t('inventoryCount.ordered')}</span></label>:<span>{line.done?t('inventoryCount.ordered'):'□'}</span>}
    <span className={line.done?'line-through':''}>{line.item.name}</span>
    {onOrder?<input type="text" aria-label={`${line.item.name} ${t('inventoryViews.overrideLabel')}`} value={counts?.[line.item.id]?.order??line.order} maxLength={12} onFocus={()=>onFocusOrder?.(line.item.id)} onBlur={()=>onFocusOrder?.(null)} onChange={event=>onOrder(line.item,event.target.value)}/>:<strong>{line.order}</strong>}
  </li>)}</ul></section>)}</div>
}

function CatalogTables({sheets}:{sheets:InventorySheet[]}) {
  const {t}=useInternalLanguage()
  return <>{sheets.map(sheet=><section key={sheet.id} className={styles.catalogSection}><h3>{sheet.title||sheet.id}</h3>{sheet.account&&<p>{t('inventoryCount.account')}: {sheet.account}</p>}<div className={styles.tableScroll} tabIndex={0} role="region" aria-label={sheet.title||sheet.id}><table><thead><tr><th>{t('inventoryViews.item')}</th><th>ID</th><th>{t('inventoryCount.supplier')}</th><th>{sheet.useLabel}</th></tr></thead><tbody>{sheet.items.map(item=><tr key={item.id}><th scope="row">{item.name}{item.note&&<span className="block font-normal">{item.note}</span>}</th><td><code>{item.id}</code></td><td>{item.sup}</td><td>{item.use}</td></tr>)}</tbody></table></div></section>)}</>
}

function CatalogProvenance({source,revision,available}:{source:'device'|'current';revision:number|null;available:boolean}) {
  const {t}=useInternalLanguage()
  return <p data-history-provenance>{t(!available?'inventoryViews.unavailableLabels':source==='device'?'inventoryViews.deviceLabels':'inventoryViews.currentLabels',{revision:revision??0})} {t('inventoryViews.noHistoricalCatalog')}</p>
}
function SavedFields({sheets,counts}:{sheets:InventorySheet[];counts:InventoryCounts}) {
  const {t}=useInternalLanguage()
  return <>{sheets.filter(sheet=>sheet.items.some(item=>Object.hasOwn(counts,item.id))).map(sheet=><section key={sheet.id} className={styles.catalogSection}><h3>{sheet.title||sheet.id}</h3><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={sheet.title||sheet.id}><table><thead><tr><th>{t('inventoryViews.item')} / ID</th><th>{t('inventoryViews.savedInv')}</th><th>{t('inventoryViews.savedOrder')}</th><th>{t('inventoryCount.ordered')}</th></tr></thead><tbody>{sheet.items.filter(item=>Object.hasOwn(counts,item.id)).map(item=><tr key={item.id}><th scope="row">{item.name}<code className="block font-normal">{item.id}</code></th><td>{counts[item.id].inv}</td><td>{counts[item.id].order}</td><td>{counts[item.id].done?t('inventoryViews.yes'):t('inventoryViews.no')}</td></tr>)}</tbody></table></div></section>)}</>
}

function EditSheetTable({ sheet, onChange }: { sheet: InventorySheet; onChange: (items: InventoryItem[]) => void }) {
  const items = sheet.items
  const update = (index: number, patch: Partial<InventoryItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const move = (index: number, by: number) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    onChange(next)
  }
  const remove = (index: number) => {
    const name = items[index].name.trim()
    if (!name || confirm(`Remove ${name}? Its saved counts stay on the server but remain available by item ID in History.`)) onChange(items.filter((_, i) => i !== index))
  }
  const add = () => onChange([...items, { id: `-new-${nextNewId++}`, name: '', sup: '', use: '', gray: false }])
  const field = 'bg-transparent px-1 py-1 text-center font-bold border border-dashed border-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500'
  const icon = 'w-7 h-7 rounded hover:bg-white/70 disabled:opacity-30'

  return (
    <section className="mb-10 overflow-x-auto">
      <div className="w-max max-w-full">
        {sheet.title && <h2 className="font-bold underline mb-1">{sheet.title}</h2>}
        <table className="border-collapse border-2 border-black text-sm bg-white font-sans">
          <thead>
            <tr className="font-bold">
              <th scope="col" className={`${cellBorder} px-2 py-1`}>ITEM</th>
              {sheet.showSup && <th scope="col" className={`${cellBorder} px-1 py-1`}>SUP</th>}
              <th scope="col" className={`${cellBorder} px-2 py-1 leading-tight`}>{sheet.useLabel}</th>
              <th scope="col" className={`${cellBorder} px-2 py-1`}>Gray</th>
              <th scope="col" className={`${cellBorder} px-2 py-1`}><span className="sr-only">Move or remove</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const label = item.name.trim() || `Row ${i + 1}`
              return (
                <tr key={item.id} className={item.gray ? GRAY : ''}>
                  <td className={`${cellBorder} p-1`}>
                    <input aria-label={`${label} name`} value={item.name} maxLength={60} onChange={e => update(i, { name: e.target.value })} className={`${field} w-28 sm:w-80`} />
                  </td>
                  {sheet.showSup && (
                    <td className={`${cellBorder} p-1`}>
                      <input aria-label={`${label} supplier`} value={item.sup} maxLength={10} onChange={e => update(i, { sup: e.target.value })} className={`${field} w-10 sm:w-14`} />
                    </td>
                  )}
                  <td className={`${cellBorder} p-1`}>
                    <input aria-label={`${label} use`} value={item.use} maxLength={12} onChange={e => update(i, { use: e.target.value })} className={`${field} w-10 sm:w-14`} />
                  </td>
                  <td className={`${cellBorder} px-2 text-center`}>
                    <input type="checkbox" aria-label={`${label} gray`} checked={item.gray} onChange={e => update(i, { gray: e.target.checked })} className="w-4 h-4 accent-gray-600" />
                  </td>
                  <td className={`${cellBorder} px-1 whitespace-nowrap`}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`} className={icon}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${label} down`} className={icon}>↓</button>
                    <button onClick={() => remove(i)} aria-label={`Remove ${label}`} className={`${icon} text-red-700`}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button onClick={add} className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">+ Add item</button>
      </div>
    </section>
  )
}

function SheetTable({
  sheet,
  date,
  past,
  counts,
  onInv,
  onOrder,
  readOnly = false,
  retained,
  columnState,
  showIds,
}: {
  sheet: InventorySheet
  date: string
  past: InventoryDay[]
  counts: InventoryCounts
  onInv: (item: InventoryItem, inv: string) => void
  onOrder: (item: InventoryItem, order: string) => void
  readOnly?: boolean
  retained?: ReadonlySet<string>
  columnState?: string
  showIds?: boolean
}) {
  const columns = [...past.map(d => d.date), date]
  return (
    <section className="mb-10 overflow-x-auto print:overflow-visible print:break-after-page">
      <div className="w-max max-w-full">
      {sheet.title && (
        <div className="flex justify-between items-end gap-4 mb-1 font-bold">
          <h2 className="underline">{sheet.title}</h2>
          <span>ACCOUNT # : {sheet.account}</span>
        </div>
      )}
      <table className="border-collapse border-2 border-black text-sm bg-white font-sans">
        <colgroup><col />{sheet.showSup&&<col data-inventory-supplier/>}<col data-inventory-use/>{columns.flatMap(d=>[<col key={`${d}-inv`}/>,<col key={`${d}-order`}/>])}</colgroup>
        <thead>
          <tr>
            <th className="border-0" colSpan={sheet.showSup ? 3 : 2} />
            {columns.map(d => (
              <th key={d} colSpan={2} className={`border-0 font-normal text-base ${INK} ${d === date ? '' : pastOnly}`}>{shortDate(d)}{d===date&&columnState&&<span className="block text-xs">{columnState}</span>}</th>
            ))}
          </tr>
          <tr className="font-bold">
            <th scope="col" className={`${cellBorder} px-2 py-1 sm:w-56`}>ITEM</th>
            {sheet.showSup && <th scope="col" className={`${cellBorder} px-1 py-1`}>SUP</th>}
            <th scope="col" className={`${cellBorder} px-2 py-1 leading-tight`}>{sheet.useLabel}</th>
            {columns.map(d => (
              <PairHeader key={d} past={d !== date} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.items.map(item => {
            const cell = counts[item.id] ?? { inv: '', order: '' }
            return (
              <tr key={item.id} className={item.gray ? GRAY : ''}>
                <th scope="row" className={`${cellBorder} px-2 py-1 font-bold text-center`}>
                  {item.name}
                  {showIds?<span className="block font-normal text-xs">ID: {item.id}</span>:retained?.has(item.id)&&<span className="block font-normal text-xs">Retained ID: {item.id}</span>}
                  {item.note && <span className={`ml-1 font-normal ${INK}`}>{item.note}</span>}
                </th>
                {sheet.showSup && <td className={`${cellBorder} px-1 text-center font-bold`}>{item.sup}</td>}
                <td className={`${cellBorder} px-2 text-center font-bold`}>{item.use}</td>
                {past.map(d => (
                  <PastPair key={d.date} cell={d.counts[item.id]} />
                ))}
                <td className={`${cellBorder} p-0 w-20`}>
                  <div className="flex items-center">
                    {readOnly?<span className="p-1 break-words">{cell.inv}</span>:<input
                      aria-label={`${item.name} inventory`}
                      value={cell.inv}
                      maxLength={12}
                      onChange={e => onInv(item, e.target.value)}
                      className={`w-12 bg-transparent text-center text-base py-1 focus:outline-none focus:ring-2 focus:ring-red-500 ${INK}`}
                    />}
                    {!readOnly && !cell.inv && (
                      <button
                        onClick={() => onInv(item, CHECK)}
                        aria-label={`${item.name}: enough`}
                        className="w-8 text-gray-500 hover:text-blue-800 print:hidden"
                      >
                        {CHECK}
                      </button>
                    )}
                  </div>
                </td>
                <td className={`${cellBorder} p-0 w-16`}>
                  {readOnly?<span className="p-1 break-words">{cell.order}</span>:<input
                    aria-label={`${item.name} order`}
                    value={cell.order}
                    maxLength={12}
                    onChange={e => onOrder(item, e.target.value)}
                    className={`w-16 bg-transparent text-center text-base py-1 focus:outline-none focus:ring-2 focus:ring-red-500 ${INK}`}
                  />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </section>
  )
}

function PairHeader({ past }: { past: boolean }) {
  const hide = past ? pastOnly : ''
  return (
    <>
      <th scope="col" className={`${cellBorder} px-2 py-1 ${hide}`}>INV</th>
      <th scope="col" className={`${cellBorder} px-2 py-1 ${hide}`}>ORDER</th>
    </>
  )
}

function PastPair({ cell }: { cell?: { inv: string; order: string } }) {
  return (
    <>
      <td className={`${cellBorder} px-2 text-center text-base w-14 ${INK} ${pastOnly}`}>{cell?.inv}</td>
      <td className={`${cellBorder} px-2 text-center text-base w-14 ${INK} ${pastOnly}`}>{cell?.order}</td>
    </>
  )
}
