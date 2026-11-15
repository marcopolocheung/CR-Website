import type { Locale } from '@/lib/internal-tools/contracts'

export function planningDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function planningWeek(start: string, end: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).formatRange(new Date(`${start}T12:00:00Z`), new Date(`${end}T12:00:00Z`))
}
