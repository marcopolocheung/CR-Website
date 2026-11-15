'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import InternalLanguage, { LanguageControls, useInternalLanguage } from './InternalLanguage'
import { LabeledInput, focusField } from './Feedback'
import { internalThemeClassName } from './ui/Theme'
import { errorKey, type Message } from '@/lib/internal-tools/i18n'
import { managerSession } from '@/lib/internal-tools/manager-session'
import { verifyWriteToken } from '@/lib/schedule-store'

/**
 * Staff entry from the public site: a plain page that only asks for the manager code. The Worker checks it, the
 * code is handed to the internal tools in memory (never the URL or storage), and the page moves to /internal.
 * Both pages share the order-shell root layout, so that move doesn't reload the page and the code survives it.
 */
export default function StaffEntry() {
  return <InternalLanguage banner={false}><EntryForm /></InternalLanguage>
}

function EntryForm() {
  const { t } = useInternalLanguage()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError(null)
    try {
      await verifyWriteToken(code)
      managerSession.handoff(code)
      router.replace('/internal')
    } catch (caught) {
      setError({ key: errorKey(caught) })
      setBusy(false)
      focusField('staff-code')
    }
  }

  return (
    <main className={`${internalThemeClassName} min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4 py-10`}>
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('home.entryTitle')}</h1>
        <p className="text-sm text-gray-600 mb-4">{t('home.entryInstructions')}</p>
        <LabeledInput id="staff-code" label={{ key: 'cash.managerCode' }} error={error} autoFocus
          type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)}
          className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-red-500" />
        <button type="submit" disabled={!code || busy}
          className="min-h-11 w-full mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          {t(busy ? 'cash.checking' : 'home.entryOpen')}
        </button>
      </form>
      <LanguageControls />
    </main>
  )
}
