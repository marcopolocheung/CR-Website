'use client'

import { type PublishState } from '@/lib/scheduler'
export function FlipSwitch({
  on,
  onFlip,
  label,
}: {
  on: boolean
  onFlip: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onFlip}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
        on ? 'bg-green-600' : 'bg-zinc-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export const publishStateMeta: Record<PublishState, { short: string; long: string; dot: string; badge: string }> = {
  live: { short: 'Live', long: 'Staff see this week', dot: 'bg-green-600', badge: 'border-green-300 bg-green-50 text-green-900' },
  changed: {
    short: 'Unpublished changes',
    long: 'Changes not published yet',
    dot: 'bg-amber-500',
    badge: 'border-amber-400 bg-amber-50 text-amber-950',
  },
  hidden: { short: 'Hidden', long: 'Published but hidden from staff', dot: 'bg-zinc-400', badge: 'border-zinc-300 bg-zinc-100 text-zinc-800' },
  draft: { short: 'Not published', long: 'Not published — staff cannot see it', dot: 'bg-zinc-300', badge: 'border-zinc-300 bg-white text-zinc-700' },
}

export function PublishStateBadge({ state }: { state: PublishState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${publishStateMeta[state].badge}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${publishStateMeta[state].dot}`} />
      {publishStateMeta[state].long}
    </span>
  )
}

export function Button({
  children,
  icon,
  tone = 'plain',
  badge,
  onClick,
  disabled = false,
  loading = false,
  title,
}: {
  children: React.ReactNode
  icon: IconName
  tone?: 'plain' | 'primary'
  badge?: number
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  title?: string
}) {
  const className =
    tone === 'primary'
      ? 'inline-flex items-center justify-center gap-2 rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'
      : 'inline-flex items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled || loading} aria-busy={loading} title={title}>
      {loading ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon name={icon} />
      )}
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-xs font-bold text-amber-950">
          {badge}
        </span>
      )}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  tone = 'plain',
}: {
  icon: IconName
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'plain' | 'accent'
}) {
  const className =
    tone === 'accent'
      ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'
      : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900'

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  )
}

export function Disclosure({
  summary,
  tone = 'default',
  children,
}: {
  summary: string
  tone?: 'default' | 'quiet'
  children: React.ReactNode
}) {
  if (tone === 'quiet') {
    return (
      <details className="px-1">
        <summary className="cursor-pointer py-1 text-sm text-zinc-500 hover:text-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
          {summary}
        </summary>
        <div className="py-2">{children}</div>
      </details>
    )
  }

  return (
    <details className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-3 font-semibold text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
        {summary}
      </summary>
      <div className="border-t border-zinc-100 px-4 py-3">{children}</div>
    </details>
  )
}

export function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-700">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          complete ? 'border-green-700 bg-green-700 text-white' : 'border-amber-400 bg-amber-50 text-amber-900'
        }`}
      >
        {complete ? <Icon name="check" /> : '!'}
      </span>
      {label}
    </div>
  )
}

export type IconName =
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'lock'
  | 'move'
  | 'plus'
  | 'print'
  | 'reset'
  | 'share'
  | 'spark'
  | 'target'
  | 'undo'
  | 'warning'

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    check: <path d="M5 12l4 4L19 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" />,
    move: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    print: <path d="M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z" />,
    reset: <path d="M4 12a8 8 0 1 0 2.3-5.7M4 5v5h5" />,
    share: <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M12 3v13M8 7l4-4 4 4" />,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
    target: <path d="M12 2v4M12 18v4M2 12h4M18 12h4M7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0zM10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />,
    undo: <path d="M9 14l-4-4 4-4M5 10h9a5 5 0 1 1 0 10h-1" />,
    warning: <path d="M12 9v4M12 17h.01M10.3 4.9L2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z" />,
  }

  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
