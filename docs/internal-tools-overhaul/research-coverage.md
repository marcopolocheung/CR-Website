# Research-to-task coverage

The [supporting research](../internal-tools-research.md) remains the evidence source for commercial workflow references and free reuse/license boundaries. This matrix maps its recommendations to future tasks, preserved behavior, or explicit deferred scope. Ranges below are inclusive; each ID has its own file in the [tracker](tracker.md).

| Research outcome / capability | Task mapping | Boundary to preserve |
| --- | --- | --- |
| Working business date, shift rollover and store context | DEC-01, UX-02, IMPORT-04/05, SCH-01/05 | Device date alone is not policy; no invented overnight rules |
| Starting cash, adjustments, actual deposit and review | DEC-02, CASH-03–06 | Existing $100 float is current behavior, not proof of universal policy |
| Retention, archival, export, attachments and recovery | DEC-03, DATA-06–10, CASH-08, IMPORT-07 | Preserve raw sources/TTL lineage and acknowledge already expired data |
| Shared employee identity, memberships and hour targets | DEC-04, DATA-04, SCH-05/06, CASH-07, IMPORT-06/08, FORM-05 | Same name across stations does not establish identity |
| Units, pack sizes, supplier meanings, target stock | DEC-05, INV-03/05/06/08/09/10 | Keep unresolved mixed text; do not infer stock consumption |
| Next most useful digital form, review/signatures | DEC-06, FORM-06 | Staff frequency decides; printed signatures are separate from verified workflow |
| Spanish terminology, USD entry, dates, print language | DEC-07, UX-01/07, REL-05 | Local dictionaries and provisional labels can begin independently |
| Common navigation, instructions, dialogs/errors/empty states | UX-01–03, DASH-05 | Existing branding/routes and mounted bookkeeping panels remain |
| Keyboard sequence, tablet targets and tap alternative to drag | UX-04, SCH-07, CASH-02, INV-04, REL-05 | Fast repetitive entry; no page-per-denomination requirement |
| Labeled device drafts, handoff and save-state distinctions | UX-05, CASH-01, FORM-02, IMPORT-03 | Device copy is not server completion; tokens memory-only |
| Navigation protection, outage/retry, second-editor recovery | UX-06, DATA-05, FORM-02, REL-05/06 | No silent overwrite or false server-save state |
| Familiar separate print layouts and bilingual output | UX-07, CASH-08, FORM-03/07, SCH-08, INV-10 | Existing blank forms and workbook formats remain usable |
| Data/API boundary, D1 records, R2 attachments, fixtures | DATA-01–03/06 | Preserve existing API consumers and KV during staged migration |
| Shared mutations/history and explicit workflows | DATA-05, CASH-04/05, INV-01/06/07, FORM-04/05 | Atomic revisions differ from existing KV checks |
| KV export, transformation, staged cutover and restore | DATA-07–10, REL-03/07 | Account IDs/access verified; no data/resource changes in this package |
| Recurring availability versus dated time off/temporary change | SCH-01–03 | Suspension stays separate; managers can enter verbal requests |
| Publish comparison, snapshots, coverage changes | SCH-04 | Existing draft/live indicators and public visible-week behavior remain |
| Cross-station collisions and combined hour reporting | SCH-05/06 | Shared reviewed IDs first; optional targets only as approved |
| Week planning and tablet/day staff view in two languages | SCH-07 | Existing custom AM/PM board may remain; no required calendar replacement |
| Generation, validator, copy, locks, undo, visibility, hours, print, staff filters, old links | SCH-08 | Explicit regression capability inventory, not newly invented features |
| Store/date-specific cash-out draft restoration | CASH-01 | Safely identify the old unscoped draft instead of assigning a guessed date |
| Guided denomination/cashier entry and counted-versus-untouched | CASH-02, CASH-07 | Existing cents calculations and paper output |
| Server authoritative totals, close/review/corrections, actual deposits | CASH-03–06 | Distinct expected/actual, null/zero, draft/submitted/reviewed |
| Cash history/filter/export/recovery | CASH-08 | Legacy 30-day view and expired-data limitations remain explained |
| Count session states, progress, Remaining/Search | INV-01/02 | Uncounted, zero, Enough, skipped and complete are distinct |
| Tablet shelf-order count entry | INV-04 | Shared computer keeps fast table; manual mixed-unit entry retained |
| Store-specific catalogs and counts | INV-05 | No guessed CR2 catalog or cross-store draft leakage |
| Persisted supplier orders, issued snapshots | INV-06 | Manual order overrides, grouping, copying and printing retained |
| Partial receiving, discrepancies and outstanding-order suggestions | INV-07/08 | Generated shopping list alone is not an issued/received order |
| Waste/transfers and historical catalog context | INV-09/10 | No inferred consumption; issued/count-time snapshots remain readable |
| File validation, remedies and three labeled sales slots | IMPORT-01 | Manual CSV/XLSX baseline, filenames/Replace rather than required batch auto-detection |
| Sales extraction preview, reconciliation, current Excel layout | IMPORT-02/04 | Keep source evidence and exact cash-out/store/date context |
| Preserve uploads/results, repeat download, Start next report | IMPORT-03 | Explicit reset rather than clearing after successful conversion |
| Hours row/date/punch review, employee mappings, unmatched exceptions | IMPORT-05/06 | Source regular/overtime distinct; no replacement payroll calculation engine |
| Fingerprints, duplicate handling, versioned import history | IMPORT-07 | Filename is not identity; retention of raw source is policy-bound |
| Scheduled versus actual hours | IMPORT-08 | Later priority P2 baseline work after identities/imports; not a payroll correction |
| Search forms by employee/date/type, draft protection, simple entry | FORM-01–03 | Original employee narratives and immutable saved forms retained |
| Attachments, amendments, assignment/follow-up/resolution | FORM-04/05 | Append-only corrections; parent-access checks and real record status |
| Selected next digital form | FORM-06 | Scope determined by DEC-06; free runtime/direct React both possible |
| Existing blank catalog, saved write-up and label compatibility | FORM-07 | All eleven formats/download links and original signatures remain |
| Work queue, exact-record links, incomplete/missing/failed/empty distinctions | DASH-01–05 | Retain cash reports; derive service statuses rather than a duplicate checklist |
| CI coverage, Worker build mirror, staged deployment and frontend release | REL-01–04 | Frontend deploy does not deploy Worker; placeholder KV ID never used |
| Staff baseline, bilingual shared-device tests, pilot, handoff and restore | REL-05–07 | Observe actual staff and retest defects; build success is not acceptance |
| Free selective components, local dictionaries, existing ExcelJS/Papa Parse | UX-01/03/05, IMPORT-01/02/05, FORM-03/06, SCH-07 | Research shortlist is optional; exact adopted license/version/notice checked by implementing owner |
| Whole-system replacements (InvenTree/ERPNext/Frappe HR) | Existing custom-application/component baseline preserved in DATA-01 and README | Evaluated alternatives are outside approved implementation scope; a full system replacement needs a separate explicit decision/task package |
| Authentication redesign | LATER-01 | Existing access boundaries preserved; no baseline dependency |
| Frontend hosting migration | LATER-02 | Existing static publication stays; backend data work independent |
| Optional Toast API and reliable batch detection | LATER-03 for API; IMPORT-01/02 may add unambiguous file detection | No entitlement assumption or automatic import promise; ambiguous files need a choice |
| Barcode/USB scanner/camera and shelf QR | LATER-04 | Manual search baseline; dependable item/unit mapping first |
| Personal calendars and notifications | LATER-05 | No employee personal-phone requirement for manager-entered requests |
| Multi-week fairness and alternative scheduling solver | LATER-06 | Current browser solver and independent validator retained |
| Ordering/customer QR prototype disposition | LATER-07 | Current browser-only storage explicitly documented before any customer-facing claims |
| Service-worker/app installation for offline opening | Explicitly outside baseline UX-05/06 in bilingual UX reference | Safe local drafts/retry remain required; offline launch needs a separately approved scope after demonstrated demand |

## Inventory checksum

| Parent | Expected briefs | IDs |
| --- | --- | --- |
| Business decisions | 7 | DEC-01–07 |
| Shared experience | 7 | UX-01–07 |
| Data/platform | 10 | DATA-01–10 |
| Scheduler | 8 | SCH-01–08 |
| Cash-out | 8 | CASH-01–08 |
| Inventory | 10 | INV-01–10 |
| Sales/hours | 8 | IMPORT-01–08 |
| Forms | 7 | FORM-01–07 |
| Dashboard | 5 | DASH-01–05 |
| Release/acceptance | 7 | REL-01–07 |
| Deferred | 7 | LATER-01–07 |
| Total | 84 | No task implementation is completed by documentation authoring |
