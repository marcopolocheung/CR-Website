'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Locale } from '@/lib/internal-tools/contracts'
import { LOCALE_STORAGE_KEY, translate, type TranslationKey } from '@/lib/internal-tools/i18n'

type Language = { locale: Locale; t: (key: TranslationKey, params?: Record<string, string | number>) => string }
const Context = createContext<Language>({ locale: 'en', t: (key, params) => translate('en', key, params) })
export function useInternalLanguage() { return useContext(Context) }

export default function InternalLanguage({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    // Preserve the existing English paper output until DEC-07 approves output language.
    const before = () => flushSync(() => setPrinting(true))
    const after = () => flushSync(() => setPrinting(false))
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [])
  useEffect(() => {
    try { if (localStorage.getItem(LOCALE_STORAGE_KEY) === 'es') setLocale('es') } catch { /* preference storage is optional */ }
  }, [])
  const choose = useCallback((next: Locale) => {
    setLocale(next)
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch { /* changing language still works */ }
  }, [])
  const effectiveLocale = printing ? 'en' : locale
  const value = useMemo<Language>(() => ({ locale: effectiveLocale, t: (key, params) => translate(effectiveLocale, key, params) }), [effectiveLocale])
  return (
    <Context.Provider value={value}>
      <div lang={effectiveLocale}>
        <div className="sticky top-0 z-20 border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-yellow-900 print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{value.t('shell.internal')}</p>
            <div role="group" aria-label={value.t('shell.language')} className="flex gap-1">
              {(['en', 'es'] as const).map(language => (
                <button key={language} type="button" lang={language} aria-pressed={locale === language}
                  onClick={() => choose(language)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${locale === language ? 'border-yellow-900 bg-white' : 'border-transparent hover:bg-yellow-200'}`}>
                  {language === 'en' ? 'English' : 'Español'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {children}
      </div>
    </Context.Provider>
  )
}
