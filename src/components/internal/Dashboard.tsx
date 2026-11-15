'use client'
import { useEffect, useState } from 'react'
import { useShellTask } from './ShellTask'
import { useInternalLanguage } from './InternalLanguage'
import { useManagerSession } from './ManagerSession'
import { CodeGate } from './CashOut'
import TaskLinks from './TaskLinks'
import { internalThemeClassName } from './ui/Theme'
import styles from './task-links.module.css'

/** Set by the public site's "Internal (staff)" link: open Home on the manager code screen. */
const MANAGER_ENTRY_PARAM = 'access'
const MANAGER_ENTRY_VALUE = 'manager'

function dropEntryParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete(MANAGER_ENTRY_PARAM)
  window.history.replaceState(window.history.state, '', url)
}

export default function Dashboard() {
  const { t } = useInternalLanguage()
  const session = useManagerSession()
  useShellTask('dashboard', { context: t('home.context') })
  // Read after mount: the page is a static export, so the query string is only known in the browser.
  const [entry, setEntry] = useState(false)
  useEffect(() => { setEntry(new URLSearchParams(window.location.search).get(MANAGER_ENTRY_PARAM) === MANAGER_ENTRY_VALUE) }, [])
  // Once unlocked (here or elsewhere), clean the address so a refresh or shared link doesn't ask again.
  useEffect(() => { if (entry && session.token) { dropEntryParam(); setEntry(false) } }, [entry, session.token])

  if (entry && !session.token) {
    return <div className={`${internalThemeClassName} ${styles.workspace}`}>
      <CodeGate onUnlock={session.unlock} title={t('home.entryTitle')} />
      <button type="button" data-entry-skip className="min-h-11 px-1 text-sm underline" onClick={() => { dropEntryParam(); setEntry(false) }}>{t('home.entrySkip')}</button>
    </div>
  }
  return <div className={`${internalThemeClassName} ${styles.workspace}`}>
    <h1 className={styles.title}>{t('home.title')}</h1>
    <TaskLinks kind="home" />
  </div>
}
