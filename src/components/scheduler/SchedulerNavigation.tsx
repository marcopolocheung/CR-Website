'use client'

export type SchedulerView = 'schedule' | 'settings'

const views = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'settings', label: 'Employee settings' },
] as const

export default function SchedulerNavigation({
  view,
  settingsDirty,
  onChange,
  labels,
  neutral = false,
}: {
  view: SchedulerView
  settingsDirty: boolean
  onChange: (view: SchedulerView) => void
  labels?: Record<SchedulerView, string>
  neutral?: boolean
}) {
  return (
    <div role="tablist" aria-label="Scheduler views" className="grid grid-cols-2 gap-2 print:hidden">
      {views.map(({ id, label }, index) => (
        <button
          key={id}
          id={`scheduler-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={view === id}
          aria-controls={`scheduler-panel-${id}`}
          tabIndex={view === id ? 0 : -1}
          className={`min-h-12 rounded-lg border-2 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
            view === id
              ? neutral
                ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
                : 'border-red-800 bg-red-50 text-red-900'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            let nextIndex: number
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % views.length
            else if (event.key === 'ArrowLeft') nextIndex = (index + views.length - 1) % views.length
            else if (event.key === 'Home') nextIndex = 0
            else if (event.key === 'End') nextIndex = views.length - 1
            else return
            event.preventDefault()
            const next = views[nextIndex].id
            onChange(next)
            document.getElementById(`scheduler-tab-${next}`)?.focus()
          }}
        >
          {labels?.[id] ?? label}
          {id === 'settings' && settingsDirty && <span className="block text-xs font-normal">Unsaved changes</span>}
        </button>
      ))}
    </div>
  )
}
