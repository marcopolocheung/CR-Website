'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { translate, LOCALE_STORAGE_KEY, type TranslationKey } from '@/lib/internal-tools/i18n'
import type { Locale } from '@/lib/internal-tools/contracts'
import { REQUEST_POLICY, MAX_REQUESTS, requestsOverlap, validRequestData, type RequestData, type RequestRecord, type ScheduleRequest } from '@/lib/scheduler/requests'
import { putRequests, RequestApiError } from '@/lib/scheduler/request-store'
import type { Employee } from '@/lib/scheduler'
import type { ScheduleRequestsSource } from './useScheduleRequests'

const field = 'min-h-11 w-full rounded border border-zinc-400 bg-white px-3 py-2 text-base disabled:bg-zinc-100'
const button = 'min-h-11 rounded border border-zinc-400 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2'
function localTime() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
type Attempt = { previous: RequestRecord | null; data: RequestData; preparer: string; operation: string; kind: 'entry' | 'review'; id: string }
export default function RequestsPanel({ source, employees, weekStart, token, locale, onLocaleChange, onDirtyChange }: {
  source: ScheduleRequestsSource; employees: Employee[]; weekStart: string; token: string; locale: Locale; onLocaleChange: (locale: Locale) => void; onDirtyChange: (dirty: boolean) => void
}) {
  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params)
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [kind, setKind] = useState<'time-off' | 'availability'>('time-off')
  const [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [from, setFrom] = useState('11:00'), [until, setUntil] = useState('21:00'), [nextDay, setNextDay] = useState(false)
  const [reason, setReason] = useState(''), [preparer, setPreparer] = useState(''), [received, setReceived] = useState('')
  const [reviewer, setReviewer] = useState(''), [reviewReasons, setReviewReasons] = useState<Record<string, string>>({})
  const [draftId, setDraftId] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null), [notice, setNotice] = useState<TranslationKey | null>(null)
  const [confirmReload, setConfirmReload] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; setReceived(localTime()); setDraftId(crypto.randomUUID()); return () => { mounted.current = false } }, [])
  useEffect(() => { if (weekStart) { setStart(current => current || weekStart); setEnd(current => current || weekStart) } }, [weekStart])
  const dirty = !!employeeId || !!reason || Object.values(reviewReasons).some(Boolean) || !!attempt
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  const requests = source.record?.data.requests ?? []
  function resetEntry() { setEmployeeId(''); setReason(''); setReceived(localTime()); setDraftId(crypto.randomUUID()) }
  async function run(next: Attempt) {
    setAttempt(next); setBusy(true); setError(null); setNotice(null); source.invalidate()
    try {
      const saved = await putRequests(source.station, token, next.previous, next.data, next.preparer, next.operation)
      if (!mounted.current) return
      source.accept(saved); setAttempt(null); setNotice('requests.saved')
      if (next.kind === 'entry') resetEntry()
      else setReviewReasons(current => ({ ...current, [next.id]: '' }))
    } catch (caught) {
      if (!mounted.current) return
      const code = caught instanceof RequestApiError ? caught.code : 'unavailable'
      setError(code === 'conflict' ? 'requests.conflict' : code === 'invalid' ? 'requests.invalid' : code === 'unauthorized' ? 'requests.unauthorized' : 'requests.failed')
      // Retain the exact attempted body and operation ID until retry or an explicit reload resolves it.
    } finally { if (mounted.current) setBusy(false) }
  }
  async function reload() {
    setConfirmReload(false); setBusy(true); setError(null); setNotice(null)
    const latest = await source.reload()
    if (!mounted.current) return
    if (latest) {
      if (attempt?.kind === 'entry' && latest.record?.data.requests.some(item => item.id === attempt.id)) resetEntry()
      setAttempt(null); setNotice('requests.reloaded')
    } else setError('requests.failed')
    setBusy(false)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || attempt || source.phase !== 'ready') return
    const employee = employees.find(item => item.id === employeeId)
    const minute = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
    const instant = new Date(received)
    if (!employee || !Number.isFinite(instant.getTime())) { setError('requests.invalid'); return }
    const item: ScheduleRequest = { id: draftId, employee: { stationId: source.station, sourceEmployeeId: employee.id, name: employee.name }, kind,
      startDate: start, endDate: end, ranges: kind === 'time-off' ? [] : [{ start: minute(from), end: minute(until) + (nextDay ? 1440 : 0) }],
      reason, requestedAt: instant.toISOString(), enteredAt: new Date().toISOString(), enteredBy: preparer.trim(), policyVersion: REQUEST_POLICY, status: 'pending', review: null }
    const data: RequestData = { version: 1, stationId: source.station, requests: [...requests, item] }
    if (!validRequestData(data, source.station)) { setError('requests.invalid'); return }
    void run({ previous: source.record, data, preparer: preparer.trim(), operation: crypto.randomUUID(), kind: 'entry', id: item.id })
  }
  function review(item: ScheduleRequest, status: 'approved' | 'declined') {
    if (!reviewer.trim() || busy || attempt || source.phase !== 'ready') return
    const changed: ScheduleRequest = { ...item, status, review: { by: reviewer.trim(), at: new Date().toISOString(), reason: reviewReasons[item.id] ?? '' } }
    const data: RequestData = { version: 1, stationId: source.station, requests: requests.map(request => request.id === item.id ? changed : request) }
    if (!validRequestData(data, source.station)) { setError('requests.overlap'); return }
    void run({ previous: source.record, data, preparer: reviewer.trim(), operation: crypto.randomUUID(), kind: 'review', id: item.id })
  }
  const active = source.phase === 'ready' && !busy && !attempt
  return <section id="schedule-requests" className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm print:hidden" aria-label={t('requests.title')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={button} aria-expanded={open} aria-controls="schedule-requests-panel" onClick={() => setOpen(value => !value)}>{t('requests.title')} · {requests.filter(item => item.status === 'pending').length}</button>
      <div role="group" aria-label={t('requests.language')} className="flex gap-2">{(['en', 'es'] as const).map(language => <button key={language} type="button" className={button} lang={language} aria-pressed={locale === language} onClick={() => { onLocaleChange(language); try { localStorage.setItem(LOCALE_STORAGE_KEY, language) } catch { /* optional preference */ } }}>{language === 'en' ? 'English' : 'Español'}</button>)}</div>
    </div>
    <p className="mt-2 text-sm text-zinc-700" role="status">{t(source.phase === 'ready' ? 'requests.loaded' : source.phase === 'loading' ? 'requests.loading' : source.phase === 'unconfigured' ? 'requests.unconfigured' : source.phase === 'uncertain' ? 'requests.uncertain' : 'requests.failed', { station: source.station, revision: source.record?.revision ?? 0 })}</p>
    {error && <p className="mt-2 font-medium text-red-800" role="alert">{t(error)}</p>}
    {notice && <p className="mt-2 text-sm text-green-900" role="status">{t(notice)}</p>}
    <div id="schedule-requests-panel" hidden={!open} className="mt-4 space-y-5" lang={locale}>
      <p className="text-sm text-zinc-700">{t('requests.policy')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => { if (attempt) setConfirmReload(true); else void reload() }}>{t('requests.reload')}</button>
        {attempt && <button type="button" className={button} disabled={busy} onClick={() => void run(attempt)}>{t('requests.retry')}</button>}
      </div>
      {confirmReload && <div className="rounded border border-amber-500 bg-amber-50 p-3" role="group" aria-label={t('requests.resolve')}><p>{t('requests.reloadWarning')}</p><div className="mt-2 flex gap-2"><button type="button" className={button} onClick={() => void reload()}>{t('requests.reload')}</button><button type="button" className={button} onClick={() => setConfirmReload(false)}>{t('requests.cancel')}</button></div></div>}
      <form onSubmit={submit}>
        <h2 className="font-semibold">{t('requests.new')}</h2>
        <fieldset disabled={!active || requests.length >= MAX_REQUESTS} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>{t('requests.employee')}<select className={field} aria-label={t('requests.employee')} value={employeeId} onChange={event => { setEmployeeId(event.target.value); setNotice(null) }} required><option value="">{t('requests.choose')}</option>{employees.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
          <label>{t('requests.kind')}<select className={field} aria-label={t('requests.kind')} value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="time-off">{t('requests.timeOff')}</option><option value="availability">{t('requests.availability')}</option></select></label>
          <label>{t('requests.enteredBy')}<input className={field} value={preparer} maxLength={120} onChange={event => setPreparer(event.target.value)} required autoComplete="off" /></label>
          <label>{t('requests.start')}<input className={field} type="date" value={start} onChange={event => setStart(event.target.value)} required /></label>
          <label>{t('requests.end')}<input className={field} type="date" value={end} onChange={event => setEnd(event.target.value)} required /></label>
          <label>{t('requests.received')}<input className={field} type="datetime-local" aria-label={t('requests.received')} value={received} onChange={event => setReceived(event.target.value)} required /><span className="text-xs">{t('requests.deviceTime')}</span></label>
          {kind === 'availability' && <><label>{t('requests.from')}<input className={field} type="time" value={from} onChange={event => setFrom(event.target.value)} required /></label><label>{t('requests.until')}<input className={field} type="time" value={until} onChange={event => setUntil(event.target.value)} required /></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={nextDay} onChange={event => setNextDay(event.target.checked)} />{t('requests.nextDay')}</label></>}
          <label className="sm:col-span-2">{t('requests.reason')}<textarea className={field} aria-label={t('requests.reason')} value={reason} maxLength={1000} onChange={event => { setReason(event.target.value); setNotice(null) }} /></label>
          <div className="flex items-end"><button className={`${button} bg-zinc-900 text-white hover:bg-zinc-700`} type="submit" disabled={!preparer.trim() || !employeeId}>{t(busy ? 'requests.saving' : 'requests.savePending')}</button></div>
        </fieldset>
        {requests.length >= MAX_REQUESTS && <p role="alert">{t('requests.capacity')}</p>}
      </form>
      <label className="block max-w-md">{t('requests.reviewer')}<input className={field} value={reviewer} maxLength={120} onChange={event => setReviewer(event.target.value)} disabled={busy || !!attempt} autoComplete="off" /></label>
      {(['pending','approved','declined'] as const).map(status => <section key={status} aria-label={t(`requests.${status}`)}>
        <h2 className="font-semibold">{t(`requests.${status}`)}</h2>
        {!requests.some(item => item.status === status) && <p className="mt-1 text-sm text-zinc-600">{t('requests.empty')}</p>}
        <ul className="mt-2 space-y-3">{requests.filter(item => item.status === status).map(item => <li key={item.id} className="rounded border border-zinc-300 p-3">
          <h3 className="font-semibold">{item.employee.name} · {item.startDate} – {item.endDate} · {t(item.kind === 'time-off' ? 'requests.timeOff' : 'requests.availability')}</h3>
          <p className="break-words whitespace-pre-wrap">{item.reason}</p>
          {item.ranges.length > 0 && <p>{item.ranges.map(range => `${String(Math.floor(range.start / 60)).padStart(2, '0')}:${String(range.start % 60).padStart(2, '0')} – ${String(Math.floor((range.end % 1440) / 60)).padStart(2, '0')}:${String(range.end % 60).padStart(2, '0')}${range.end >= 1440 ? ' (+1)' : ''}`).join(', ')}</p>}
          <p className="mt-1 break-words text-xs text-zinc-600">{item.employee.stationId} · {item.employee.sourceEmployeeId} · {t('requests.received')}: {item.requestedAt} · {t('requests.enteredBy')}: {item.enteredBy} · {item.enteredAt}</p>
          {requests.some(other => other.id !== item.id && other.status !== 'declined' && requestsOverlap(item, other)) && <p className="mt-1 text-sm text-amber-900">{t('requests.overlapHint')}</p>}
          {item.review ? <p className="mt-2 break-words whitespace-pre-wrap text-sm">{t('requests.reviewer')}: {item.review.by} · {item.review.at} · {item.review.reason}</p> : <div className="mt-3 space-y-2"><label className="block">{t('requests.reviewReason')}<textarea className={field} aria-label={t('requests.reviewReason')} value={reviewReasons[item.id] ?? ''} maxLength={1000} disabled={!active} onChange={event => setReviewReasons(current => ({ ...current, [item.id]: event.target.value }))} /></label><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!active || !reviewer.trim()} onClick={() => review(item, 'approved')}>{t('requests.approve')}</button><button type="button" className={button} disabled={!active || !reviewer.trim()} onClick={() => review(item, 'declined')}>{t('requests.decline')}</button></div></div>}
        </li>)}</ul>
      </section>)}
    </div>
  </section>
}
