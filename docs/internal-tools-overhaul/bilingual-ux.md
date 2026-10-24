# Bilingual shared-device UX reference

The product supports English and Spanish on shared computers and tablets. Documentation is English; both languages use the same records. Proposed labels below require [DEC-07](tasks/DEC-07.md) staff review. UX-01 may establish infrastructure and provisional local dictionaries before terminology is approved; final terminology/output behavior gates only affected acceptance work.

## Context and routine work

Keep store, business date/week, relevant station/shift, and English / Español control visible while scrolling. Use explicit Store versus Station labels. A remembered device selection is a convenience, not confirmation of the next person's context. Show Resume this draft and Start new with task/store/date/preparer/time before applying a saved draft. Readable exact-record links should restore context after validation, including when entering from the dashboard.

Use one clear main action per stage: Finish count, Review close, Publish schedule, or Download report. Keep repetitive denomination/count entry fast in a table or roomy list; do not force a page per denomination/item. Separate catalog/rule/template editing from routine entry. Preserve branding and the existing recognizable paper reports.

## Dictionaries and language independence

Use stable namespaced keys and local dictionaries. Include navigation, instruction, validation, confirmation, save status, empty/error state, print label, and accessible name in translation coverage. Switching language must retain selected store/date/station, employee/record IDs, draft content, current step, and unsaved edits. Never translate an employee name, narrative, supplier input, or import source into a second authoritative record. Missing keys have a visible safe fallback and a development check; do not render a blank button.

| Provisional English | Provisional Spanish | Meaning to preserve |
| --- | --- | --- |
| Cash-out | Cierre de caja | Closing task, not a payroll deduction |
| Count inventory | Contar inventario | Routine count entry |
| Schedule | Horario | Staff schedule |
| Starting cash | Fondo inicial | DEC-02-approved retained starting amount |
| Expected cash | Efectivo esperado | Computed expected figure, distinct from actual deposit |
| Difference | Diferencia | Signed comparison with explicit basis |
| Items remaining | Artículos pendientes | Unfinished line count, not zero stock |
| Review changes | Revisar cambios | Compare before committing/publishing |
| Saved on this device | Guardado en este dispositivo | Local copy only |
| Saved to server | Guardado en el servidor | Acknowledged shared save |
| Waiting for connection | Esperando conexión | Submission has not succeeded |

USD is explicit. DEC-07 approves numeric examples and ambiguous comma/period behavior; preserve invalid input for correction and never silently reinterpret it. Business date display must be unambiguous and follow DEC-01, without assuming device locale/timezone equals the store's working day. Long Spanish labels wrap, controls grow, and errors identify the field and remedy in the selected language. Names and historical labels stay readable after directory/catalog changes.

## Keyboard and tablets

- Keep a logical Tab/Shift+Tab sequence and visible focus; Enter advances or commits only when its action is clear. Escape cancels a dialog/editor without losing unrelated work.
- Dialogs have names, focus entry/containment, keyboard dismissal where safe, and return focus to their trigger. Field errors link to the field; asynchronous status is announced without stealing typing focus.
- Provide tap/select and keyboard alternatives to schedule dragging. Do not require hover for essential actions.
- Aim for 44–48 CSS pixel frequent tablet targets and generous rows. Test with the onscreen keyboard open, portrait/landscape, long Spanish labels, and a sticky summary that does not cover the focused field.
- Keep entry and money summary together on wide screens; provide a readable compact summary on tablets. Preserve fractions and legacy mixed-unit text until units are approved. Zero, uncounted, Enough, and skipped must remain distinct.
- Use words with colors, and retain legible focus, disabled/read-only data, and printed checkboxes. A status must be understandable without red/green alone.

## Drafts, save states, handoff, and conflicts

UX-05 drafts use schema version, task type/record ID, store/date/period/station/shift as applicable, entered preparer, updated time, payload, and known server revision. Employee identity and preparer label are different. Do not store manager/staff tokens. Explain that a draft on this computer/tablet is not available on another device. Do not add app-install/service-worker requirements to reliable local draft work; offline launch can be evaluated separately after demonstrated demand.

Use explicit states: unsaved edit, saving on device, saved on device, sending, server acknowledged, waiting for connection, failed, and conflict. Keep the last acknowledged server revision visible when useful. An offline/timeout result never becomes Submitted or Reviewed. Stable operation IDs make retries safe; stale edits offer compare/reload/copy recovery instead of silently winning. Local persistence must handle quota, denied storage, corrupt payload, and schema upgrades while preserving recoverable source data.

Confirm context before resuming another person's draft or starting a new record on a shared device. Unsaved-navigation protection covers route, store/date/station switches and destructive actions, using actual browser navigation limitations honestly. Retention/disposal follows DEC-03; until approved, do not silently add destructive automatic cleanup. Make a safe handoff/lock action clear without requiring an authentication redesign.

## Print and file output

Use separate screen-entry and print layouts where paper structure impedes simple entry. Every relevant output identifies store/date/period, record/revision, and draft/submitted/review status. DEC-07 selects English, Spanish, or a deliberately bilingual print mode; do not assume the current UI language is the required signature/archive language. Keep original narratives, names, and issued order/count snapshots intact. Test long Spanish, page breaks, repeated headers, signatures, totals, and monochrome printing. Hide interactive controls. Blank downloads and existing sales/hours workbook layouts remain compatible.

Printed signature lines and entered names must not imply a completed review/signature workflow. DEC-06 determines the next form's actual requirements. Template-aware PDF tools are optional free reuse, not a guarantee a scanned template becomes interactive.

## Staff task protocol

REL-05 records uncoached current-workflow baselines before setting timing goals. Include English/Spanish staff and both shared computer and tablet. Test one close, a shortage explanation, yesterday's draft, zero/Enough inventory entries, a partial delivery, a one-day absence, publication comparison, a wrong upload, and form printing. Include a mid-task language switch, wrong store/date, connection failure, and a second editor. Record completion, mistakes, coaching, time, observed save-state understanding, and recovery; do not infer success from a build or an agent's own walkthrough. REL-06 pilots selected activated workflows with explicit fallback and exit criteria.
