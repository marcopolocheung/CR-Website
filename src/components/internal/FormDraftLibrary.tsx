'use client'

import { useEffect, useState } from 'react'
import { useInternalLanguage } from './InternalLanguage'
import { Button, Paper } from './ui/controls'
import { downloadDraftSource } from './DraftChooser'
import { SAVED_FORM_TYPES } from '@/lib/forms'
import { EMPTY_FORM_DRAFT_FILTER, filterFormDrafts, formDraftPerson, isSavedFormType, listFormDrafts, type FormDraftFilter, type FormDraftList, type ReadyFormDraftSource } from '@/lib/internal-tools/form-drafts'
import styles from './form-draft-library.module.css'

export default function FormDraftLibrary({ onResume, busy, refreshKey }: {
  onResume: (source: ReadyFormDraftSource) => void
  busy: boolean
  refreshKey?: unknown
}) {
  const { t } = useInternalLanguage()
  const [list, setList] = useState<FormDraftList | null>(null)
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<FormDraftFilter>(EMPTY_FORM_DRAFT_FILTER)
  const change = (patch: Partial<FormDraftFilter>) => setFilter(current => ({ ...current, ...patch }))
  useEffect(() => {
    const read = () => {
      try { setList(listFormDrafts(localStorage)) }
      catch { setList({ state: 'unavailable', sources: [] }) }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [revision, refreshKey])
  const ready = list?.sources.filter((source): source is ReadyFormDraftSource => source.state === 'ready') ?? []
  const unfinished = ready.filter(source => !source.draft.payload.savedId)
  const shown = filterFormDrafts(unfinished, filter)
  const saved = filterFormDrafts(ready.filter(source => !!source.draft.payload.savedId), filter)
  const unreadable = list?.sources.filter(source => source.state === 'unreadable') ?? []
  const filtered = Object.values(filter).some(Boolean)
  const render = (sources: ReadyFormDraftSource[]) => <ul className={styles.rows}>{sources.map(source => {
    const person = formDraftPerson(source)
    return <li key={source.key} data-form-draft-key={source.key} data-form-draft-id={source.draft.id}>
      <h3>{t(`forms.type.${source.formType}`)} · {source.draft.context.storeId} · {source.draft.context.businessDate}</h3>
      <p>{person ? t('formsDrafts.person', { person }) : t('formsDrafts.noPerson')}</p>
      <p>{t('formsDrafts.preparer', { preparer: source.draft.preparer })}</p>
      <p>{t('formsDrafts.updated', { time: source.draft.updatedAt })}</p>
      {source.upgraded && <p>{t('formsDrafts.upgraded')}</p>}
      {source.draft.payload.savedId && <p>{t('formsDrafts.savedCopy', { id: source.draft.payload.savedId })}</p>}
      <div className={styles.actions}>
        <Button disabled={busy} onClick={() => onResume(source)}>{t('formsDrafts.resume')}</Button>
        <Button onClick={() => downloadDraftSource(source.raw)}>{t('formsDrafts.download')}</Button>
      </div>
    </li>
  })}</ul>
  return <section aria-labelledby="form-draft-library-title" className={styles.library} data-form-draft-library>
    <h2 id="form-draft-library-title">{t('formsDrafts.title')}</h2>
    <p>{t('formsDrafts.deviceOnly')}</p>
    <div className={styles.filters}>
      <div><label htmlFor="form-library-search">{t('formsDrafts.search')}</label><input id="form-library-search" type="search" value={filter.query} onChange={event => change({ query: event.target.value })}/></div>
      <div><label htmlFor="form-library-type">{t('formsDrafts.type')}</label><select id="form-library-type" value={filter.type} onChange={event => change({ type: event.target.value as FormDraftFilter['type'] })}><option value="">{t('formsDrafts.allTypes')}</option>{SAVED_FORM_TYPES.map(type => <option key={type} value={type}>{t(`forms.type.${type}`)}</option>)}</select></div>
      <div><label htmlFor="form-library-store">{t('formsDrafts.store')}</label><select id="form-library-store" value={filter.store} onChange={event => change({ store: event.target.value })}><option value="">{t('formsDrafts.allStores')}</option><option>CR2</option><option>CR3</option></select></div>
      <div><label htmlFor="form-library-from">{t('formsDrafts.from')}</label><input id="form-library-from" type="date" value={filter.from} max={filter.to || undefined} onChange={event => change({ from: event.target.value })}/></div>
      <div><label htmlFor="form-library-to">{t('formsDrafts.to')}</label><input id="form-library-to" type="date" value={filter.to} min={filter.from || undefined} onChange={event => change({ to: event.target.value })}/></div>
    </div>
    <div className={styles.actions}>
      <Button onClick={() => setRevision(value => value + 1)}>{t('formsDrafts.refresh')}</Button>
      {filtered && <Button onClick={() => { setFilter(EMPTY_FORM_DRAFT_FILTER); document.getElementById('form-library-search')?.focus() }}>{t('formsDrafts.clear')}</Button>}
    </div>
    {list?.state === 'unavailable' && <p role="alert" className={styles.failure}>{t('formsDrafts.unavailable')}</p>}
    {!list && <p role="status">{t('common.loading')}</p>}
    {list && <>
      <p role="status" className={styles.count}>{t('formsDrafts.count', { shown: shown.length, total: unfinished.length })}</p>
      {shown.length > 0 && <Paper emphasis="active">{render(shown)}</Paper>}
      {list.state === 'available' && !unfinished.length && <p>{t('formsDrafts.empty')}</p>}
      {list.state === 'available' && unfinished.length > 0 && !shown.length && <p>{t('formsDrafts.noMatches')}</p>}
      {saved.length > 0 && <details data-form-saved-drafts><summary>{t('formsDrafts.savedCopies', { count: saved.length })}</summary>{render(saved)}</details>}
      {unreadable.length > 0 && <details data-form-draft-recovery><summary>{t('formsDrafts.recovery', { count: unreadable.length })}</summary><ul className={styles.rows}>{unreadable.map(source => <li key={source.key}>
        <h3>{isSavedFormType(source.formType) ? t(`forms.type.${source.formType}`) : t('formsDrafts.unknownType')}{source.context && ` · ${source.context.storeId} · ${source.context.businessDate ?? ''}`}</h3>
        <p>{t('formsDrafts.unreadable')}</p><code>{source.key}</code>
        <div className={styles.actions}><Button onClick={() => downloadDraftSource(source.raw)}>{t('formsDrafts.download')}</Button></div>
      </li>)}</ul></details>}
    </>}
  </section>
}
