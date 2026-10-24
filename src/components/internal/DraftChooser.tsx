'use client'

import { useEffect, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { EmptyState } from './Feedback'
import { draftContextKey, listDrafts, newDraft, type Draft, type DraftContext, type DraftList } from '@/lib/internal-tools/drafts'
import type { Json } from '@/lib/internal-tools/contracts'

export function downloadDraftSource(raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'internal-draft-source.txt'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function DraftChooser<T extends Json>({ context, preparer, createPayload, validate, onOpen }: {
  context: DraftContext; preparer: string; createPayload: () => T; validate: (value: unknown) => value is T; onOpen: (draft: Draft<T>) => void
}) {
  const { t } = useInternalLanguage()
  const [result, setResult] = useState<DraftList<T>>({ state: 'available', sources: [] })
  const [refresh, setRefresh] = useState(0)
  const contextKey = draftContextKey(context)
  useEffect(() => {
    const read = () => {
      try { setResult(listDrafts(localStorage, context, validate)) }
      catch { setResult({ state: 'unavailable', sources: [] }) }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [contextKey, refresh, context, validate])
  const start = (source?: Draft<T>) => {
    if (!preparer.trim()) return
    onOpen(newDraft(context, preparer, source?.payload ?? createPayload(), source ? { source } : {}))
  }
  return <section aria-label={t('drafts.choose')} className="my-4 rounded-xl border border-gray-200 bg-white p-4 print:hidden">
    <h2 className="font-semibold text-gray-900">{t('drafts.choose')}</h2>
    <p className="mt-1 text-sm text-gray-600">{t('drafts.deviceOnly')}</p>
    {result.state === 'unavailable' && <p role="alert" className="mt-3 text-sm text-red-700">{t('drafts.storageUnavailable')}</p>}
    <button type="button" onClick={() => start()} disabled={!preparer.trim()} className="my-3 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('drafts.startNew')}</button>
    <button type="button" onClick={() => setRefresh(v => v + 1)} className="ml-2 min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('drafts.refresh')}</button>
    {result.state === 'available' && !result.sources.length && <EmptyState message={{ key: 'drafts.empty' }} />}
    <ul className="space-y-3">{result.sources.map(source => <li key={source.key} className="rounded-lg border border-gray-200 p-3">
      {source.state === 'ready' ? <>
        <p className="font-medium">{t('drafts.label', { task: t(`drafts.task.${source.draft.context.task}`), store: source.draft.context.storeId, date: source.draft.context.businessDate ?? `${source.draft.context.period.start} – ${source.draft.context.period.end}` })}</p>
        {source.draft.context.stationId && <p className="text-sm">{t('drafts.station', { station: source.draft.context.stationId })}</p>}
        {source.draft.context.shift && <p className="text-sm">{t('drafts.shift', { shift: source.draft.context.shift })}</p>}
        {source.draft.context.recordId && <p className="text-sm">{t('drafts.record', { record: source.draft.context.recordId })}</p>}
        <p className="break-words text-sm text-gray-700">{t('drafts.preparedBy', { preparer: source.draft.preparer })}</p>
        <p className="text-sm text-gray-600">{t('drafts.savedAt', { time: source.draft.updatedAt })}</p>
        {source.upgraded && <p className="text-sm text-gray-600">{t('drafts.upgradedCopy')}</p>}
        <button type="button" onClick={() => start(source.draft)} disabled={!preparer.trim()} className="mt-2 min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t('drafts.resumeCopy')}</button>
      </> : <p role="alert" className="text-sm text-red-700">{t('drafts.unreadable')}</p>}
      <button type="button" onClick={() => downloadDraftSource(source.raw)} className="ml-2 min-h-11 px-3 py-2 text-sm text-red-700 underline">{t('drafts.downloadSource')}</button>
    </li>)}</ul>
  </section>
}
