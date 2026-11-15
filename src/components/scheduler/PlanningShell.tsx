'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Locale } from '@/lib/internal-tools/contracts'
import { translate } from '@/lib/internal-tools/i18n'
import css from './planning.module.css'

export default function PlanningShell({ enabled, locale, onSchedule, children }: {
  enabled: boolean; locale: Locale; onSchedule: () => void; children: ReactNode
}) {
  const t = (key: string) => translate(locale, key)
  const [navIndex, setNavIndex] = useState(0)
  function go(id: string) {
    onSchedule()
    requestAnimationFrame(() => { const target = document.getElementById(id); target?.scrollIntoView({ block: 'start' }); target?.focus({ preventScroll: true }) })
  }
  return <div className={enabled ? css.app : undefined} data-planning-shell={enabled || undefined} lang={enabled ? locale : undefined}>
    {enabled && <div className={css.brand}><strong>CHINA ROSE</strong><span>{t('planning.identity')}</span><Link href="/internal">{t('planning.internal')}</Link></div>}
    <div className={enabled ? css.shell : undefined}>
      {enabled && <nav className={css.navigation} aria-label={t('planning.navigation')} style={{ '--nav-index': navIndex } as CSSProperties}
        onMouseLeave={() => setNavIndex(0)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setNavIndex(0) }}>
        <span className={css.navHighlight} aria-hidden="true" />
        {[['scheduler-panel-schedule', 'planning.schedule'], ['planning-team', 'planning.team'], ['planning-review', 'planning.review']].map(([id, key], i) =>
          <button key={id} onMouseEnter={() => setNavIndex(i)} onFocus={() => setNavIndex(i)} onClick={() => go(id)}>{t(key)}</button>)}
      </nav>}
      <div className={enabled ? css.content : undefined}>{children}</div>
    </div>
  </div>
}
