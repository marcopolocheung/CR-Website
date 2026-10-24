'use client'

import { useEffect, useRef } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import type { SourceIssue } from '@/lib/converter/validation'
import type { TranslationKey } from '@/lib/internal-tools/i18n'

export type FileValidation = { checking: boolean; issues: SourceIssue[]; valid: boolean }
export const UNCHECKED: FileValidation = { checking: false, issues: [], valid: false }

export default function SourceFileInput({ id, label, accept, file, validation, disabled, onFile, beforeReplace }: {
  id: string; label: TranslationKey; accept: string; file: File | null; validation: FileValidation; disabled?: boolean; onFile: (file: File) => void; beforeReplace?: () => Promise<boolean>
}) {
  const { t } = useInternalLanguage()
  const input = useRef<HTMLInputElement>(null)
  const choice = useRef(0)
  const restore = () => {
    if (!input.current) return
    try { const transfer = new DataTransfer(); if (file) transfer.items.add(file); input.current.files = transfer.files }
    catch { input.current.value = '' } // The selected File in component state still survives.
  }
  useEffect(() => {
    const element = input.current
    element?.addEventListener('cancel', restore)
    return () => element?.removeEventListener('cancel', restore)
  }, [file])
  return <div className="min-w-0 rounded-lg border border-gray-200 p-3">
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-gray-800">{t(label)}</label>
    <input ref={input} id={id} type="file" accept={accept} disabled={disabled}
      data-has-file={file ? 'true' : 'false'} aria-invalid={validation.issues.length ? true : undefined} aria-describedby={`${id}-feedback`}
      onChange={async event => {
        const selected = event.target.files?.[0]
        if (!selected) return
        const version = ++choice.current
        const allowed = !beforeReplace || await beforeReplace()
        if (version !== choice.current) return
        if (allowed) onFile(selected)
        else restore()
      }}
      className="block min-h-11 w-full text-sm text-gray-700 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-3 file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-red-700" />
    {file && <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="min-w-0 break-all text-sm text-gray-700">{file.name}</p>
      <button type="button" disabled={disabled} onClick={() => { if (input.current) { input.current.value = ''; input.current.click() } }}
        aria-label={t('importValidation.replaceSlot', { slot: t(label) })}
        className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-red-700">{t('importValidation.replace')}</button>
    </div>}
    <div id={`${id}-feedback`} className="mt-2 text-sm">
      <p role="status">{validation.checking ? t('importValidation.checking') : validation.valid ? t('importValidation.valid') : !file ? t('importValidation.choose') : null}</p>
      {!!validation.issues.length && <div role="alert" className="max-h-64 overflow-auto break-words text-red-800">
        <p className="font-semibold">{t('importValidation.fixFile')}</p>
        <ul className="mt-1 list-inside list-disc space-y-2">{validation.issues.map((issue, index) => <li key={index}>{t(issue.key, issue.params)}</li>)}</ul>
      </div>}
    </div>
  </div>
}
