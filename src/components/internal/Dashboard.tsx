'use client'
import { useShellTask } from './ShellTask'
import { useInternalLanguage } from './InternalLanguage'
import TaskLinks from './TaskLinks'
import { internalThemeClassName } from './ui/Theme'
import styles from './task-links.module.css'
export default function Dashboard() {
  const { t } = useInternalLanguage()
  useShellTask('dashboard', { context: t('home.context') })
  return <div className={`${internalThemeClassName} ${styles.workspace}`}>
    <h1 className={styles.title}>{t('home.title')}</h1>
    <TaskLinks kind="home" />
  </div>
}
