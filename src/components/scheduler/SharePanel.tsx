'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  buildPublishedWeek,
  encryptWeek,
  minimumCodeLength,
  serializePublishedWeek,
  templateHashForSlots,
} from '@/lib/schedule-share'
import {
  StoreConflictError,
  StoreNotFoundError,
  createSharedWeek,
  updateSharedWeek,
} from '@/lib/schedule-store'
import type { Employee, ScheduleAssignment, StaffingSlot } from '@/lib/scheduler'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((module) => module.QRCodeSVG), { ssr: false })

type PublishedMeta = {
  id: string
  rev: number
  fingerprint: string
}

const publishedKey = 'chinarose.schedule.published.v1'

function readPublished(): Record<string, PublishedMeta> {
  try {
    const raw = window.localStorage.getItem(publishedKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PublishedMeta>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePublished(next: Record<string, PublishedMeta>) {
  try {
    window.localStorage.setItem(publishedKey, JSON.stringify(next))
  } catch {
    return
  }
}

const codeWords = ['salsa', 'limon', 'wok', 'mesa', 'arroz', 'pollo', 'fiesta', 'comal', 'taco', 'verde']

function suggestCode() {
  const pick = () => codeWords[Math.floor(Math.random() * codeWords.length)]
  const digits = String(Math.floor(100 + Math.random() * 900))
  return `${pick()}-${digits}-${pick()}`
}

export default function SharePanel({
  weekStart,
  weekLabel,
  slots,
  employees,
  assignments,
  onClose,
}: {
  weekStart: string
  weekLabel: string
  slots: StaffingSlot[]
  employees: Employee[]
  assignments: ScheduleAssignment[]
  onClose: () => void
}) {
  const [name, setName] = useState(`Week of ${weekLabel}`)
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [confirmingFresh, setConfirmingFresh] = useState(false)
  const [published, setPublished] = useState<PublishedMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const filled = assignments.filter((assignment) => assignment.employeeId).length
  const codeTooShort = code.length > 0 && code.length < minimumCodeLength

  // Renaming the week does not change what staff see on shift, so it never marks the link dirty.
  const fingerprint = useMemo(
    () => serializePublishedWeek(buildPublishedWeek({ weekStart, name: '', slots, employees, assignments })),
    [weekStart, slots, employees, assignments],
  )
  const dirty = published !== null && published.fingerprint !== fingerprint
  const link = useMemo(() => {
    if (!published) return ''
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    return `${window.location.origin}${basePath}/schedule#${published.id}`
  }, [published])

  useEffect(() => {
    setPublished(readPublished()[weekStart] ?? null)
    setError('')
    setNotice('')
    setCopiedLink(false)
    setCopiedCode(false)
    setConfirmingFresh(false)
  }, [weekStart])

  function persist(next: PublishedMeta | null) {
    setPublished(next)
    const all = readPublished()
    if (next) all[weekStart] = next
    else delete all[weekStart]
    writePublished(all)
  }

  async function publish() {
    if (code.length < minimumCodeLength || filled === 0) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const week = buildPublishedWeek({ weekStart, name, slots, employees, assignments })
      const ciphertext = await encryptWeek(week, code)
      const created = await createSharedWeek({
        ciphertext,
        templateHash: templateHashForSlots(slots),
        weekStart,
      })
      persist({ id: created.id, rev: created.rev, fingerprint })
      setCopiedLink(false)
      setCopiedCode(false)
      setNotice('Link made. Send it once — later edits save to this same link.')
    } catch {
      setError('Could not save the schedule. Check your connection — your edits are still safe on this device.')
    } finally {
      setBusy(false)
    }
  }

  async function saveUpdates() {
    if (!published || code.length < minimumCodeLength) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const week = buildPublishedWeek({ weekStart, name, slots, employees, assignments })
      const ciphertext = await encryptWeek(week, code)
      const result = await updateSharedWeek(published.id, { ciphertext, baseRev: published.rev })
      persist({ ...published, rev: result.rev, fingerprint })
      setNotice('Saved. Everyone opening this link now sees the update.')
    } catch (caught) {
      if (caught instanceof StoreConflictError) {
        persist({ ...published, rev: caught.rev })
        setError(
          'Someone else saved this week first. What is on your screen has not been shared yet — press Save updates again to overwrite with your copy.',
        )
      } else if (caught instanceof StoreNotFoundError) {
        persist(null)
        setError('That saved link is gone. Make a fresh link below.')
      } else {
        setError('Could not save the update. Check your connection — your edits are still safe on this device.')
      }
    } finally {
      setBusy(false)
    }
  }

  function freshLink() {
    persist(null)
    setError('')
    setNotice('')
    setCopiedLink(false)
    setCopiedCode(false)
    setConfirmingFresh(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
    } catch {
      setCopiedLink(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
    } catch {
      setCopiedCode(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Share {weekLabel} with staff</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {filled} filled spot{filled === 1 ? '' : 's'} will be included. Staff open the link and type the code.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-800">
          What to call it
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="share-code">
            Code for staff
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="share-code"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              value={code}
              type={showCode ? 'text' : 'password'}
              autoComplete="off"
              onChange={(event) => {
                setCode(event.target.value)
                setCopiedCode(false)
              }}
              placeholder={`At least ${minimumCodeLength} characters`}
            />
            <button
              type="button"
              className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => setShowCode((show) => !show)}
              aria-pressed={showCode}
            >
              {showCode ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => {
              setCode(suggestCode())
              setShowCode(true)
              setCopiedCode(false)
            }}
          >
            Suggest a code
          </button>
        </div>
      </div>

      {codeTooShort && (
        <p className="mt-2 text-sm text-amber-800">
          Use at least {minimumCodeLength} characters. A short code is easy to guess for anyone who gets the link.
        </p>
      )}
      {published && (
        <p className="mt-2 text-sm text-zinc-600">
          Always use the same code for this link. Staff cannot open updates saved with a different code.
        </p>
      )}

      {!published ? (
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={publish}
          disabled={busy || code.length < minimumCodeLength || filled === 0}
        >
          {busy ? 'Making the link...' : 'Make the link'}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={saveUpdates}
            disabled={busy || code.length < minimumCodeLength || !dirty}
          >
            {busy ? 'Saving...' : 'Save updates to this link'}
          </button>
          {confirmingFresh ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1">
              <span className="text-xs font-semibold text-red-900">Old link stops updating. Continue?</span>
              <button
                type="button"
                className="rounded bg-red-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={freshLink}
              >
                Yes, fresh link
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => setConfirmingFresh(false)}
              >
                Keep this link
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => setConfirmingFresh(true)}
            >
              Make a fresh link instead
            </button>
          )}
          {!dirty && <span className="text-sm text-green-800">This link is up to date.</span>}
          {dirty && <span className="text-sm font-medium text-amber-800">You have changes that staff cannot see yet.</span>}
        </div>
      )}
      {filled === 0 && <p className="mt-2 text-sm text-zinc-600">Make a schedule for this week first.</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-800">{error}</p>}
      {notice && !error && <p className="mt-2 text-sm font-medium text-green-800">{notice}</p>}

      {link && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label className="text-sm font-medium text-zinc-800">
                Link for staff — send it once, it stays the same
                <input
                  readOnly
                  className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                  value={link}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={copyLink}
                >
                  {copiedLink ? 'Link copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onClick={copyCode}
                  disabled={code.length === 0}
                  title={code.length === 0 ? 'Type the staff code first.' : 'Copy only the code.'}
                >
                  {copiedCode ? 'Code copied' : 'Copy code'}
                </button>
              </div>
              <p className="mt-3 text-sm text-zinc-700">
                Tell staff the code yourself. Do not send it with the link, or anyone who sees the message can read the
                schedule.
              </p>
            </div>
            <div className="shrink-0 text-center">
              <QRCodeSVG value={link} size={148} level="M" aria-label={`QR code for ${name}`} />
              <p className="mt-2 text-xs text-zinc-600">Print for the break room</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
