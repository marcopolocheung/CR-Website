import type { ReactNode } from 'react'
import { roleChipClass } from './helpers'

// Scheduler-local role glyphs follow the shared 24px outline icon grammar.
const glyphs: Record<string, ReactNode> = {
  server: <><path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M18 3c-3 4-3 8 0 9h2V3h-2ZM20 12v9" /></>,
  cashier: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 8h1M17 16h1" /></>,
  lead: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z" />,
  manager: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  cook: <><path d="M6 13a4 4 0 0 1-1-8 5 5 0 0 1 8-1 4 4 0 0 1 5 9v7H6Z" /><path d="M6 16h12M10 12v4M14 12v4" /></>,
  'line-cook': <><path d="M3 10h13a6 6 0 0 1-12 0M16 10l5-5M7 3v3M12 3v3" /><path d="M6 20h8" /></>,
  'fried-rice': <><path d="M3 11h18a9 9 0 0 1-18 0ZM8 20h8M7 8l1-3M12 8l1-4M17 8l1-3" /></>,
  dishwasher: <><circle cx="11" cy="13" r="8" /><circle cx="11" cy="13" r="4" /><path d="M20 2v5M17.5 4.5h5" /></>,
  'meat-prep': <><path d="M4 3h9v9H4ZM13 9l7 12M7 6h1" /></>,
  'veggie-prep': <><path d="M20 3C8 2 2 9 6 16s15 4 14-13ZM4 21 16 8" /></>,
  'mv-prep': <><path d="M13 3h7c1 8-2 12-7 10M12 21 18 7M3 3h5v9H3ZM8 10l4 11" /></>,
  shadow: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></>,
}

export function RoleIcon({ role, size = 14 }: { role: string; size?: number }) {
  return <svg data-role-icon={role} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0">
    {glyphs[role] ?? <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 5V3h8v2M4 11h16M10 11v3h4v-3" /></>}
  </svg>
}

export default function RoleBadge({ role, label }: { role: string; label: string }) {
  return <span data-role-badge={role} className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${roleChipClass(role)}`}>
    <RoleIcon role={role} /><span className="min-w-0 break-words">{label}</span>
  </span>
}
