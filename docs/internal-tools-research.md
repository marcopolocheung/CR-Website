**China Rose internal tools: workflow and reuse research**

Cash scope clarification: the owner-approved [DEC-02 notebook decision](internal-tools-overhaul/cashout-rules.md) takes precedence over general cash-control suggestions in this research. Fixed $100 per drawer, calculations and saved lookup history are the current purpose; cash operational workflows are deferred.

Research date: October 24, 2026. Scope: scheduler, cash-out, inventory, sales and hours converters, forms/write-ups, dashboard, and the internal QR utility.

The intended product is China Rose's own application, used mainly on a shared computer or tablet, in English and Spanish. Commercial products below are workflow references, not subscription recommendations. Authentication and the hosting migration are separate workstreams.

This report combines repository inspection with official product guides, public screenshots, developer documentation, and upstream license declarations. It is not a hands-on evaluation inside paid accounts. The 7shifts scheduling and MarginEdge inventory-status screenshots were inspected directly. Other interface descriptions follow the vendors' documented screens and procedures. References describe established commercial patterns, not mandatory industry standards or measured proof that China Rose staff will find a screen easy.

**Recommendation**

Keep the current restaurant-specific application and build clearer task workflows around it. Reuse focused open-source components for translations, forms, tables, document output, and local drafts. A wholesale inventory/HR system replacement would require adapting to another product's data model and administration.

Every workflow should answer: What store/date am I working on? What do I enter next? Has my work actually saved? What remains unfinished? What happens after I finish?

**Shared computer/tablet design**

Use a consistent top bar showing store, working date or week, shift when relevant, and an always-visible English / Español switch. Keep that context visible while scrolling. A shared device's last selection is a convenience, not confirmation that the next person is working on the same store or date.

Provide keyboard-friendly entry on a computer and large tap controls on a tablet. Use a roomy list or two-panel workspace rather than shrinking a desktop spreadsheet. Keep print layouts separate so staff can continue using recognizable paper forms.

Recommended defaults:

- Give each screen one obvious main action: Finish count, Review cash-out, Publish schedule, Download report.
- Keep routine work separate from editing rules, item catalogs, and templates.
- Use explicit words alongside status colors; never make red/green the only distinction.
- Label drafts by store, date, task, and entered preparer. Make resuming or starting a new task explicit.
- Distinguish Saved on this device, Saved to server, and Waiting for connection. A local copy alone is not a completed shared record.
- Preserve entered values after validation errors and highlight the specific field to fix.
- Provide Undo or a clear recovery path for common mistakes.
- Use short sections for long incident reports. Keep repetitive cash and stock entry fast; do not force a separate page for every denomination or item.

W3C's form guidance supports clear progress through multi-page forms and actionable success/error notifications. Its target-size guidance sets a 24 CSS pixel minimum with exceptions; a larger 44–48 pixel target is our proposed practical design target for frequent tablet actions. Dragging must have a simple pointer alternative, so schedule assignment must also work through tapping and selecting. [Form progress](https://www.w3.org/WAI/tutorials/forms/multi-page/), [notifications](https://www.w3.org/WAI/tutorials/forms/notifications/), [target sizes](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

**English and Spanish**

Translate navigation, instructions, confirmation dialogs, field errors, save states, empty states, and printable labels. Switching language must preserve the current task and data. Leave entered names and original incident narratives intact. Both languages should read the same record rather than create separate copies.

