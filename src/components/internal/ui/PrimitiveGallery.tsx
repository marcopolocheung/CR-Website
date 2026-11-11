'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import EntryWorkspace from '../EntryWorkspace'
import { LabeledInput, SaveFeedback, type SaveState, useConfirmation } from '../Feedback'
import { useInternalLanguage } from '../InternalLanguage'
import { Button, Field, IconButton, Paper } from './controls'
import { Icon, iconNames, type IconName } from './Icon'
import { MovingNavigation } from './MovingNavigation'
import styles from './gallery.module.css'

const copy = {
  en: {
    title: 'Component gallery', preview: 'Synthetic preview · No restaurant connection', navigation: 'Preview navigation',
    tasks: ['Dashboard', 'Cash', 'Inventory', 'Schedule', 'Reports', 'Forms'],
    workspace: 'Cash count', context: 'CR3 · November 11, 2026 · Sample drawer', entry: 'Entry controls',
    amount: 'Amount ($)', hint: 'Blank is different from zero.', validate: 'Check fields', save: 'Preview save',
    busy: 'Previewing…', complete: 'Preview complete. No record was saved.', idle: 'Preview ready. No record will be saved.',
    controls: 'Actions', disabled: 'Unavailable action', clear: 'Clear preview', long: 'Review and publish the schedule for all selected stations',
    statuses: 'Save states · Examples', icons: 'Shared outline icons', palette: 'Surface roles',
    dark: 'Accent on dark', light: 'Accent on paper', paper: 'Paper', primary: 'Primary action',
    invalid: 'Enter a nonnegative amount with up to two decimal places.', readOnly: 'Read-only context',
  },
  es: {
    title: 'Galería de componentes', preview: 'Vista previa de prueba · Sin conexión al restaurante', navigation: 'Navegación de vista previa',
    tasks: ['Inicio', 'Efectivo', 'Inventario', 'Horario', 'Informes', 'Formularios'],
    workspace: 'Conteo de efectivo', context: 'CR3 · 11 de noviembre de 2026 · Caja de prueba', entry: 'Controles de entrada',
    amount: 'Importe ($)', hint: 'Un campo vacío es diferente de cero.', validate: 'Revisar campos', save: 'Vista previa de guardar',
    busy: 'Preparando vista previa…', complete: 'Vista previa completa. No se guardó ningún registro.', idle: 'Vista previa lista. No se guardará ningún registro.',
    controls: 'Acciones', disabled: 'Acción no disponible', clear: 'Borrar vista previa', long: 'Revisar y publicar el horario de todas las estaciones seleccionadas',
    statuses: 'Estados de guardado · Ejemplos', icons: 'Iconos de contorno compartidos', palette: 'Funciones de las superficies',
    dark: 'Acento en superficie oscura', light: 'Acento en papel', paper: 'Papel', primary: 'Acción principal',
    invalid: 'Ingrese un importe no negativo con hasta dos decimales.', readOnly: 'Contexto de solo lectura',
  },
}
const taskIds = ['home', 'cash', 'inventory', 'calendar', 'report', 'form'] as const
const saveStates: SaveState[] = ['unsaved', 'device', 'sending', 'server', 'waiting', 'failed', 'conflict']

