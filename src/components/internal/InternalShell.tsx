'use client'

import Link from 'next/link'
import { useManagerSession } from './ManagerSession'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { LanguageControls, useInternalLanguage } from './InternalLanguage'
import { useShellTasks } from './ShellTask'
import { MovingNavigation } from './ui/MovingNavigation'
import { Button } from './ui/controls'
import type { IconName } from './ui/Icon'
import type { TranslationKey } from '@/lib/internal-tools/i18n'
import styles from './shell.module.css'

const destinations = [
  { id: 'dashboard', icon: 'home', href: '/internal' },
  { id: 'cash', icon: 'cash', href: '/internal/bookkeeping#cash-out' },
  { id: 'inventory', icon: 'inventory', href: '/internal/inventory' },
  { id: 'schedule', icon: 'calendar', href: '/scheduler-demo' },
  { id: 'reports', icon: 'report', href: '/internal/bookkeeping#sales' },
  { id: 'forms', icon: 'form', href: '/internal/forms' },
] as const
const reportTabs = ['sales', 'hours', 'comparison']
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')

export default function InternalShell({ children, themeClassName }: { children: ReactNode; themeClassName: string }) {
  const pathname = usePathname().replace(/\/$/, '').replace(/\.html$/, '')
  const [hash, setHash] = useState('')
  const [localPath, setLocalPath] = useState('')
  useEffect(() => {
    const update = () => {
      const next = window.location.hash.slice(1)
      if (!next || next === 'cash-out' || reportTabs.includes(next)) setHash(next)
      setLocalPath(window.location.pathname)
    }
    update(); window.addEventListener('hashchange', update); window.addEventListener('popstate', update)
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update) }
  }, [pathname])
  const section = pathname.endsWith('/bookkeeping') ? (reportTabs.includes(hash) ? 'reports' : 'cash')
    : pathname.endsWith('/inventory') ? 'inventory' : pathname.endsWith('/forms') ? 'forms'
    : pathname.endsWith('/qr-generator') ? 'qr' : pathname.endsWith('/ui-gallery') ? 'gallery' : 'dashboard'
  const taskId = section === 'reports' ? hash : section
  const session = useManagerSession()
  const tasks = useShellTasks()
  const metadata = tasks[taskId]
  const access = (section === 'cash' ? metadata : undefined) ?? tasks[section === 'reports' ? 'bookkeeping' : section]
  const detailed = (section === 'forms' && access?.onLock ? (tasks['forms-context'] ?? tasks['forms-record']) : undefined)
    ?? (section === 'dashboard' && access?.onLock ? tasks['dashboard-context'] : undefined)
  const { t } = useInternalLanguage()
  const context = detailed?.context ?? metadata?.context
  const title = t(`shell.${section}` as TranslationKey)
  const items = useMemo(() => destinations.map(item => ({ ...item, icon: item.icon as IconName,
    href: /\/bookkeeping(?:\.html)?\/?$/.test(localPath) && (item.id === 'cash' || item.id === 'reports')
      ? `${localPath}#${item.id === 'cash' ? 'cash-out' : 'sales'}` : base + item.href,
    label: t(`shell.${item.id}` as TranslationKey) })), [t, localPath])
  const root = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = header.current
    if (!element) return
    const measure = () => root.current?.style.setProperty('--internal-banner-height',
      `${getComputedStyle(element).position === 'sticky' ? element.offsetHeight : 0}px`)
    measure(); const observer = new ResizeObserver(measure); observer.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const [help, setHelp] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!help || !dialog.current) return
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal(); element.querySelector('button')?.focus()
    return () => { element.close(); trigger?.isConnected && trigger.focus() }
  }, [help])
  return <div ref={root} className={styles.shell} data-internal-shell data-shell-ready={localPath ? 'true' : undefined}>
    <a className={styles.skip} href="#internal-workspace" onClick={event => {
      event.preventDefault(); document.getElementById('internal-workspace')?.focus()
    }}>{t('shell.skip')}</a>
    <header ref={header} className={`${themeClassName} ${styles.header}`} data-internal-banner data-shell-chrome>
      <Link className={styles.brand} href={`${base}/internal`}>CHINA ROSE <span>/ {t('shell.identity')}</span></Link>
      <div className={styles.controls}>
        <LanguageControls appearance="shell" />
        <Button onClick={() => setHelp(true)} aria-haspopup="dialog">{t('shell.help')}</Button>
        <Button icon="lock" data-shell-lock disabled={!session.token} onClick={session.lock}
          title={!session.token ? t('shell.noAccess') : undefined}>{t('session.lock')}</Button>
      </div>
      <div className={styles.context} data-shell-context><strong>{title}</strong><span>{context || t(`shell.context.${section}` as TranslationKey)}</span></div>
    </header>
    <div className={styles.layout}>
      <aside className={`${themeClassName} ${styles.rail}`} data-shell-chrome>
        <MovingNavigation items={items} selectedId={section} label={t('shell.navigation')} />
      </aside>
      <div id="internal-workspace" tabIndex={-1} className={styles.content}>{children}</div>
    </div>
    <div className={themeClassName}>
      <dialog ref={dialog} className={styles.help} aria-labelledby="internal-help-title"
        onCancel={event => { event.preventDefault(); setHelp(false) }}>
        <h2 id="internal-help-title">{t('shell.help')} · {title}</h2>
        <p>{t(`shell.help.${section}` as TranslationKey)}</p>
        <p>{t('entry.help')}</p>
        <Button onClick={() => setHelp(false)}>{t('shell.closeHelp')}</Button>
      </dialog>
    </div>
  </div>
}
