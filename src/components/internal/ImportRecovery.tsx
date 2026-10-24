'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { useConfirmation } from './Feedback'
import { downloadDraftSource } from './DraftChooser'
import { draftContextKey, listDrafts, newDraft, saveDraft, type Draft, type DraftContext, type DraftList } from '@/lib/internal-tools/drafts'
import { snapshotMatchesContext, type ImportSnapshot } from '@/lib/converter/import-snapshot'
import { workbookBytes } from '@/lib/converter/workbook-output'

export default function ImportRecovery({ context, preparer, snapshot, hasWork, busy, onRestore, onSaved }: {
  context: DraftContext | null; preparer: string; snapshot: ImportSnapshot | null; hasWork: boolean; busy: boolean
  onRestore: (snapshot: ImportSnapshot) => void; onSaved: (saved: boolean) => void
}) {
  const { t } = useInternalLanguage()
  const confirmation = useConfirmation()
  const [result, setResult] = useState<DraftList<ImportSnapshot> | null>(null)
  const [source, setSource] = useState<Draft<ImportSnapshot> | null>(null)
  const [status, setStatus] = useState<{ key: 'importRetention.saved' | 'importRetention.failed' | 'importRetention.corrupt' | 'importRetention.nameRequired'; version: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const key = context ? draftContextKey(context) : ''
  const version = useMemo(() => snapshot ? JSON.stringify(snapshot) : '', [snapshot])
  const matches = useCallback((value: unknown): value is ImportSnapshot => !!context && snapshotMatchesContext(value, context), [key])
  const current = useRef({ key, version }); current.current = { key, version }
  const saved = !!version && status?.key === 'importRetention.saved' && status.version === version
  useEffect(() => { onSaved(saved) }, [saved, onSaved])
  useEffect(() => {
    const read = () => {
      if (!context) { setResult(null); return }
      try { setResult(listDrafts(localStorage, context, matches)) }
      catch { setResult({ state: 'unavailable', sources: [] }) }
    }
    read(); window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [key, context, matches, refresh])
  const save = () => {
    if (!snapshot || !context || !matches(snapshot)) return
    if (!preparer.trim() || preparer.length > 120) { setStatus({ key: 'importRetention.nameRequired', version }); return }
    try {
      const prior = source && draftContextKey(source.context) === key ? source : undefined
      const draft = newDraft(context, preparer, snapshot, prior ? { source: prior } : {})
      const outcome = saveDraft(localStorage, draft, matches)
      setStatus({ key: outcome.state === 'saved' ? 'importRetention.saved' : 'importRetention.failed', version })
      if (outcome.state === 'saved') { setSource(draft); setRefresh(value => value + 1) }
    } catch { setStatus({ key: 'importRetention.failed', version }) }
  }
  const resume = async (draft: Draft<ImportSnapshot>) => {
    if (pending || !context || !matches(draft.payload)) return
    const expected = { key, version }
    if (hasWork && !await confirmation.ask({ key: 'importRetention.resumeWarning' }, true)) return
    setPending(true)
    try {
      if (draft.payload.output) await workbookBytes(draft.payload.output)
      if (current.current.key !== expected.key || current.current.version !== expected.version) return
      // Never update the source record. A later save creates an independent UUID/key.
      setSource(draft); onRestore(structuredClone(draft.payload)); setStatus(null)
    } catch { setStatus({ key: 'importRetention.corrupt', version }) }
    finally { setPending(false) }
  }
  return <section aria-label={t('importRetention.recovery')} className="mt-5 border-t border-gray-200 pt-4 print:hidden">
    {confirmation.dialog}
    <h3 className="font-semibold text-gray-900">{t('importRetention.recovery')}</h3>
    <p className="mt-1 text-sm text-gray-700">{t('importRetention.session')}</p>
    <p className="mt-1 text-sm text-gray-700">{t('importRetention.deviceNote')}</p>
    <button type="button" onClick={save} disabled={!snapshot || !context || busy || pending} className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t('importRetention.save')}</button>
    {status && status.version === version && <p role={status.key === 'importRetention.saved' ? 'status' : 'alert'} className={`mt-2 text-sm ${status.key === 'importRetention.saved' ? 'text-gray-700' : 'text-red-800'}`}>{t(status.key)}</p>}
    {(!context || !snapshot) && <p className="mt-2 text-sm text-gray-600">{t('importRetention.prepareFirst')}</p>}
    {!context ? <p className="mt-2 text-sm text-gray-600">{t('importRetention.selectContext')}</p> : <>
      <p className="mt-3 text-sm font-semibold">{t('drafts.label', { task: t(`drafts.task.${context.task}`), store: context.storeId, date: context.businessDate ?? `${context.period.start} – ${context.period.end}` })}</p>
      <button type="button" disabled={busy || pending} onClick={() => setRefresh(value => value + 1)} className="min-h-11 px-2 py-2 text-sm text-red-700 underline">{t('drafts.refresh')}</button>
      {result?.state === 'unavailable' && <p role="alert" className="text-sm text-red-800">{t('drafts.storageUnavailable')}</p>}
      {result?.state === 'available' && !result.sources.length && <p className="text-sm text-gray-600">{t('drafts.empty')}</p>}
      <ul className="mt-2 space-y-3">{result?.sources.map(item => <li key={item.key} className="rounded-lg border border-gray-200 p-3 text-sm">
        {item.state === 'ready' ? <>
          <p>{t('drafts.preparedBy', { preparer: item.draft.preparer })}</p>
          <p>{t('drafts.savedAt', { time: item.draft.updatedAt })}</p>
          <p className="break-words">{item.draft.payload.kind === 'sales' ? item.draft.payload.review.sources.map(source => source.filename).join(' · ') : item.draft.payload.sourceName}</p>
          <p>{t(item.draft.payload.output ? 'importRetention.outputStored' : 'importRetention.valuesStored')}</p>
          <button type="button" disabled={busy || pending} onClick={() => { void resume(item.draft) }} className="mt-2 min-h-11 rounded-lg border border-red-300 px-3 py-2 font-medium text-red-700 disabled:opacity-50">{t('drafts.resumeCopy')}</button>
        </> : <p role="alert" className="text-red-800">{t('drafts.unreadable')}</p>}
        <button type="button" onClick={() => downloadDraftSource(item.raw)} className="min-h-11 px-3 py-2 text-red-700 underline">{t('drafts.downloadSource')}</button>
      </li>)}</ul>
    </>}
  </section>
}
