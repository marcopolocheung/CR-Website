'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { StoreId } from '@/lib/internal-tools/contracts'
import { ACCEPT, fileName, folderPath, labelsList, MAX_BYTES, type FileLink } from '@/lib/files'
import { changeFile, downloadVersion, fileErrorKey, FilesApiError, getFile, listFiles, uploadFile, type FileActivity, type FileRecord, type FileVersion, type FilesPage } from '@/lib/files-api'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import { useManagerSession } from './ManagerSession'
import { useInternalLanguage } from './InternalLanguage'
import { useShellTask } from './ShellTask'
import { useNavigationProtection } from './NavigationProtection'
import { useWorkspaceVisible } from './WorkspaceVisibility'
import { CodeGate } from './CashOut'
import { InternalTheme } from './ui/Theme'
import { Button, Paper } from './ui/controls'
import styles from './files-workspace.module.css'

type Filters = { store: StoreId | ''; folder: string | null; label: string; q: string; trash: boolean }
type Detail = { record: FileRecord; versions: FileVersion[]; activity: FileActivity[] }
type Retry = { operationId: string; versionId: string; docId: string; base: number; file: File; store: StoreId; folder: string; labels: string[]; links: FileLink[] }
const NAME_KEY = 'cr-files-name', STORE_KEY = 'cr-files-store'
const read = (key: string) => { try { return localStorage.getItem(key) ?? '' } catch { return '' } }
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* optional convenience */ } }
const uuid = () => crypto.randomUUID()
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function FilesWorkspace() {
  const { t } = useInternalLanguage(), session = useManagerSession(), visible = useWorkspaceVisible()
  const [filters, setFilters] = useState<Filters>({ store: '', folder: null, label: '', q: '', trash: false })
  const [page, setPage] = useState<FilesPage | null>(null), [pending, setPending] = useState(false)
  const [status, setStatus] = useState<TranslationKey | null>(null), [unconfigured, setUnconfigured] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null), [busy, setBusy] = useState(false), [undo, setUndo] = useState<FileRecord | null>(null)
  const [uploading, setUploading] = useState(false), [conflict, setConflict] = useState<Retry | null>(null)
  const [form, setForm] = useState({ open: false, file: null as File | null, store: '' as StoreId | '', folder: '', labels: '', name: '' })
  const [edit, setEdit] = useState<{ name: string; folder: string; labels: string } | null>(null)
  const sequence = useRef(0), retry = useRef<Retry | null>(null), live = useRef(session); live.current = session
  const token = session.token
  useShellTask('files', { context: token ? (filters.store || t('files.bothStores')) : null })
  useNavigationProtection({ scope: 'files', dirty: false, deviceSaved: false, busy: uploading || busy })
  useEffect(() => { setForm(current => ({ ...current, store: (read(STORE_KEY) as StoreId) || '', name: read(NAME_KEY) })) }, [])
  // A new access generation hides everything previously loaded.
  useEffect(() => { sequence.current++; setPage(null); setDetail(null); setStatus(null); setUnconfigured(false); setConflict(null); setUndo(null); retry.current = null }, [session.generation])

  function failed(error: unknown) {
    if (error instanceof FilesApiError && error.code === 'unauthorized') session.expire()
    if (error instanceof FilesApiError && error.code === 'backend_unconfigured') setUnconfigured(true)
    setStatus(fileErrorKey(error))
  }
  async function load(next: Filters = filters, more = false) {
    if (!token) return
    const at = ++sequence.current, generation = session.generation
    setPending(true)
    try {
      const result = await listFiles(token, { ...next, cursor: more ? page?.nextCursor ?? '' : '' })
      if (at !== sequence.current || generation !== live.current.generation) return
      setUnconfigured(false)
      setPage(old => more && old ? { ...result, records: [...old.records, ...result.records.filter(r => !old.records.some(o => o.id === r.id))] } : result)
      // Action results (saved, trashed…) stay; only a stale load error is cleared. The empty state renders separately.
      setStatus(prior => prior?.startsWith('files.error.') ? null : prior)
    } catch (error) { if (at === sequence.current) failed(error) }
    finally { if (at === sequence.current) setPending(false) }
  }
  useEffect(() => { if (visible && token && !page && !unconfigured) void load() }, [visible, token])  // eslint-disable-line react-hooks/exhaustive-deps
  function filter(patch: Partial<Filters>) { const next = { ...filters, ...patch }; setFilters(next); void load(next) }

  async function open(record: FileRecord) {
    if (!token) return
    setBusy(true); setEdit(null)
    try { setDetail(await getFile(token, record.storeId, record.id)) } catch (error) { failed(error) } finally { setBusy(false) }
  }
  async function refresh(record: FileRecord) {
    await load()
    if (token) setDetail(await getFile(token, record.storeId, record.id).catch(() => null))
  }

  async function send(attempt: Retry, name: string) {
    if (!token) return
    setUploading(true); setStatus('files.uploading'); retry.current = attempt
    try {
      const saved = await uploadFile(token, attempt.store, attempt.docId, attempt.file, { operationId: attempt.operationId, baseRevision: attempt.base,
        versionId: attempt.versionId, name: attempt.file.name, folder: attempt.folder, labels: attempt.labels, links: attempt.links, addedBy: name })
      retry.current = null; setConflict(null); setStatus(attempt.base ? 'files.replaced' : 'files.uploaded')
      setForm(current => ({ ...current, open: false, file: null, folder: '', labels: '' }))
      await refresh(saved)
    } catch (error) {
      if (error instanceof FilesApiError && error.code === 'conflict') { retry.current = null; setConflict({ ...attempt, base: error.currentRevision ?? attempt.base }); setStatus('files.conflict') }
      else failed(error)  // keep retry.current so "Retry" resends the same operation
    } finally { setUploading(false) }
  }
  function submitUpload(event: FormEvent) {
    event.preventDefault()
    const name = form.name.trim(), folder = folderPath(form.folder), labels = labelsList(form.labels.split(','))
    if (!form.file || !fileName(form.file.name)) return setStatus('files.badType')
    if (form.file.size > MAX_BYTES) return setStatus('files.tooLarge')
    if (!form.store || !name || folder === null || !labels) return setStatus('files.incomplete')
    remember(NAME_KEY, name); remember(STORE_KEY, form.store)
    void send({ operationId: uuid(), versionId: `ver_${uuid()}`, docId: `doc_${uuid()}`, base: 0, file: form.file, store: form.store, folder, labels, links: [] }, name)
  }
  function replace(file: File | undefined) {
    if (!detail || !file) return
    const name = form.name.trim() || read(NAME_KEY)
    if (!fileName(file.name)) return setStatus('files.badType')
    if (file.size > MAX_BYTES) return setStatus('files.tooLarge')
    if (!name) return setStatus('files.nameFirst')
    const { record } = detail
    void send({ operationId: uuid(), versionId: `ver_${uuid()}`, docId: record.id, base: record.revision, file, store: record.storeId, folder: record.data.folder, labels: record.data.labels, links: record.data.links }, name)
  }
  async function mutate(record: FileRecord, change: { action: 'update'; name: string; folder: string; labels: string[] } | { action: 'trash' } | { action: 'restore' }) {
    const name = form.name.trim() || read(NAME_KEY)
    if (!token) return
    if (!name) return setStatus('files.nameFirst')
    setBusy(true)
    try {
      const saved = await changeFile(token, record.storeId, record.id, { ...change, operationId: uuid(), baseRevision: record.revision, addedBy: name })
      setUndo(change.action === 'trash' ? saved : null); setEdit(null)
      setStatus(change.action === 'trash' ? 'files.trashed' : change.action === 'restore' ? 'files.restored' : 'files.changed')
      if (change.action === 'trash') setDetail(null); else await refresh(saved)
      if (change.action === 'trash') await load()
    } catch (error) { failed(error) } finally { setBusy(false) }
  }
  async function download(store: StoreId, version: FileVersion) {
    if (!token) return
    try { await downloadVersion(token, store, version) } catch (error) { failed(error) }
  }

  const records = page?.records ?? []
  return <InternalTheme><Paper emphasis="active" className={styles.workspace} aria-labelledby="files-title">
    <h1 id="files-title">{t('files.title')}</h1>
    {!token && <CodeGate id="files-code" title={t('files.title')} onUnlock={session.unlock} />}
    <div hidden={!token}>
      <p role="status" className={styles.status}>{status ? t(status) : ''}
        {undo && <Button className={styles.inline} disabled={busy} onClick={() => void mutate(undo, { action: 'restore' })}>{t('files.undo')}</Button>}
        {retry.current && !uploading && <Button className={styles.inline} onClick={() => void send(retry.current!, form.name.trim() || read(NAME_KEY))}>{t('files.retry')}</Button>}
      </p>
      {unconfigured ? <p className={styles.notice}>{t('files.unconfigured')}</p> : <>
        <div className={styles.toolbar}>
          <Button variant="primary" icon="plus" disabled={uploading} onClick={() => setForm(current => ({ ...current, open: !current.open }))} aria-expanded={form.open} aria-controls="files-upload">{t('files.upload')}</Button>
          <fieldset className={styles.filters} disabled={pending}>
            <legend className={styles.srOnly}>{t('files.filters')}</legend>
            <div><label htmlFor="files-search">{t('files.search')}</label><input id="files-search" type="search" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void load() }} onBlur={() => void load()} /></div>
            <div><label htmlFor="files-store">{t('files.store')}</label><select id="files-store" value={filters.store} onChange={e => filter({ store: e.target.value as StoreId | '' })}><option value="">{t('files.bothStores')}</option><option value="CR3">CR3</option><option value="CR2">CR2</option></select></div>
            <div><label htmlFor="files-label">{t('files.label')}</label><select id="files-label" value={filters.label} onChange={e => filter({ label: e.target.value })}><option value="">{t('files.anyLabel')}</option>{(page?.labels ?? []).map(label => <option key={label} value={label}>{label}</option>)}</select></div>
            <label className={styles.check}><input type="checkbox" checked={filters.trash} onChange={e => filter({ trash: e.target.checked })} /> {t('files.showTrash')}</label>
          </fieldset>
        </div>

        {form.open && <form id="files-upload" className={styles.upload} onSubmit={submitUpload}>
          <h2>{t('files.uploadTitle')}</h2>
          <p className={styles.hint}>{t('files.allowed', { size: '25 MB' })}</p>
          <div><label htmlFor="files-file">{t('files.file')}</label><input id="files-file" type="file" accept={ACCEPT} onChange={e => setForm({ ...form, file: e.target.files?.[0] ?? null })} /></div>
          <div><label htmlFor="files-upload-store">{t('files.store')}</label><select id="files-upload-store" required value={form.store} onChange={e => setForm({ ...form, store: e.target.value as StoreId | '' })}><option value="">{t('files.chooseStore')}</option><option value="CR3">CR3</option><option value="CR2">CR2</option></select></div>
          <div><label htmlFor="files-folder">{t('files.folder')}</label><input id="files-folder" list="files-folders" value={form.folder} placeholder={t('files.folderHint')} onChange={e => setForm({ ...form, folder: e.target.value })} />
            <datalist id="files-folders">{(page?.folders ?? []).filter(Boolean).map(folder => <option key={folder} value={folder} />)}</datalist></div>
          <div><label htmlFor="files-labels">{t('files.labels')}</label><input id="files-labels" value={form.labels} placeholder={t('files.labelsHint')} onChange={e => setForm({ ...form, labels: e.target.value })} /></div>
          <div><label htmlFor="files-name">{t('files.yourName')}</label><input id="files-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" /></div>
          <Button type="submit" variant="primary" busy={uploading} disabled={uploading}>{uploading ? t('files.uploading') : t('files.uploadSubmit')}</Button>
        </form>}

        {conflict && <div role="alert" className={styles.conflict}>
          <p><strong>{t('files.conflictTitle')}</strong> {t('files.conflictBody')}</p>
          <div className={styles.actions}>
            <Button onClick={() => { const latest = detail?.versions[0]; if (latest) void download(conflict.store, latest) }} disabled={!detail?.versions.length}>{t('files.downloadLatest')}</Button>
            <Button variant="primary" onClick={() => void send({ ...conflict, operationId: uuid(), versionId: `ver_${uuid()}` }, form.name.trim() || read(NAME_KEY))}>{t('files.uploadAnyway')}</Button>
            <Button onClick={() => { setConflict(null); setStatus(null) }}>{t('files.cancel')}</Button>
          </div>
        </div>}

        <div className={styles.layout}>
          <nav aria-label={t('files.folders')} className={styles.folders}>
            <ul>
              <li><button type="button" aria-current={filters.folder === null ? 'true' : undefined} onClick={() => filter({ folder: null })}>{t('files.allFolders')}</button></li>
              {(page?.folders ?? []).map(folder => <li key={folder}><button type="button" aria-current={filters.folder === folder ? 'true' : undefined} onClick={() => filter({ folder })}>{folder || t('files.topLevel')}</button></li>)}
            </ul>
          </nav>
          <div className={styles.list}>
            <table aria-busy={pending}>
              <caption className={styles.srOnly}>{t(filters.trash ? 'files.trashCaption' : 'files.caption')}</caption>
              <thead><tr><th scope="col">{t('files.name')}</th><th scope="col">{t('files.labels')}</th><th scope="col">{t('files.store')}</th><th scope="col">{t('files.updated')}</th><th scope="col">{t('files.addedBy')}</th></tr></thead>
              <tbody>{records.map(record => <tr key={`${record.storeId}:${record.id}`} aria-selected={detail?.record.id === record.id}>
                <td><button type="button" className={styles.open} onClick={() => void open(record)}>{record.data.name}</button><span className={styles.folder}>{record.data.folder}</span></td>
                <td>{record.data.labels.join(', ')}</td><td>{record.storeId}</td><td>{new Date(record.updatedAt).toLocaleString()}</td>
                <td>{t('files.entered', { name: record.data.addedBy })}</td>
              </tr>)}</tbody>
            </table>
            {page && !records.length && <p className={styles.empty} data-files-empty>{t('files.empty')}</p>}
            {page?.nextCursor && <Button disabled={pending} onClick={() => void load(filters, true)}>{t('files.more')}</Button>}
          </div>
        </div>

        {detail && <section className={styles.detail} aria-labelledby="files-detail-title">
          <div className={styles.detailHead}><h2 id="files-detail-title">{detail.record.data.name}</h2><Button onClick={() => setDetail(null)}>{t('files.close')}</Button></div>
          <p>{detail.record.storeId} · {detail.record.data.folder || t('files.topLevel')} · {detail.record.data.labels.join(', ') || t('files.noLabels')}{detail.record.data.trashedAt ? ` · ${t('files.inTrash')}` : ''}</p>
          <div className={styles.actions}>
            {detail.versions[0] && <Button variant="primary" onClick={() => void download(detail.record.storeId, detail.versions[0])}>{t('files.download')}</Button>}
            <label className={styles.replace}>{t('files.replace')}<input type="file" accept={ACCEPT} disabled={uploading || busy} onChange={e => { replace(e.target.files?.[0]); e.target.value = '' }} /></label>
            <Button disabled={busy} onClick={() => setEdit({ name: detail.record.data.name, folder: detail.record.data.folder, labels: detail.record.data.labels.join(', ') })}>{t('files.edit')}</Button>
            {detail.record.data.trashedAt
              ? <Button disabled={busy} onClick={() => void mutate(detail.record, { action: 'restore' })}>{t('files.restore')}</Button>
              : <Button disabled={busy} onClick={() => void mutate(detail.record, { action: 'trash' })}>{t('files.trash')}</Button>}
          </div>
          {!form.name.trim() && !read(NAME_KEY) && <div><label htmlFor="files-detail-name">{t('files.yourName')}</label><input id="files-detail-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>}
          {edit && <form className={styles.upload} onSubmit={event => {
            event.preventDefault()
            const name = fileName(edit.name), folder = folderPath(edit.folder), labels = labelsList(edit.labels.split(','))
            if (!name || folder === null || !labels) return setStatus('files.incomplete')
            void mutate(detail.record, { action: 'update', name, folder, labels })
          }}>
            <div><label htmlFor="files-edit-name">{t('files.name')}</label><input id="files-edit-name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label htmlFor="files-edit-folder">{t('files.folder')}</label><input id="files-edit-folder" value={edit.folder} onChange={e => setEdit({ ...edit, folder: e.target.value })} /></div>
            <div><label htmlFor="files-edit-labels">{t('files.labels')}</label><input id="files-edit-labels" value={edit.labels} onChange={e => setEdit({ ...edit, labels: e.target.value })} /></div>
            <div className={styles.actions}><Button type="submit" variant="primary" disabled={busy}>{t('files.save')}</Button><Button onClick={() => setEdit(null)}>{t('files.cancel')}</Button></div>
          </form>}
          <h3>{t('files.versions')}</h3>
          <ul className={styles.versions}>{detail.versions.map((version, index) => <li key={version.id}>
            <span>{version.filename} · {size(version.size)} · {new Date(version.createdAt).toLocaleString()} · {t('files.entered', { name: version.addedBy })}{index === 0 ? ` · ${t('files.current')}` : ''}</span>
            <Button onClick={() => void download(detail.record.storeId, version)}>{t('files.downloadVersion')}</Button>
          </li>)}</ul>
          <h3>{t('files.activity')}</h3>
          <ul className={styles.activity}>{detail.activity.map(entry => <li key={entry.revision}>
            {t(`files.action.${entry.action}` as TranslationKey)} · {t('files.entered', { name: entry.actor })} · {new Date(entry.at).toLocaleString()}
          </li>)}</ul>
        </section>}
      </>}
    </div>
  </Paper></InternalTheme>
}
