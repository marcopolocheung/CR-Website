'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { trackBackNavigation } from '@/lib/back-navigation'
import styles from './back-navigation.module.css'

const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')

export function BackNavigation({ fallbackHref = '/', label = 'Back', inline = false }: {
  fallbackHref?: string; label?: string; inline?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [previousHref, setPreviousHref] = useState<string | null>(null)
  useEffect(() => trackBackNavigation(setPreviousHref), [])
  const href = previousHref ?? base + fallbackHref
  const atFallback = !previousHref && pathname.replace(/\.html$/, '').replace(/\/$/, '') === (base + fallbackHref).replace(/\/$/, '')
  if (atFallback) return null
  return <div className={inline ? styles.inline : styles.bar} data-back-navigation>
    <a href={href} className={styles.link} data-history-back={previousHref ? 'true' : undefined}
      onClick={event => {
        if (!previousHref || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
        event.preventDefault()
        router.back()
      }}>
      <span aria-hidden="true">←</span><span>{label}</span>
    </a>
  </div>
}

/** Internal pages put their translated control inside the shared shell header. */
export default function SiteBackNavigation() {
  const pathname = usePathname().replace(/\.html$/, '').replace(/\/$/, '')
  if (/(?:^|\/)(?:internal|scheduler-demo)(?:\/|$)/.test(pathname)) return null
  const fallbackHref = /\/scheduler-demo\//.test(pathname) ? '/scheduler-demo'
    : pathname.endsWith('/scheduler-demo') || pathname.endsWith('/scheduler-prototype') ? '/internal' : '/'
  return <BackNavigation fallbackHref={fallbackHref} />
}
