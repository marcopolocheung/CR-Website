'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { buildPublishedWeek, encryptWeek, minimumCodeLength } from '@/lib/schedule-share'
import type { Employee, ScheduleAssignment, StaffingSlot } from '@/lib/scheduler'

const QRCodeSVG = dynamic(() => import('qrcode.react').then((module) => module.QRCodeSVG), { ssr: false })

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
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const filled = assignments.filter((assignment) => assignment.employeeId).length
  const codeTooShort = code.length > 0 && code.length < minimumCodeLength

  async function createLink() {
    if (code.length < minimumCodeLength) return
    setBusy(true)
    try {
      const token = await encryptWeek(buildPublishedWeek({ weekStart, name, slots, employees, assignments }), code)
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      setLink(`${window.location.origin}${basePath}/schedule#${token}`)
      setCopied(false)
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
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
            onChange={(event) => {
              setName(event.target.value)
              setLink('')
            }}
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          Code for staff
          <input
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setLink('')
            }}
            placeholder={`At least ${minimumCodeLength} characters`}
          />
        </label>
      </div>

      {codeTooShort && (
        <p className="mt-2 text-sm text-amber-800">
          Use at least {minimumCodeLength} characters. A short code is easy to guess for anyone who gets the link.
        </p>
      )}

      <button
        type="button"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={createLink}
        disabled={busy || code.length < minimumCodeLength || filled === 0}
      >
        {busy ? 'Making the link...' : 'Make the link'}
      </button>
      {filled === 0 && <p className="mt-2 text-sm text-zinc-600">Make a schedule for this week first.</p>}

      {link && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label className="text-sm font-medium text-zinc-800">
                Link for staff
                <input
                  readOnly
                  className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                  value={link}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                type="button"
                className="mt-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={copyLink}
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
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
