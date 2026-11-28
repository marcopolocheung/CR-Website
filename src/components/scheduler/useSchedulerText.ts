'use client'

import { useInternalLanguage } from '@/components/internal/InternalLanguage'
import { schedulerScreenKeys } from '@/lib/internal-tools/i18n/scheduler-screen'

/** Translate fixed screen copy only; names, saved labels and API narratives stay verbatim. */
export function useSchedulerText() {
  const { t } = useInternalLanguage()
  return (text: string, params: Record<string,string|number> = {}) => {
    const key = schedulerScreenKeys[text as keyof typeof schedulerScreenKeys]
    return key ? t(key,params) : text
  }
}
