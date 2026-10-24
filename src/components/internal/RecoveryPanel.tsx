'use client'

import { useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { downloadDraftSource } from './DraftChooser'
import type { Message } from '@/lib/internal-tools/i18n'
export type ComparisonRow = { id: string; label: string; yours: string; theirs: string }
export default function RecoveryPanel({ message, copyText, onRetry, onReload, onUseServer, rows, retryLabel, busy = false }: {
  message: Message; retryLabel?: Message; copyText: () => string; onRetry?: () => void; onReload?: () => void; onUseServer?: () => void; rows?: ComparisonRow[]; busy?: boolean
}) {
  const { t } = useInternalLanguage()
  const [copyStatus,setCopyStatus] = useState<Message | null>(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(copyText()); setCopyStatus({key:'recovery.copied'}) }
    catch { setCopyStatus({key:'recovery.copyFailed'}) }
  }
  return <section aria-label={t('recovery.title')} className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 print:hidden">
    <p className="text-sm text-amber-950">{t(message.key,message.params)}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {onRetry && <button type="button" disabled={busy} onClick={onRetry} className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm disabled:opacity-50">{retryLabel ? t(retryLabel.key,retryLabel.params) : t('recovery.retry')}</button>}
      {onReload && <button type="button" disabled={busy} onClick={onReload} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">{t('recovery.reloadCompare')}</button>}
      <button type="button" onClick={copy} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('recovery.copy')}</button>
      <button type="button" onClick={() => downloadDraftSource(copyText())} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm">{t('recovery.download')}</button>
      {onUseServer && <button type="button" disabled={busy} onClick={onUseServer} className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">{t('recovery.useServer')}</button>}
    </div>
    {copyStatus && <p role="status" className="mt-2 text-sm">{t(copyStatus.key)}</p>}
    {rows && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="text-left font-semibold">{t('recovery.compare')}</caption>
      <thead><tr><th className="p-2">{t('recovery.field')}</th><th className="p-2">{t('recovery.yours')}</th><th className="p-2">{t('recovery.theirs')}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t border-amber-200"><th className="p-2 font-medium">{row.label}</th><td className="break-words p-2">{row.yours}</td><td className="break-words p-2">{row.theirs}</td></tr>)}</tbody>
    </table>{!rows.length && <p className="text-sm">{t('recovery.noDifferences')}</p>}</div>}
  </section>
}
