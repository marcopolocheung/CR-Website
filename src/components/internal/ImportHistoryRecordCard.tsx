'use client'
import { useInternalLanguage } from './InternalLanguage'
import type { ImportHistoryRecord } from '@/lib/converter/import-api'
import { snapshotPeriod } from '@/lib/converter/import-history'
import { Button } from './ui/controls'
import RelatedFiles from './RelatedFiles'

export default function ImportHistoryRecordCard({ record, busy, onResume, sources = [], preparer }: { record: ImportHistoryRecord; busy: boolean; onResume: () => void; sources?: File[]; preparer?: string }) {
  const { t, locale } = useInternalLanguage()
  const period = snapshotPeriod(record.data.snapshot)
  const date = (value: string) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed) : value
  }
  const saved = Date.parse(record.createdAt)
  return <li className="border-b border-gray-300 py-4 break-words" data-import-record={record.id}>
    <p className="font-semibold">{record.storeId} · {t(record.data.kind === 'sales' ? 'bookkeeping.sales' : 'bookkeeping.hours')} · {date(period.start)}{period.end !== period.start ? ` – ${date(period.end)}` : ''}</p>
    <p>{t('drafts.preparedBy', { preparer: record.data.reviewedBy })}</p>
    <p>{t('historyHub.savedAt', { time: Number.isFinite(saved) ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(saved) : record.createdAt })}</p>
    <p className="break-all">{t('importHistory.output')}: {record.data.output.filename}</p>
    <p>{t(record.data.supersedesId ? 'historyHub.reprocessed' : 'historyHub.original')}</p>
    <Button data-history="resume" disabled={busy} onClick={onResume} className="mt-3">{t('importHistory.resume')}</Button>
    <details className="mt-2"><summary>{t('historyHub.details')}</summary>
      <p className="break-all">{record.id} · {record.data.parserVersion} · {record.data.workbookMappingVersion} · {t('mapping.revision', { revision: record.data.mappingRevision })}</p>
      <p className="break-all">{record.data.identity} · {record.data.output.sha256}</p>
      {record.data.supersedesId && <p className="break-all">{t('importHistory.supersedes')}: {record.data.supersedesId}</p>}
      {record.data.sources.map(source => <p className="break-all" key={source.slot}>{source.slot} · {source.filename} · {source.fingerprint}</p>)}
      <Button onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))
        const a = document.createElement('a'); a.href = url; a.download = `${record.storeId}-${record.id}-reviewed-import.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }} className="mt-3">{t('importHistory.exportRecord')}</Button>
    </details>
    <RelatedFiles link={{ kind: 'import', key: record.id }} storeId={record.storeId} folder={record.data.kind === 'sales' ? 'Imports/Sales' : 'Imports/Hours'}
      labels={[record.data.kind]} sources={sources} preparer={preparer || record.data.reviewedBy} title="files.importSources" />
  </li>
}
