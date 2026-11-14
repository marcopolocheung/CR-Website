'use client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchCashoutHistory, fetchSavedCashoutRecord, CASHOUT_STORES, type CashoutDay, type CashoutStore } from '@/lib/cashout-store'
import { lookupDates, parseCashoutLookup, type SavedCashoutRecord } from '@/lib/cashout-record'
import { businessDate } from '@/lib/internal-tools/contracts'
import { StoreAuthError } from '@/lib/schedule-store'
import { useManagerSession } from './ManagerSession'
import { useInternalLanguage } from './InternalLanguage'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useShellTask } from './ShellTask'
import { useCashCopyTransition } from './CashCopyTransition'
import { CodeGate, SavedCashDetail, STORE_LABELS } from './CashOut'
import { Button, Field, Paper } from './ui/controls'
import { internalThemeClassName } from './ui/Theme'
import { formatCents } from '@/lib/cashout'
import styles from './cash-history.module.css'

type Load<T> = { state: 'loading' | 'failed' | 'empty'; value?: never } | { state: 'ready'; value: T }
const today = () => new Date().toLocaleDateString('en-CA')
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/,'')
export default function CashHistory() { return <Suspense><Lookup /></Suspense> }
function Lookup() {
  const { t } = useInternalLanguage(), session = useManagerSession(), visible = useWorkspaceVisible()
  const router = useRouter(), search = useSearchParams().toString(), copy = useCashCopyTransition()
  const parsed = parseCashoutLookup(search)
  const [store,setStore] = useState<CashoutStore>(parsed?.store ?? 'CR3')
  const [to,setTo] = useState(today)
  const [exact,setExact] = useState(parsed?.date ?? '')
  const [selected,setSelected] = useState(parsed?.date ?? '')
  const [invalid,setInvalid] = useState(!parsed)
  const [history,setHistory] = useState<Load<CashoutDay[]>>({state:'loading'})
  const [detail,setDetail] = useState<Load<SavedCashoutRecord>>({state:'loading'})
  const [retry,setRetry] = useState(0)
  const [editing,setEditing] = useState(false), [preparer,setPreparer] = useState(''), [copyFailed,setCopyFailed] = useState(false), [copyBusy,setCopyBusy] = useState(false)
  const listSequence = useRef(0), detailSequence = useRef(0)
  useShellTask('cash-history', { context: session.token ? `${t('cash.lookup.title')} · ${store}` : null })
  const appliedSearch = useRef<string | null>(null)
  useEffect(() => {
    if (!visible || appliedSearch.current === search) return
    appliedSearch.current = search
    const next = parseCashoutLookup(search)
    setInvalid(!next)
    setEditing(false); setCopyFailed(false)
    if (next && search) { setStore(next.store); setSelected(next.date ?? ''); if (next.date) setExact(next.date) }
  }, [search,visible])
  const denied = useCallback((caught: unknown) => { if (caught instanceof StoreAuthError) session.expire() }, [session.expire])
  useEffect(() => {
    const id = ++listSequence.current
    if (!visible || !session.token || invalid || !parsed || (search !== '' && (parsed.store !== store || (parsed.date ?? '') !== selected)) || !businessDate(to)) return
    let alive = true
    setHistory({state:'loading'})
    void fetchCashoutHistory(store,to,session.token).then(days => {
      if (alive && id === listSequence.current) setHistory(days.length ? {state:'ready',value:days} : {state:'empty'})
    }).catch(caught => { if (alive && id === listSequence.current) { denied(caught); setHistory({state:'failed'}) } })
    return () => { alive = false }
  }, [store,to,selected,retry,visible,session.token,session.generation,invalid,search,denied])
  useEffect(() => {
    const id = ++detailSequence.current
    setEditing(false); setCopyFailed(false)
    if (!visible || !session.token || invalid || !parsed || (search !== '' && (parsed.store !== store || parsed.date !== selected)) || !selected || !businessDate(selected)) return
    let alive = true
    setDetail({state:'loading'})
    void fetchSavedCashoutRecord(store,selected,session.token).then(record => {
      if (alive && id === detailSequence.current) setDetail(record ? {state:'ready',value:record} : {state:'empty'})
    }).catch(caught => { if (alive && id === detailSequence.current) { denied(caught); setDetail({state:'failed'}) } })
    return () => { alive = false }
  }, [store,selected,retry,visible,session.token,session.generation,invalid,search,denied])
  const openExact = () => {
    if (!businessDate(exact)) return
    setInvalid(false)
    router.push(`/internal/cash-history?store=${store}&date=${exact}`)
    setSelected(exact); setRetry(r => r + 1)
  }
  const changeStore = (value: CashoutStore) => {
    listSequence.current++; detailSequence.current++
    setStore(value); setSelected(''); setExact(''); setEditing(false)
    router.push(`/internal/cash-history?store=${value}`)
  }
  const record = detail.state === 'ready' && detail.value.store === store && detail.value.date === selected ? detail.value : null
  return <div className={`${internalThemeClassName} ${styles.workspace}`}>
    <h1>{t('cash.lookup.title')}</h1>
    {!session.token && visible && <CodeGate onUnlock={session.unlock} title={t('cash.lookup.title')} />}
    <div hidden={!session.token}>
      <div className="print:hidden">
        <a href={`${base}/internal/bookkeeping#cash-out`}>{t('cash.lookup.return')}</a>
        <p>{t('cash.lookup.retention')}</p>
        <p>{t('cash.lookup.linkMeaning')}</p>
        {invalid && <p role="alert">{t('cash.lookup.invalidLink')}</p>}
        <Paper className={styles.filters}>
          <div><label htmlFor="cash-history-store">{t('common.store')}</label><select id="cash-history-store" value={store} onChange={e => changeStore(e.target.value as CashoutStore)}>
            {CASHOUT_STORES.map(s => <option key={s} value={s}>{STORE_LABELS[s]}</option>)}
          </select></div>
          <Field id="cash-history-to" label={t('cash.lookup.endDate')} type="date" value={to} onChange={e => { listSequence.current++; setTo(e.target.value) }} />
          <Button disabled={!businessDate(to)} onClick={() => { setInvalid(false); router.push(`/internal/cash-history?store=${store}`); setSelected(''); setRetry(r => r + 1) }}>{t('cash.lookup.windowAction')}</Button>
          <Field id="cash-history-exact" label={t('cash.lookup.exact')} type="date" value={exact} onChange={e => setExact(e.target.value)} />
          <Button disabled={!businessDate(exact)} onClick={openExact}>{t('cash.lookup.open')}</Button>
        </Paper>
        {!invalid && businessDate(to) && <section aria-label={t('cash.lookup.window')} data-lookup-window>
          <h2>{t('cash.lookup.windowLabel', {from:lookupDates(to)[29],to})}</h2>
          {history.state === 'loading' && <p role="status">{t('common.loading')}</p>}
          {history.state === 'empty' && <p role="status">{t('cash.lookup.empty')}</p>}
          {history.state === 'failed' && <div role="alert"><p>{t('cash.lookup.failed')}</p><Button onClick={() => setRetry(r => r + 1)}>{t('reports.retry')}</Button></div>}
          {history.state === 'ready' && <div className={styles.table}><table><thead><tr>
            <th>{t('common.date')}</th><th>{t('cash.dayDeposit')}</th><th>{t('cash.lookup.savedTime')}</th>
          </tr></thead><tbody>{history.value.map(day => <tr key={day.date}>
            <td><a href={`${base}/internal/cash-history?store=${store}&date=${day.date}`}>{day.date}</a></td><td>{formatCents(day.totals.deposit)}</td><td>{day.updatedAt}</td>
          </tr>)}</tbody></table></div>}
        </section>}
      </div>
      {!invalid && selected && <section aria-label={t('cash.lookup.exact')} data-lookup-detail>
        {!record && <h2>{store} · {selected}</h2>}
        {detail.state === 'loading' && <p role="status">{t('common.loading')}</p>}
        {detail.state === 'empty' && <p role="status">{t('cash.lookup.missing')}</p>}
        {detail.state === 'failed' && <div role="alert"><p>{t('cash.lookup.recordFailed')}</p><Button onClick={() => setRetry(r => r + 1)}>{t('reports.retry')}</Button></div>}
        {record && <>
          <div className={`${styles.actions} print:hidden`}>
            <Button icon="print" onClick={() => window.print()}>{t('common.print')}</Button>
            <Button onClick={() => setEditing(true)}>{t('cash.lookup.editCopy')}</Button>
          </div>
          {editing && <form className={`${styles.edit} print:hidden`} onSubmit={async e => {
            e.preventDefault(); if (copyBusy) return
            setCopyBusy(true); setCopyFailed(false)
            try { if (!await copy.copy(record,preparer)) setCopyFailed(true) } finally { setCopyBusy(false) }
          }}>
            <p>{t('cash.lookup.destination', {store:record.store,date:record.date})}</p>
            <Field id="cash-copy-preparer" label={t('drafts.preparer')} value={preparer} required maxLength={120} onChange={e => setPreparer(e.target.value)} hint={t('drafts.preparerHelp')} />
            <div className={styles.actions}><Button type="submit" variant="primary" disabled={!preparer.trim() || copyBusy}>{t('cash.lookup.createCopy')}</Button><Button disabled={copyBusy} onClick={() => setEditing(false)}>{t('feedback.cancel')}</Button></div>
            {copyFailed && <p role="alert">{t('cash.lookup.copyFailed')}</p>}
          </form>}
          <SavedCashDetail record={record} />
        </>}
      </section>}
    </div>
  </div>
}
