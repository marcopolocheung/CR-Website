import en from './en'
import es from './es'
import type { Locale } from '../contracts'
export type TranslationKey = keyof typeof en
export type Message = { key: TranslationKey; params?: Record<string, string | number> }
export const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, es }
export const LOCALE_STORAGE_KEY = 'cr-internal-locale'
export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const dictionary = dictionaries[locale]
  if (!Object.hasOwn(dictionary, key)) return `[${key}]`
  const template = dictionary[key as TranslationKey]
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(params, name) ? String(params[name]) : placeholder)
}
/** Existing error classes stay wire compatible; clients store keys, never translated record values. */
export function errorKey(error: unknown): TranslationKey {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'StoreAuthError') return 'errors.unauthorized'
  if (name === 'StoreConflictError') return 'errors.conflict'
  if (name === 'StoreNotFoundError') return 'errors.notFound'
  if (name === 'StoreRejectedError' || /rejected|refused/.test(message)) return 'errors.rejected'
  if (/not set up|finish setup|SCHEDULE_WRITE_TOKEN/.test(message)) return 'errors.unconfigured'
  if (/Too many/.test(message)) return 'errors.rateLimited'
  return 'errors.unavailable'
}