/** Review fixture only. No domain calculation, storage adapter, token or API client. */
export default function PrimitiveGallery() {
  const { locale } = useInternalLanguage()
  const text = copy[locale]
  const [selected, setSelected] = useState('cash')
  const [name, setName] = useState('Ana López')
  const [amount, setAmount] = useState('300.00')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmation = useConfirmation()
  const navigationItems = useMemo(() => taskIds.map((id, index) => ({ id, label: text.tasks[index], icon: id as IconName })), [text])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  function validate() {
    const valid = /^(?:\d+(?:\.\d{1,2})?)$/.test(amount)
    setInvalid(!valid)
    if (!valid) document.getElementById('gallery-amount')?.focus()
    return valid
  }
  function preview() {
    if (!validate()) return
    setBusy(true); setCompleted(false)
    timer.current = setTimeout(() => { setBusy(false); setCompleted(true) }, 900)
  }
  return <main className={styles.gallery} data-ui-gallery>
    <header className={styles.heading}>
      <p className={styles.kicker}>CHINA ROSE / INTERNAL UI</p>
      <h1>{text.title}</h1><p>{text.preview}</p>
    </header>
    <div className={styles.specimen}>
      <MovingNavigation items={navigationItems}
        selectedId={selected} onSelect={setSelected} label={text.navigation} />
      <div className={styles.work}>
        <header className={styles.masthead}><Icon name="cash" size={32} /><div><h2>{text.workspace}</h2><p>{text.context}</p></div></header>
        <div className={styles.workBody}>
          <Paper emphasis="active" aria-labelledby="gallery-entry-title">
            <h3 id="gallery-entry-title">{text.entry}</h3>
            <EntryWorkspace appearance="paper" finishId="gallery-save" summary={<p>{text.context}</p>}>
              <div className={styles.fields}>
                <LabeledInput appearance="paper" id="gallery-name" label={{ key: 'cash.cashierName' }} value={name}
                  onChange={event => { setName(event.target.value); setCompleted(false) }} data-entry-field autoComplete="off" />
                <Field id="gallery-amount" label={text.amount} hint={text.hint} inputMode="decimal" value={amount}
                  onChange={event => { setAmount(event.target.value); setCompleted(false) }} data-entry-field
                  error={invalid ? text.invalid : undefined} />
                <Field id="gallery-context" label={text.readOnly} value="CR3 · 2026-11-11" readOnly />
              </div>
              <div className={styles.actions}>
                <Button id="gallery-save" variant="primary" icon="check" busy={busy} onClick={preview}>{busy ? text.busy : text.save}</Button>
                <Button onClick={validate} icon="warning">{text.validate}</Button>
              </div>
            </EntryWorkspace>
            <p role="status" data-preview-result className={styles.previewResult}>{completed ? text.complete : text.idle}</p>
          </Paper>
          <Paper aria-labelledby="gallery-actions-title">
            <h3 id="gallery-actions-title">{text.controls}</h3>
            <div className={styles.actions}>
              <Button disabled icon="lock">{text.disabled}</Button>
              <IconButton icon="print" label={locale === 'es' ? 'Imprimir vista previa' : 'Print preview'} onClick={() => window.print()} />
              <Button variant="quiet" icon="close" onClick={async () => {
                if (await confirmation.ask({ key: 'cash.clearConfirm' }, true)) { setName(''); setAmount(''); setInvalid(false); setCompleted(false) }
              }}>{text.clear}</Button>
            </div>
            <Button icon="calendar" onClick={() => setSelected('calendar')}>{text.long}</Button>
          </Paper>
        </div>
      </div>
    </div>
    <section aria-labelledby="gallery-status-title" className={styles.section}>
      <h2 id="gallery-status-title">{text.statuses}</h2>
      <div className={styles.states}>{saveStates.map(state => <SaveFeedback key={state} state={state} appearance="paper" />)}</div>
    </section>
    <section aria-labelledby="gallery-palette-title" className={styles.section}>
      <h2 id="gallery-palette-title">{text.palette}</h2>
      <div className={styles.palette}>
        <div data-color-role="dark">{text.dark}<Icon name="store" size={32} /></div>
        <div data-color-role="light">{text.light}<Icon name="cash" size={32} /></div>
        <div data-color-role="paper">{text.paper}<span>$1,234,567.89</span></div>
        <div data-color-role="primary">{text.primary}<Icon name="check" size={32} /></div>
      </div>
    </section>
    <section aria-labelledby="gallery-icons-title" className={styles.section}>
      <h2 id="gallery-icons-title">{text.icons}</h2>
      <div className={styles.icons}>{iconNames.map(icon => <div key={icon}><Icon name={icon} size={32} /><span>{icon}</span></div>)}</div>
    </section>
    {confirmation.dialog}
  </main>
}
