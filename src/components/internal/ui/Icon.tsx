import type { CSSProperties, ReactNode } from 'react'

/** Paths from approved bank v1.0, reference.html. Keep concepts identical. */
const paths = {
  home: <path d="M3 10 12 3l9 7v10H3zM9 20v-7h6v7" />,
  cash: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 8h1M17 16h1" /></>,
  inventory: <path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3" /></>,
  report: <path d="M4 3v18h17M8 16v-5M13 16V7M18 16v-9" />,
  form: <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />,
  arrow: <path d="M4 12h16M14 6l6 6-6 6" />,
  store: <path d="M3 9 5 3h14l2 6M3 9v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 15v6h14v-6M10 21v-5h4v5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="M5 12l4 4L19 6" />,
  warning: <path d="m12 3 10 18H2zM12 9v4M12 17h.01" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  print: <path d="M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z" />,
  lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  layers: <path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5" />,
  frame: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M3 8h18M16 12h1M11 12h1M11 16h6" /></>,
  light: <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--icon-surface,white)" /><circle cx="15" cy="17" r="3" fill="var(--icon-surface,white)" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths
export const iconNames = Object.keys(paths) as IconName[]

/** Decorative only: the containing action supplies its visible/accessibility label. */
export function Icon({ name, size = 20, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties
}) {
  return <svg width={size} height={size} className={className} style={{ flexShrink: 0, ...style }} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{paths[name]}</svg>
}
