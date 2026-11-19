'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { businessDate, type StoreId } from '@/lib/internal-tools/contracts'
import { getHistory, type ImportHistoryRecord } from '@/lib/converter/import-api'
import { useImportAccess } from './useImportAccess'
import { useManagerSession } from './ManagerSession'
import { useImportResumeTransition } from './ImportResumeTransition'
import { useInternalLanguage } from './InternalLanguage'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { useShellTask } from './ShellTask'
import ImportHistoryRecordCard from './ImportHistoryRecordCard'
import { CodeGate } from './CashOut'
import { InternalTheme } from './ui/Theme'
import { Button, Paper } from './ui/controls'
import styles from './import-history-workspace.module.css'

type Query = { store: StoreId; kind: 'sales' | 'hours'; start: string; end: string }
const EMPTY: Query = { store: 'CR3', kind: 'sales', start: '', end: '' }
function queryFrom(search: string): Query | null {
  if (!search) return EMPTY
  const params = new URLSearchParams(search)
  if ([...params.keys()].some(key => !['store','kind','start','end'].includes(key) || params.getAll(key).length !== 1)) return null
  const store = params.get('store'), kind = params.get('kind'), start = params.get('start') ?? '', end = params.get('end') ?? ''
  if (!['CR2','CR3'].includes(store ?? '') || !['sales','hours'].includes(kind ?? '') || !businessDate(start) || !businessDate(end) || start > end || kind === 'sales' && start !== end) return null
  return { store: store as StoreId, kind: kind as Query['kind'], start, end }
}
export default function ImportHistoryWorkspace() { return <Suspense><History /></Suspense> }
function History() {
  const { t } = useInternalLanguage(), session = useManagerSession(), failureKey = useImportAccess(), visible = useWorkspaceVisible(), transition = useImportResumeTransition()
  const search = useSearchParams().toString()
  const [query, setQuery] = useState<Query>(() => queryFrom(search) ?? EMPTY)
  const [invalidLink, setInvalidLink] = useState(!queryFrom(search))
  const [loaded, setLoaded] = useState<Query | null>(null), [records, setRecords] = useState<ImportHistoryRecord[]>([]), [cursor, setCursor] = useState<string | null>(null)
  const [pending, setPending] = useState(false), [status, setStatus] = useState(''), [resuming, setResuming] = useState(false)
  const sequence = useRef(0), running = useRef(false), live = useRef(session); live.current = session
  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!visible || applied.current === search) return
    applied.current = search; sequence.current++; running.current = false; setPending(false)
    const parsed = queryFrom(search); setInvalidLink(!parsed)
    if (parsed && search) setQuery(parsed)
  }, [search, visible])
  useEffect(() => { sequence.current++; running.current = false; setPending(false); setStatus('') }, [session.generation])
  const key = JSON.stringify(query), matches = !!loaded && JSON.stringify(loaded) === key
  const valid = !!businessDate(query.start) && !!businessDate(query.end) && query.start <= query.end && (query.kind === 'hours' || query.start === query.end)
  useShellTask('import-history', { context: session.token ? `${query.store} · ${query.start}${query.end !== query.start ? ' – ' + query.end : ''}` : null })
  function change(patch: Partial<Query>) { sequence.current++; running.current = false; setPending(false); setInvalidLink(false); setQuery(current => ({ ...current, ...patch })); setStatus('') }
  async function load(more = false) {
    if (running.current || !session.token || !valid || invalidLink || more && (!matches || !cursor)) return
    const at = ++sequence.current, generation = session.generation, captured = { ...query }
    running.current = true; setPending(true); setStatus('historyHub.loading')
    try {
      const page = await getHistory(captured.store, captured.kind, captured.start, captured.end, session.token, more ? cursor! : '')
      if (at !== sequence.current || generation !== live.current.generation || !live.current.token) return
      setRecords(old => more ? [...old, ...page.records.filter(record => !old.some(prior => prior.id === record.id))] : page.records)
      setCursor(page.nextCursor); setLoaded(captured); setStatus(page.records.length || more ? 'importHistory.loaded' : 'importHistory.empty')
    } catch (error) { if (at === sequence.current && generation === live.current.generation) setStatus(failureKey(error)) }
    finally { if (at === sequence.current) { running.current = false; setPending(false) } }
  }
  return <InternalTheme><Paper emphasis="active" className={styles.workspace}>
    <h1>{t('importHistory.title')}</h1><p className="mt-3">{t('historyHub.bounds')}</p>
    {!session.token && <CodeGate id="import-history-code" title={t('importHistory.title')} onUnlock={session.unlock} />}
    <fieldset disabled={pending || resuming} className={styles.filters}>
      <div><label htmlFor="import-history-store">{t('common.store')}</label><select id="import-history-store" value={query.store} onChange={event => change({ store: event.target.value as StoreId })}><option value="CR3">CR3</option><option value="CR2">CR2</option></select></div>
      <div><label htmlFor="import-history-kind">{t('historyHub.kind')}</label><select id="import-history-kind" value={query.kind} onChange={event => change({ kind: event.target.value as Query['kind'], end: query.start })}><option value="sales">{t('bookkeeping.sales')}</option><option value="hours">{t('bookkeeping.hours')}</option></select></div>
      <div><label htmlFor="import-history-start">{t(query.kind === 'sales' ? 'common.date' : 'imports.startDate')}</label><input id="import-history-start" type="date" value={query.start} onChange={event => change({ start: event.target.value, ...(query.kind === 'sales' ? { end: event.target.value } : {}) })} /></div>
      {query.kind === 'hours' && <div><label htmlFor="import-history-end">{t('imports.endDate')}</label><input id="import-history-end" type="date" value={query.end} onChange={event => change({ end: event.target.value })} /></div>}
    </fieldset>
    {invalidLink && <p role="alert">{t('historyHub.invalidLink')}</p>}
    {!valid && !invalidLink && <p className="mt-3">{t('historyHub.choose')}</p>}
    <Button id="import-history-load" variant="primary" disabled={!session.token || !valid || invalidLink || pending || resuming} busy={pending} onClick={() => void load()}>{t('importHistory.load')}</Button>
    <p role="status" className="mt-3">{status ? t(status as 'importHistory.loaded') : ''}</p>
    <div hidden={!session.token}>
      {loaded && <p className="mt-4 font-semibold" data-history-scope>{t('historyHub.displayed', { store: loaded.store, start: loaded.start, end: loaded.end })} · {t(loaded.kind === 'sales' ? 'bookkeeping.sales' : 'bookkeeping.hours')}</p>}
      {loaded && !matches && <p role="alert" className="mt-2">{t('historyHub.stale')}</p>}
      <ul>{records.map(record => <ImportHistoryRecordCard key={record.id} record={record} busy={pending || resuming} onResume={() => {
        setResuming(true); void transition.resume(record).then(done => { if (!done) setStatus('historyHub.notReplaced') }).finally(() => setResuming(false))
      }} />)}</ul>
      {cursor && <Button id="import-history-more" disabled={!matches || pending || resuming} onClick={() => void load(true)} className="mt-4">{t('importHistory.more')}</Button>}
    </div>
  </Paper></InternalTheme>
}
