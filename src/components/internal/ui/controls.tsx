'use client'

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './ui.module.css'

export function Button({ children, icon, variant = 'secondary', busy = false, disabled, className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; variant?: 'primary' | 'secondary' | 'quiet'; busy?: boolean }) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined}
    className={`${styles.button} ${styles[variant]} ${className}`}>
    {(busy || icon) && <Icon name={busy ? 'clock' : icon!} size={18} />}
    <span>{children}</span>
  </button>
}

export function IconButton({ label, icon, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & { label: string; icon: IconName }) {
  return <button {...props} type={props.type ?? 'button'} aria-label={label} title={props.title ?? label}
    className={`${styles.button} ${styles.secondary} ${styles.iconButton} ${props.className ?? ''}`}><Icon name={icon} size={18} /></button>
}

/** Shared input anatomy; Feedback's translated adapter retains the legacy appearance. */
export function Field({ id, label, error, hint, appearance = 'paper', className = '', ...props }:
  InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode; error?: ReactNode; hint?: ReactNode; appearance?: 'legacy' | 'paper' }) {
  const paper = appearance === 'paper'
  return <div className={paper ? styles.field : undefined}>
    <label htmlFor={id} className={paper ? styles.label : 'mb-1 block text-sm font-medium text-gray-700'}>{label}</label>
    <input {...props} id={id} className={`${paper ? styles.input : ''} ${className}`}
      aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={[props['aria-describedby'], hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined} />
    {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className={paper ? styles.fieldError : 'mt-2 text-sm text-red-700'}>
      {paper && <Icon name="warning" size={18} />}<span>{error}</span>
    </p>}
  </div>
}

export function Paper({ emphasis = 'supporting', className = '', ...props }: HTMLAttributes<HTMLElement> & { emphasis?: 'active' | 'supporting' }) {
  return <section {...props} className={`${styles.paper} ${emphasis === 'active' ? styles.activePaper : styles.supportingPaper} ${className}`} />
}
