'use client'
import CashReports from './CashReports'
import TaskLinks from './TaskLinks'
import { useInternalLanguage } from './InternalLanguage'
import { internalThemeClassName } from './ui/Theme'
import styles from './task-links.module.css'
export default function ReportsWorkspace() {
  const { t } = useInternalLanguage()
  return <div className={`${internalThemeClassName} ${styles.workspace}`}>
    <h1 className={styles.title}>{t('shell.reports')}</h1>
    <TaskLinks kind="reports" />
    <CashReports />
  </div>
}
