'use client'
import { useRef, useState } from 'react'
import type { StoreId } from '@/lib/internal-tools/contracts'
import { fileName, MAX_BYTES, type FileLink } from '@/lib/files'
import { downloadVersion, fileErrorKey, FilesApiError, getFile, listFiles, uploadFile, type FileRecord } from '@/lib/files-api'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import { useManagerSession } from './ManagerSession'
import { useInternalLanguage } from './InternalLanguage'
import { Button } from './ui/controls'

/** Files linked to one tool record: lazy list plus an optional "save the source file" action using a File the tool already holds. */
export default function RelatedFiles({ link, storeId, folder, labels, sources = [], preparer, title }: {
  link: FileLink; storeId: StoreId; folder: string; labels: string[]; sources?: File[]; preparer: string; title: TranslationKey
}) {
  const { t } = useInternalLanguage(), session = useManagerSession()
  const [records, setRecords] = useState<FileRecord[] | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState<TranslationKey | null>(null)
  const saved = useRef(new Map<string, { docId: string; versionId: string; operationId: string }>())
  async function load() {
    if (!session.token || busy) return
    setBusy(true)
    try { setRecords((await listFiles(session.token, { link })).records); setStatus(prior => prior?.startsWith('files.error.') ? null : prior) }
    catch (error) { if (error instanceof FilesApiError && error.code === 'unauthorized') session.expire(); setStatus(fileErrorKey(error)) }
    finally { setBusy(false) }
  }
  async function save(file: File) {
    if (!session.token || busy) return
    if (!fileName(file.name)) return setStatus('files.badType')
    if (file.size > MAX_BYTES) return setStatus('files.tooLarge')
    if (!preparer.trim()) return setStatus('files.nameFirst')
    // The same File keeps its identifiers so a retry after an uncertain response replays instead of duplicating.
    const key = `${file.name}:${file.size}:${file.lastModified}`
    const ids = saved.current.get(key) ?? { docId: `doc_${crypto.randomUUID()}`, versionId: `ver_${crypto.randomUUID()}`, operationId: crypto.randomUUID() }
    saved.current.set(key, ids)
    setBusy(true); setStatus('files.uploading')
    try {
      await uploadFile(session.token, storeId, ids.docId, file, { ...ids, baseRevision: 0, name: file.name, folder, labels, links: [link], addedBy: preparer.trim() })
      setStatus('files.uploaded'); setBusy(false); await load()
    } catch (error) {
      if (error instanceof FilesApiError && error.code === 'unauthorized') session.expire()
      setStatus(fileErrorKey(error)); setBusy(false)
    }
  }
  async function download(record: FileRecord) {
    if (!session.token) return
    try {
      const detail = await getFile(session.token, record.storeId, record.id)
      const current = detail.versions.find(version => version.id === record.data.currentVersionId) ?? detail.versions[0]
      if (current) await downloadVersion(session.token, record.storeId, current)
    } catch (error) { setStatus(fileErrorKey(error)) }
  }
  const unsaved = sources.filter(file => !records?.some(record => record.data.name === file.name))
  return <details className="mt-4" data-related-files={`${link.kind}:${link.key}`} onToggle={event => { if ((event.target as HTMLDetailsElement).open && records === null) void load() }}>
    <summary>{t(title)}</summary>
    <p role="status">{status ? t(status) : ''}</p>
    {records && !records.length && !unsaved.length && <p>{t('files.noneLinked')}</p>}
    <ul>{records?.map(record => <li key={record.id} className="flex flex-wrap items-center gap-3 py-1">
      <span>{record.data.name} · {t('files.entered', { name: record.data.addedBy })}</span>
      <Button disabled={busy} onClick={() => void download(record)}>{t('files.download')}</Button>
    </li>)}</ul>
    {records && unsaved.map(file => <Button key={file.name} className="mt-2" disabled={busy || !session.token} onClick={() => void save(file)}>
      {t('files.saveSource', { name: file.name })}
    </Button>)}
  </details>
}
