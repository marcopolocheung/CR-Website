'use client'

import Link from 'next/link'
import { RESTAURANT_IDS } from '@/data/restaurants'
import { CodeGate } from './CashOut'
import { useManagerSession } from './ManagerSession'
import { useInternalLanguage } from './InternalLanguage'
import { InternalTheme } from './ui/Theme'
import { Paper } from './ui/controls'
import styles from './scheduler-access.module.css'

/** Shared access control stays outside retained station controllers. Locking never unmounts their drafts. */
export function SchedulerAccess() {
  const session = useManagerSession()
  const { t } = useInternalLanguage()
  if (session.token) return null
  return <InternalTheme className={styles.access}>
    <CodeGate id="scheduler-code" onUnlock={session.unlock} title={t('scheduleShell.unlock')} />
  </InternalTheme>
}

export function SchedulerStationPicker() {
  const session = useManagerSession()
  const { t } = useInternalLanguage()
  if (!session.token) return null
  return <InternalTheme className={styles.picker}>
    <h1>{t('scheduleShell.pickStation')}</h1>
    <p>{t('scheduleShell.stationHelp')}</p>
    <ul className={styles.stations}>
      {RESTAURANT_IDS.map(id => <li key={id}><Paper>
        <Link href={`/scheduler-demo/${id}`} className={styles.station}>{t(`scheduleShell.${id}`)}</Link>
      </Paper></li>)}
    </ul>
    <Link href="/schedule" target="_blank" rel="noopener noreferrer" className={styles.staffView}>
      {t('scheduleShell.staffView')}<span className="sr-only"> ({t('scheduleShell.newTab')})</span>
    </Link>
  </InternalTheme>
}
