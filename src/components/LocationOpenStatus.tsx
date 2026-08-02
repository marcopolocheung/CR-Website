'use client'

import { useEffect, useState } from 'react'

const TIME_ZONE = 'America/Chicago'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

type Status = {
  isOpen: boolean
  label: string
  detail: string
}

function hoursForDay() {
  return {
    open: 11 * 60,
    close: 21 * 60,
  }
}

function getSanAntonioTime(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)

  return {
    day: DAY_INDEX[weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  }
}

function formatTime(minutes: number) {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function formatOpenDay(currentDay: number, offset: number) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'

  return WEEKDAYS[(currentDay + offset) % 7]
}

function getLocationStatus(now: Date): Status {
  const { day, minuteOfDay } = getSanAntonioTime(now)
  const todayHours = hoursForDay()

  if (minuteOfDay >= todayHours.open && minuteOfDay < todayHours.close) {
    return {
      isOpen: true,
      label: 'Open',
      detail: `Closes at ${formatTime(todayHours.close)}`,
    }
  }

  for (let offset = minuteOfDay < todayHours.open ? 0 : 1; offset < 7; offset += 1) {
    const { open } = hoursForDay()

    return {
      isOpen: false,
      label: 'Closed',
      detail: `Opens ${formatOpenDay(day, offset)} ${formatTime(open)}`,
    }
  }

  return {
    isOpen: false,
    label: 'Closed',
    detail: '',
  }
}

export default function LocationOpenStatus() {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    const updateStatus = () => setStatus(getLocationStatus(new Date()))

    updateStatus()
    const interval = window.setInterval(updateStatus, 60 * 1000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <span className="flex items-center gap-1.5 text-xs" data-testid="open-status" aria-live="polite">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${status?.isOpen ? 'bg-green-400' : 'bg-red-300'}`}
      />
      <span>
        {status ? (
          <>
            <strong data-testid="open-status-text">{status.label}</strong>
            {status.detail && (
              <>
                <span aria-hidden="true"> &bull; </span>
                {status.detail}
              </>
            )}
          </>
        ) : (
          'Checking hours'
        )}
      </span>
    </span>
  )
}
