import localFont from 'next/font/local'
import type { HTMLAttributes } from 'react'
import styles from './ui.module.css'

// Reuse the approved bank's binaries; its adjacent OFL licenses remain authoritative.
const archivo = localFont({ src: '../../../../docs/design/internal-language/fonts/archivo-variable.ttf', variable: '--cr-body-font', display: 'swap', weight: '100 900' })
const grenze = localFont({ src: '../../../../docs/design/internal-language/fonts/grenze-variable.ttf', variable: '--cr-display-font', display: 'swap', weight: '100 900' })

/** Opt-in scope. Importing the module never restyles public or existing tool pages. */
export function InternalTheme({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${archivo.variable} ${grenze.variable} ${styles.theme} ${className}`} />
}
