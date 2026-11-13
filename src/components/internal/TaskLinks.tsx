'use client'
import { useInternalLanguage } from './InternalLanguage'
import { Icon, type IconName } from './ui/Icon'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import styles from './task-links.module.css'
const home: { href: string; label: TranslationKey; icon: IconName }[] = [
  { href: '/internal/bookkeeping#cash-out', label: 'home.cash', icon: 'cash' },
  { href: '/internal/inventory', label: 'shell.inventory', icon: 'inventory' },
  { href: '/scheduler-demo', label: 'shell.schedule', icon: 'calendar' },
  { href: '/internal/reports', label: 'shell.reports', icon: 'report' },
  { href: '/internal/forms', label: 'shell.forms', icon: 'form' },
]
const reports: typeof home = [
  { href: '/internal/bookkeeping#sales', label: 'bookkeeping.sales', icon: 'report' },
  { href: '/internal/bookkeeping#hours', label: 'bookkeeping.hours', icon: 'clock' },
  { href: '/internal/bookkeeping#comparison', label: 'comparison.title', icon: 'calendar' },
]
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')
export default function TaskLinks({ kind }: { kind: 'home' | 'reports' }) {
  const { t } = useInternalLanguage()
  return <nav className={styles.links} aria-label={t(kind === 'home' ? 'home.tasks' : 'reports.tools')}>
    {(kind === 'home' ? home : reports).map(item => <a key={item.href} href={base + item.href} className={styles.link}>
      <Icon name={item.icon} size={28} /><span>{t(item.label)}</span>
    </a>)}
  </nav>
}