Use stable translation keys rather than matching English sentences. Start with local English/Spanish dictionaries; no paid translation service is necessary. i18next and its React binding provide existing infrastructure, and i18next is MIT-licensed. SurveyJS also documents localization for its form runtime. [i18next](https://github.com/i18next/i18next), [React binding](https://react.i18next.com/), [SurveyJS localization](https://surveyjs.io/form-library/documentation/survey-localization).

Suggested staff-facing wording, to validate with Spanish-speaking staff:

| English | Spanish |
| --- | --- |
| Cash-out | Cierre de caja |
| Count inventory | Contar inventario |
| Schedule | Horario |
| Starting cash | Fondo inicial |
| Expected cash | Efectivo esperado |
| Difference | Diferencia |
| Items remaining | Artículos pendientes |
| Review changes | Revisar cambios |
| Saved on this device | Guardado en este dispositivo |
| Waiting for connection | Esperando conexión |

Allow labels to wrap and grow in Spanish. Keep USD and amount examples explicit; do not silently reinterpret ambiguous decimal separators. Show clear dates and the store's working business date. Test language switching during partially completed work and on printed output.

**Scheduler: use 7shifts as the main workflow reference**

7shifts documents a desktop week grid and a mobile day list with a week selector. Its public desktop screenshot puts date, location, department, layout, and day/week controls above the schedule. That is a useful division between planning a whole week and handling one day's changes. [Shift creation and screenshots](https://kb.7shifts.com/hc/en-us/articles/4417514096915-Add-shifts-to-a-schedule).

It distinguishes recurring availability from one-off time off and temporary availability. Publishing includes a review of shift changes and a choice of whom to notify. These are separate concepts rather than a single employee availability switch. [Availability](https://kb.7shifts.com/hc/en-us/articles/4417513664659-7shifts-101-Availability), [publishing](https://kb.7shifts.com/hc/en-us/articles/4417514210067-How-to-publish-a-schedule).

China Rose already has generation, locking/manual assignment, copy-prior-week, undo, guided issue resolution, weekly hour summaries, draft/live indicators, printing, and staff-only-person filtering. Preserve these capabilities.

Proposed routine workflow:

1. Choose station and week.
2. Review dated absences and changed availability.
3. Copy the previous week or make a schedule.
4. Resolve coverage and hour warnings.
5. Review a readable comparison with the published week.
6. Publish and print/open the staff view.

Implement dated time-off records with Pending, Approved, and Declined states. Managers can enter requests reported verbally, so the first version does not require employees to use personal phones. Feed approved exceptions into both generation and manual-assignment validation. Keep suspension distinct from time off.

Add a publication comparison: employee, day, old shift, new shift, and newly uncovered positions. Record published revisions so the comparison remains meaningful. Existing draft/live indicators alone do not explain what changed.

Add one shared employee identity across stations before cross-station collision detection or combined-hour reporting. The same name in two independent station rosters is not a reliable identity match. Add optional weekly hour caps/targets and multi-week fairness after the shared identity is established.

Reuse options: the existing board may remain the best fit for fixed AM/PM positions. React Big Calendar is MIT-licensed if a calendar layout is needed. FullCalendar Standard is MIT, while employee/resource timeline views belong to Premium and require separate licensing for the intended use. Neither calendar performs scheduling constraint solving. [React Big Calendar](https://github.com/bigcalendar/react-big-calendar), [FullCalendar licensing/features](https://fullcalendar.io/pricing).

Google OR-Tools supplies Apache-2.0 optimization code and employee-scheduling examples. It is a future engine option, not a ready-made restaurant scheduler. Its native C++ implementation and language wrappers require a separate runtime assessment; it is not a drop-in replacement for the current browser JavaScript solver. Keep the independent validator regardless of solver choice. [Scheduling examples](https://developers.google.com/optimization/scheduling/employee_scheduling), [OR-Tools repository](https://github.com/google/or-tools).

Repository entry points: `src/components/scheduler/SchedulerDemo.tsx`, `PublishPanel.tsx`, `StaffEditor.tsx`, `src/lib/scheduler/`, and `src/components/schedule/ScheduleViewer.tsx`.

**Cash-out: use Toast closing and Restaurant365 review as references**

Toast's documented closing sequence finishes checks, shift reviews, and drawers before the final cash deposit. Its deposit entry records actual money going to the bank, excluding the starting drawer cash retained in the restaurant. Expected deposit and actual deposit are therefore distinct values. [Closing overview](https://support.toasttab.com/en/article/Close-Out-Day-Z-Report-Auto-Capture), [cash deposits](https://support.toasttab.com/en/article/Deposits-Adding-Actual-Cash-Amounts).

Restaurant365 provides In Progress, Completed, and Approved views for daily summaries; completing a record and approving it are separate steps. Its review covers deposits, transactions, labor, attachments, and log entries. [Daily summary screens](https://docs.restaurant365.com/docs/mobile-daily-sales-summary), [approval workflow](https://docs.restaurant365.com/docs/daily-sales-approve-a-dss).

China Rose currently provides denomination counts, a fixed $100 float calculation, cashier/shift totals, comparison with Toast and a Z figure, saving, printing, and 30-day history. It does not yet model a completed close with review and resolution.

Proposed routine workflow:

1. Open the store/date and choose AM or PM.
2. Select a cashier; enter denomination quantities in a predictable sequence.
3. Review counted cash, starting cash, expected cash, and difference in a fixed summary panel.
4. Add an explanation or recount if there is a discrepancy.
5. Finish the shift and later record the day's actual deposit.
6. Show the close as awaiting manager review, reviewed, or needing correction.

Keep entry on the left and the live money summary on the right on larger screens. Collapse that summary into a sticky strip on a tablet. Support Tab/Enter movement and a numeric keypad. Show Uncounted rather than presenting an untouched drawer as a completed shortage. Offer cashier selection from the shared directory, with a temporary-name escape hatch for substitutions.

Separate draft saving from submitting a completed close. Track discrepancy notes, review outcome, and revisions. Recalculate totals on the server. Preserve the existing paper printout as an output. Validate whether the fixed float applies everywhere before adding configurable starting cash; do not invent cash-movement categories or alter accounting policy without confirming the actual closing procedure.

This workflow is small enough to implement directly with existing React components and `src/lib/cashout.ts`. A large ERP is not needed for denomination entry. The main new records are close status, discrepancy/resolution notes, actual deposit, review event, and versions.

Repository entry points: `src/components/internal/CashOut.tsx`, `src/lib/cashout.ts`, `src/lib/cashout-store.ts`, and the cash-out Worker routes.

**Inventory: use MarginEdge counting and MarketMan receiving as references**

MarginEdge documents searchable count sheets, category entry, a calculator, saved progress, and separate Save versus Save and Close actions. Its multi-store screen distinguishes Not counted, In progress, and Closed, including a counted-item progress bar. Its item-list edit mode is separate from entering counts. [Mobile count workflow](https://help.marginedge.com/hc/en-us/articles/6766940782355-Mobile-Inventory-on-your-Phone), [status/progress screenshot](https://help.marginedge.com/hc/en-us/articles/50861486741651-Viewing-Inventory-Counts-Status-and-Progress-across-Multiple-Stores), [editing mode](https://help.marginedge.com/hc/en-us/articles/47246904250515-Count-Sheet-Edits-on-the-Mobile-App).

MarketMan documents a purchasing loop: suggest an order against target stock, review/send the purchase order, and check delivered quantities against it. Receiving flags missing or differing quantities. This explains why a generated shopping list alone is not an order-tracking system. [Purchasing and receiving](https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management).

China Rose already has recognizable paper-derived sections, manual INV/ORDER fields, an Enough checkmark, suggested order quantities, earlier count columns, editable items, supplier grouping, copying, and printing. It is currently CR3-only.

Proposed routine workflow:

1. Start or resume a labeled count for the store/date.
2. Choose an area such as dry storage or drinks.
3. Enter quantities in shelf order; see counted/remaining progress.
4. Review untouched items and unusual differences.
5. Finish the count and review an order grouped by supplier.
6. Mark an order placed, then receive against it when delivered.

Retain a fast table for the shared computer. On tablets show generous rows and open a quantity editor when tapped. Put Remaining, Needs ordering, and Search above the list. Use explicit units and pack sizes alongside each item, and label the target quantity in ordinary words rather than relying on SUP and Use abbreviations.

Model count sessions, count lines, purchase orders, order lines, receipts, and receipt lines separately. Preserve the item/unit/supplier details used on an issued order even if the catalog changes later. Distinguish a count of zero from an uncounted item and Enough from a measured quantity. Count completion should report deliberately skipped items.

Add partial receipt quantities and missing-item notes. When deriving suggested orders, show outstanding quantities so staff can avoid ordering twice. Waste, delivery discrepancies, and inter-store transfers can follow once units and receiving are dependable. Do not infer consumption from count differences alone: deliveries, waste, and transfers also change stock.

Camera scanning is optional on a shared tablet. ZXing's browser library is MIT-licensed; a USB scanner that types into a focused search field is a separate input path. Shelf QR labels may help locate items without adding computer vision. [ZXing browser library](https://github.com/zxing-js/browser), [MarginEdge shelf/product QR pattern](https://help.marginedge.com/hc/en-us/articles/50628844459923-Printing-QR-Codes-for-Products-and-Recipes).

Repository entry points: `src/components/internal/Inventory.tsx`, `src/lib/inventory.ts`, `src/lib/inventory-store.ts`, and the inventory Worker routes.

**Daily sales and employee hours: turn conversion into reviewable imports**

Toast already provides payroll exports by date range and documents why completed shift reviews affect the exported data. Its timesheet workflow exposes open punches and requires corrections in the underlying Toast time records. These are important distinctions when a CSV seems incomplete: not every problem belongs in the converter. [Payroll export](https://support.toasttab.com/en/article/How-do-I-export-the-Payroll-Labor-Summary-report), [timesheet review](https://support.toasttab.com/en/article/Toast-Payroll-Managing-Timesheets).

Keep the existing Excel output formats, but introduce Import → Review → Download. For sales, show the detected reports and extracted sales/tax/payment/deposit figures. For hours, show matched/unmatched employees, date coverage, totals, and punch exceptions before export. Give the error a remedy: Lunch report is missing Sales category summary; upload that report again.

On the shared computer provide three clearly labeled upload slots with filenames and Replace buttons for the current sales format. Explain where each export comes from. Later add batch detection only where file contents reliably identify the type; ambiguous files need a user choice.

Use one selected business date for the sales record and derive the displayed weekday. Do not clear successful imports immediately: keep Download again and Start next report actions. Record a source-file fingerprint and import version so a repeated upload can be recognized instead of duplicated.

For hours, make the selected period actually filter or validate rows, maintain a small employee-ID mapping screen, and show unrecognized rows rather than silently discarding them. Imported regular/overtime totals should remain identifiable as source values. A custom preparation screen should not silently become a replacement payroll calculation engine.

ExcelJS and Papa Parse are already installed and their installed packages declare MIT licenses. Continue using them. TanStack Table can supply MIT-licensed sorting/filtering/grouping for review screens without determining their visual layout. [TanStack Table](https://github.com/TanStack/table).

Toast API integration is optional, not part of the no-new-subscription baseline. Standard API access is read-only and includes documented cash-management and labor scopes; it requires the relevant account entitlement. Analytics access is a separate entitlement and credential set. Do not promise automatic import before checking access, endpoints, business-date semantics, and parity with the current workbook. CSV/XLSX remains the baseline. [Standard access](https://doc.toasttab.com/doc/devguide/devApiAccessUserGuide.html), [scopes](https://doc.toasttab.com/doc/devguide/devApiAccessScopes.html), [account requirements](https://doc.toasttab.com/doc/devguide/devApiAccessFAQs.html), [analytics access](https://doc.toasttab.com/doc/devguide/apiAnalyticsAccessOverview.html).

Repository entry points: `src/components/internal/SalesConverter.tsx`, `HoursConverter.tsx`, `Bookkeeping.tsx`, and `src/lib/converter/`.

**Forms and write-ups: simple entry, recognizable output, explicit follow-up**

Jotform's approval product separates submission from downstream decisions and supports conditional routes. SafetyCulture's documented completion-screen choice distinguishes immediate report review/export from returning straight to the next task. These patterns can be implemented in our own small workflows. [Approval workflow reference](https://www.jotform.com/products/approvals/faq/), [completion behavior](https://help.safetyculture.com/en-US/005883/).

China Rose has a downloadable blank-form catalog and a digital write-up with immutable saved content and an editable manager label. Other forms are mostly Excel/Word/PDF files.

For a new digital form, use short sections: person/date → what happened → action/follow-up → review/print. Preserve free-text narratives and the original submitted record. Add drafts, follow-up due dates, assignment, attachments, and append-only amendments. Make the distinction between printed signature fields and a completed signature workflow explicit.

Add an employee/date/type search screen before increasing the number of digital forms. Keep blank-form downloads as a fallback. Select the next form by actual frequency and staff difficulty; customer complaint or daily preparation forms may be sensible candidates, but repository files alone do not establish usage.

SurveyJS Form Library is an MIT-licensed runtime for configured forms. Its conditional logic and localization can reduce repeated code. The visual Survey Creator, PDF Generator, and Dashboard are proprietary products requiring developer licensing. For a no-subscription version, write the form definitions ourselves, use the free runtime only if it helps, and retain our own print/output code. React JSON Schema Form is an Apache-2.0 alternative for schema-driven React forms. [SurveyJS licensing](https://surveyjs.io/licensing), [conditional logic](https://surveyjs.io/form-library/documentation/design-survey/conditional-logic), [RJSF](https://github.com/rjsf-team/react-jsonschema-form).

pdf-lib is MIT-licensed and supports creating/modifying PDFs and filling supported PDF form fields. It can produce an existing-layout output, but a scanned sheet does not automatically become an interactive form. Validate actual templates, pagination, font support, and long Spanish responses. [pdf-lib](https://github.com/Hopding/pdf-lib).

Repository entry points: `src/components/internal/WriteUps.tsx`, `src/lib/writeup-store.ts`, the internal forms page, and `public/internal/forms/`.

**Dashboard: a daily work queue**

Keep the cash summaries, but put outstanding work first: cash-outs awaiting review, unresolved differences, counts still open, deliveries outstanding, unpublished schedule changes, and follow-ups due. Every card should open the exact store/date/record. Show No data available distinctly from Nothing requires attention.

A shared device home screen could show Today, This week, and Continue unfinished work, with separate manager reports. Build dashboard statuses from each service's real records and completion state; avoid an unrelated checklist that staff must maintain twice.

Repository entry points: `src/components/internal/Dashboard.tsx` and `src/lib/dashboard.ts`.

The QR utility is currently separate from that navigation. Its Scan to Order codes point into an order prototype that saves orders in the browser rather than transmitting them to restaurant staff. Decide whether that prototype is active before printing customer-facing ordering codes. For internal use, shelf/item lookup and links opening the correct task are more immediately useful QR applications.

**Reusable code shortlist**

These are choices to evaluate against the selected feature, not a list to install all at once. Licenses below were checked in upstream project information during this research. Keep the required license notices and check the exact package/version adopted.

| Need | Existing project | License / boundary | Recommended use here |
| --- | --- | --- | --- |
| English/Spanish strings | [i18next](https://github.com/i18next/i18next) with React binding | MIT for i18next | Local dictionaries, translated errors/statuses; no translation SaaS needed |
| Consistent controls | [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT | Selectively reuse dialogs, selectors, tabs, and fields while preserving branding |
| Searchable review tables | [TanStack Table](https://github.com/TanStack/table) | MIT | Sales/hour previews and record lists; our own simple table UI |
| Digital forms | [SurveyJS Form Library](https://github.com/surveyjs/survey-library) | MIT runtime; proprietary companion products separate | Configured bilingual forms; evaluate against direct React forms |
| Alternative forms | [React JSON Schema Form](https://github.com/rjsf-team/react-jsonschema-form) | Apache-2.0 | An alternative, not an additional required form engine |
| Calendar display | [React Big Calendar](https://github.com/bigcalendar/react-big-calendar) | MIT | Optional calendar; preserve custom AM/PM board if clearer |
| Calendar display alternative | [FullCalendar](https://fullcalendar.io/pricing) | Standard MIT; resource/timeline Premium separate | Do not assume the staff timeline demo is free |
| PDF output | [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | Our own report/template output; template work remains |
| Browser draft storage | [Dexie](https://github.com/dexie/Dexie.js) | Apache-2.0 core; Dexie Cloud is separate | Structured local drafts; server sync/conflict handling remains our work |
| Camera barcode/QR reading | [ZXing browser](https://github.com/zxing-js/browser) | MIT browser library | Optional item lookup; always offer manual search |
| Constraint solver | [OR-Tools](https://github.com/google/or-tools) | Apache-2.0 | Later optimization experiment, not the first UI improvement |

Dexie is a wrapper around browser IndexedDB and has a documented React integration. It does not make our existing Worker endpoints synchronize automatically. Keep saved-to-device and saved-to-server states explicit, and handle conflicts without silently overwriting financial/count records. [React integration](https://dexie.org/docs/Tutorial/React).

**Whole open-source systems we could adopt**

| Project | What is already built | Fit and tradeoff |
| --- | --- | --- |
| [InvenTree](https://github.com/inventree/InvenTree) | MIT-licensed inventory system with stock/part tracking, REST API, extensibility, and a public demo | Worth examining if stock operations expand substantially. Its Python/Django backend is a separate application; restaurant units, terminology, and screens still need adaptation. |
| [ERPNext](https://github.com/frappe/erpnext) | GPL-3.0 ERP with inventory, procurement, accounting, and other modules | A complete operational system migration, rather than a component to paste into this Next.js site. |
| [Frappe HR](https://github.com/frappe/hrms) | GPL-3.0 HR application with leave, employee, attendance, and shift workflows | A useful reference or separate HR system; does not establish parity with our restaurant constraints or payroll process. |

InvenTree documents its deployment setup; Frappe HR documents a Python/JavaScript framework, managed hosting, and container-based setup. These are not drop-in components for the existing static frontend plus Worker. Given two stores and the existing custom rules, my recommendation is component reuse first. Full-system adoption remains an option if its ongoing administration is preferable to maintaining our app. [InvenTree setup](https://docs.inventree.org/en/stable/start/), [Frappe HR architecture/setup](https://github.com/frappe/hrms), [shift/leave documentation](https://docs.frappe.io/hr/shift-management).

Commercial screenshots, templates, and product source are not interchangeable with those open-source repositories. Study their documented interaction patterns and write our own implementation. The proposed baseline uses no paid calendar timeline, visual form builder, or new SaaS subscription. Development, hosting, and maintenance are separate costs.

**Implementation approach compatible with the planned Cloudflare move**

Keep the frontend and API boundary. Introduce shared store/date/task context, translations, and save-status controls without replacing all screens. Extract common workflow state while retaining domain-specific calculations and validators.

For the growing records, relational storage fits employees, assignments, requests, counts, orders, receipts, reviews, and follow-ups. Cloudflare D1 is a candidate for those records; R2 is a candidate for attachments and generated files. Preserve KV legacy links and existing data until a tested migration replaces each use. These are architecture recommendations, not a deployment performed by this research. [D1 overview](https://developers.cloudflare.com/d1/), [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [R2 overview](https://developers.cloudflare.com/r2/).

Suggested shared building blocks:

- Employee directory with stable IDs and optional Toast ID mapping.
- Store and station directory with an explicit working business date.
- Translation dictionaries and a language switch independent of the current task.
- Draft and save-state handling, namespaced by store/date/task, with recovery.
- Revision/change events and task-specific completion/review transitions.
- Attachment references, source-import fingerprints, and record links.
- Dashboard queries derived from actual unresolved work.

Suggested service-specific records:

| Service | Additions |
| --- | --- |
| Scheduler | Time-off requests, dated availability, published revisions, cross-station employee assignments |
| Cash-out | Close status, discrepancy notes/resolutions, actual deposit, review events |
| Inventory | Count sessions/lines, unit definitions, orders/lines, receipts/lines |
| Sales/hours | Import jobs, source metadata, row exceptions, employee mappings, reviewed exports |
| Forms | Drafts, submitted snapshots, attachments, amendments, follow-up actions |

A service worker/app installation may later improve opening the app during a network outage. That is separate from safely storing drafts and synchronizing them. A connection outage must not appear as successful server submission.

**Delivery order**

| Batch | Deliverable | Why it comes first |
| --- | --- | --- |
| 1 | English/Spanish shell, clear store/date context, shared save states, cash-out drafts/review, inventory progress | Immediate benefit on the shared device; establishes patterns other tools reuse |
| 2 | Sales/hours previews with useful errors; shared employee IDs; scheduler time off and publish comparison | Reduces export mistakes and makes staffing changes understandable |
| 3 | Purchase order and partial-receiving flow; form search/drafts/follow-ups; dashboard work queue | Completes processes currently ending after data entry |
| Later, based on use | Scanning, scheduled-vs-actual comparisons, multi-week optimization, personal notifications | Depends on reliable units, identities, records, or demonstrated staff demand |

**How to establish that it is usable**

Test with actual staff on the shared device in both languages. Suggested tasks: finish one cashier's close; find why it is short; resume yesterday's draft; count a section including zero and Enough; receive a partial order; enter a one-day absence; review a schedule change; fix a wrong upload; print a form; switch language midway without losing work.

Observe completion without coaching, wrong store/date selections, misread save states, recovery after a mistake, and the amount of unnecessary navigation. Establish timings from the current workflow before setting speed targets. Include a network failure and a second editor. A short pilot in one store should determine the final labels, layout, and rollout sequence.

No application behavior, production data, subscriptions, or deployments were changed for this report. Remaining business inputs are the actual cash-closing procedure, staff-preferred Spanish terms, item units/supplier conventions, highest-frequency forms, and any existing Toast API entitlement. They can be resolved feature by feature.
