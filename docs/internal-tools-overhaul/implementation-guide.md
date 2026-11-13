# Internal-tools overhaul: one verified step at a time

Written November 10, 2026. This is the execution sequence for the [UX overhaul report](../investigations/internal-tools-ux-2026-11-10.md), using the approved [Night shift design bank](../design/internal-language/README.md).

**Design selected:** Night shift, Layered paper, Patina teal, shared outline icons, plain task labels and the moving red navigation highlight. The bank is preserved now. The application steps below have **not** been implemented or verified by writing this guide.

## How to use this guide

Work on one numbered step per review unit. Finish its local checks, demonstrate the result and record the checkpoint before moving to the next step. If a step becomes too large, split it into small named substeps; preserve its acceptance criteria rather than quietly reducing the goal.

The default sequence is 01 → 19. Each step has three independent gates:

1. **Local correctness:** the relevant behavior and domain checks pass against synthetic/local data.
2. **Visual/task review:** review the actual changed screens and scenarios, not just a green test result. For this staged workflow, hand the step back for review before continuing to the next requested step.
3. **Release readiness:** any backend capability, migration, binding, policy or deployment needed by that slice is verified separately. Local completion does not claim that the feature is live.

When a backend dependency is not activated, a compatible local implementation may still be reviewed. Keep its unsupported production actions unavailable and identify the missing release gate. Independent later work can be requested without pretending that the blocked feature shipped. Do not make all UI work wait for an unrelated infrastructure migration.

This guide requests no automatic implementation, deployment or migration. It is the plan to use when a specific step is requested.

### Copyable instruction for a future session

```text
Implement Step NN from docs/internal-tools-overhaul/implementation-guide.md only.
Use docs/design/internal-language/guidelines.md and its approved examples.
Recheck current main and the preceding checkpoint before editing.
Preserve existing business rules, data, drafts and shared links.
Complete the step's local checks and show its review scenarios.
Record actual results with checkpoint-template.md, including anything unverified.
Stop after this step for review; do not begin the next step or deploy automatically.
```

Replace `NN` with the next step. Ask for a named substep if that is the intended scope. Use the [checkpoint template](checkpoint-template.md) for each handoff; create a `checkpoints/step-NN.md` record when that step is performed. Keep implementation, local checks, owner review and release evidence separate.

## Baseline and existing work

The source reference for this plan is freshly fetched `origin/main` at **`64ffc15c013c8e1cd9ca33e8d46efc5afccb2ec3`**. The owner's current checkout was still `ca114a9` when the guide was written. Recheck main before execution; do not replace uncommitted design/research work while updating a checkout. Integrate the bank and planning files into the implementation branch before using an isolated checkout that would otherwise omit them.

Current main already contains context-bound cash/form drafts, recovery controls, bilingual infrastructure, validated sales/hours previews, retained-import code, employee mapping, time-off/request code, digital saved forms and an optional scheduling assistant. It also has denomination **Count and Amount** entry, **Extra money**, direct staff-schedule links and both-employee swap/publish qualification validation. Reuse and improve these; do not rebuild them from old “missing features” lists.

Backend activation is not established by source presence. Some historical task docs describe older schemas or statuses. The [existing tracker](tracker.md) and task briefs remain the detailed contract/evidence records; this guide sequences the new experience work. Reconcile affected briefs during the actual step. Writing this guide does not change their statuses or retroactively verify them.

### Progress board

| Step | Reviewable outcome | Current status |
| --- | --- | --- |
| 00 | Approved design bank, examples and written rules preserved | Complete for this documentation work |
| 01 | Verified source/runtime baseline and task fixtures | Reviewed and merged ([PR #174](https://github.com/marcopolocheung/CR-Website/pull/174); [checkpoint](checkpoints/step-01.md)) |
| 02 | Shared visual primitives and icon family | Reviewed and merged ([PR #175](https://github.com/marcopolocheung/CR-Website/pull/175); [checkpoint](checkpoints/step-02.md)) |
| 03 | Internal navigation and shell | Reviewed and merged ([PR #176](https://github.com/marcopolocheung/CR-Website/pull/176); [checkpoint](checkpoints/step-03.md)) |
| 04 | Shared context, access lifecycle and draft-safe navigation | Reviewed and merged ([PR #177](https://github.com/marcopolocheung/CR-Website/pull/177); [checkpoint](checkpoints/step-04.md)) |
| 05 | Task-oriented Home and separate Reports destination | [Locally verified; owner review pending](checkpoints/step-05.md) |
| 06 | Focused cash entry | Not started |
| 07 | Saved cash lookup and clear save/history behavior | Not started |
| 08 | Staged sales import | Not started |
| 09 | Staged hours import and identity review | Not started |
| 10 | Shared import history and readable comparison reports | Not started |
| 11 | Inventory counting and explicit progress | Not started |
| 12 | Order checklist, catalog and count-history separation | Not started |
| 13 | Forms library and sectioned editors | Not started |
| 14 | Unified manager scheduling workspace | Not started |
| 15 | Review against the schedule staff actually see | Not started |
| 16 | Focused published staff schedule | Not started |
| 17 | Real resume/attention/recent-work signals on Home | Not started |
| 18 | Utility cleanup and optional practice | Not started |
| 19 | Staff evaluation, selected release and live verification | Not started |

“Not started” means the **new overhaul step** is not delivered; it does not deny the existing capabilities listed above. Only update a row after recording what actually passed. Optional practice may be explicitly deferred; the QR prototype's destination/promise still needs an explicit disposition.

## 01. Establish the implementation baseline

**Change:** create a dated baseline record for the current source, available API capabilities, synthetic fixtures and critical routes. Preserve the approved bank unchanged. Capture the current empty, populated and interrupted states before rewriting them.

**Verify:**

- Identify the actual commit, frontend API override, Worker mode and optional assistant configuration. Separate source-only capability from activated service.
- Run the existing relevant domain suites; record pre-existing failures rather than carrying an unexplained red baseline into later steps. Complete type/build/SEO checks as appropriate to the implementation baseline.
- Confirm local browser work cannot fall back to production endpoints. Prepare fixtures for CR2/CR3, blank versus zero, changed drafts, failures and partial data.
- Record compatibility entry points: `/internal/**`, Bookkeeping hashes, `/scheduler-demo` station links, public `/schedule` links and existing encrypted links.

**Review gate:** a short capability table, representative baseline screenshots and exact command results. No redesign yet.

**Boundary / rollback:** no production writes, migrations or data deletion. Remove only newly created disposable fixtures when reverting. Existing drafts remain intact.

## 02. Build the shared design primitives

**Change:** introduce reusable tokens, fonts, icons, buttons, fields, paper panels, save states and the navigation-highlight behavior in application code. Start from the existing Feedback/EntryWorkspace/scheduler primitives; proposed file placement is a small shared internal UI module, not a second independent design system.

**Verify:**

- Compare a local component gallery with the approved desktop, phone, error and navigation examples.
- Confirm the correct public red, Patina light/dark roles, square paper framing and a clear hierarchy between active and supporting panels.
- Exercise disabled/busy, field error, focus, keyboard, long Spanish labels, reduced motion and rapid navigation hover changes.
- Ensure the red navigation surface moves without navigating, restores selection and stays aligned after reflow. Preserve labels and current-selection semantics.

**Review gate:** the shared component gallery passes the [bank checklist](../design/internal-language/guidelines.md#10-review-checklist) at narrow and wide widths. No whole-app restyle in this step.

**Checks:** type/build checks; meaningful interaction verification for shared controls. Pixel appearance alone does not need implementation-mirroring unit tests.

**Boundary / rollback:** no domain formulas, schemas or access changes. Revert the new primitives without touching saved records. Related briefs: [UX-01](tasks/UX-01.md), [UX-03](tasks/UX-03.md), [UX-04](tasks/UX-04.md).

## 03. Add the internal shell and navigation

**Change:** wrap `/internal` tools in the shared header/rail, with Dashboard, Cash, Inventory, Schedule, Reports and Forms destinations. Replace the warning banner's visual prominence with quiet product identity. Keep language, help and lock positions consistent. Display the current task's context; do not introduce a global selector that silently changes an open record.

**Verify:** every tool has a way home; active navigation is correct; direct links and old Bookkeeping hashes still land correctly; the phone layout reflows; the shell disappears in print. Keep `/scheduler-demo` reachable through its existing adapter until Step 14 integrates its different route group.

**Review gate:** navigate every internal destination with mouse and keyboard. No blank destination, misleading store label or lost mounted input.

**Checks:** type/build/SEO, relevant language/navigation browser scenarios. **Rollback:** revert the shell adapter while preserving original routes and tool state. Related brief: [UX-02](tasks/UX-02.md).

## 04. Connect context, access and draft-safe navigation

**Change:** consolidate manager access in the internal in-memory session and connect shell controls to existing task context/draft protection. Make changing store, date or draft an explicit transition. Preserve scheduler-specific staff-edit permissions; do not accidentally grant them through a shared visual shell.

**Verify:** start a cash/form draft, switch tools and return; cancel a context change; lock/unlock; expire authorization during a save; fail device storage; switch language mid-entry. No token goes into localStorage/sessionStorage, and a remembered preparer label is not treated as identity verification.

**Review gate:** entered values, exact store/date and recovery remain correct through every scenario. API authorization still applies independently of the visible shell.

**Checks:** recovery, drafts, contracts/i18n suites and the relevant draft/context/language browser scripts. **Rollback:** retain old draft readers/keys and access adapters until the new paths are proven; do not clear storage to simplify migration. Related briefs: [UX-05](tasks/UX-05.md), [UX-06](tasks/UX-06.md), [UX-07](tasks/UX-07.md).

## 05. Separate Home from Reports

**Change:** make Home a clear task launcher with only supported resume/recent information. Put cash trends and the report/import entry points under Reports. Cash becomes directly discoverable instead of requiring knowledge of Bookkeeping. Retain existing deep links.

**Verify:** a new workspace shows usable start actions, not empty charts, $0 success implications or an invented overdue pile. A failed history fetch is not “nothing to do.” Existing report values remain reachable and unchanged.

**Review gate:** from a blank Home, a reviewer can identify Cash, Inventory, Schedule, Reports and Forms without reading explanatory paragraphs. Full cross-tool signals wait until Step 17.

**Checks:** dashboard/cash suites, direct-link checks, type/build/SEO. **Rollback:** retain compatibility routes and the existing cash-report component. Related briefs: [DASH-01](tasks/DASH-01.md), [DASH-02](tasks/DASH-02.md).

## 06. Make cash entry the complete exemplar

**Change:** implement the focused drawer workspace, AM/PM drawer selector, consistent summary and reachable Save action. Reduce setup/draft/help clutter; put print, clear and manual exports in named secondary controls. Make Count/Amount alternatives clear while retaining the current synchronized data model and full-denomination workflow.

**Verify with independent expected values:**

- A $300 drawer retains $100 and gives $200 turn-in. Two such drawers give $400, not $500. A $50 drawer preserves −$50 turn-in.
- Blank Toast/Z yields an unavailable comparison; entered zero remains a real value. Blank denomination status differs from explicit zero. Invalid counts/amounts remain correctable.
- Count and Amount stay synchronized; denomination amounts must be exact multiples. Extra money adds to the day total/Z comparison and does not rewrite cashier/shift Toast comparisons.
- Test all denominations, multiple drawers/shifts, keyboard order, tablet keypad, reload/resume, language, late responses, failed storage and printing. The two-line design specimen is not sufficient coverage.

**Review gate:** complete one real-shaped cash task in English and Spanish on desktop and a touch device. Verify the actual input and summary with the software keyboard open. Review before copying this workspace pattern into other tools.

**Checks:** `cashout:test`, recovery/draft tests, cash entry/context, entry-workspace and feedback browser checks, type/build/SEO. **Rollback:** retain serialized sheet compatibility, existing calculations and draft recovery. No mandatory cash approval/recount process is added. Related briefs: [CASH-01](tasks/CASH-01.md), [CASH-02](tasks/CASH-02.md), [CASH-03](tasks/CASH-03.md), approved [cash notebook rules](cashout-rules.md), plus current-main Extra money addition.

## 07. Improve saved cash lookup and save semantics

**Change:** separate saved-day lookup from entry, add meaningful context/filters and exact-record links, and make replacement/retry outcomes explicit. Keep the existing service's limitations visible. Do not describe the current 30-day lookup/31-day expiry as dependable long-term history.

**Verify:** load a specified CR2/CR3 day, retain/cancel an unsaved draft, save and reload the acknowledged record, retry an uncertain save without losing entered values, and display a failed fetch distinctly from an empty history. Confirm print/output parity.

**Review gate:** a reviewer can find the intended historical day and explain where the current draft and saved record exist. The UI cannot promise revisions or conflict protection the selected adapter lacks.

**Feature extension 07b:** long-lived notebook history and reliable revisions require the backend capability/retention gate below. Implement and verify that as a named substep when its prerequisites are available; keep its release evidence separate. UI lookup can be reviewed first without claiming 07b is complete.

**Checks:** cash/dashboard, recovery and data suites as touched; saved-day/conflict scenarios. **Rollback:** additive record/read compatibility; preserve accepted server versions and local drafts. Related brief: [CASH-08](tasks/CASH-08.md); record/history gate [DATA-05](tasks/DATA-05.md), retention decision [DEC-03](tasks/DEC-03.md).

## 08. Stage the daily sales import

**Change:** organize Files → Review → Report with preserved inputs. Derive redundant context, lead review with totals and actionable mismatches, and reveal raw cells/provenance per figure. Reuse current validation/context/reconciliation code; do not create another parser just for the new screen.

**Verify:** correct three-file import, incorrect type/structure, wrong store/date, unknown context, an unmapped payment/category, manual cash fields and same-day saved-cash fill. Edit a prior stage without losing files. Compare produced workbook values and cell mapping with independent expected output.

**Review gate:** a reviewer finds and resolves a mismatch without scanning every raw source row. No uncertainty or required acknowledgement is hidden behind a green summary. Output changes require a deliberate business-contract change; staging alone should preserve it.

**Checks:** `imports:test`, sales validation/review/context/retention browser scenarios, shared draft/recovery checks, type/build/SEO. **Rollback:** retain source snapshots and compatible workbook generation. Related briefs: [IMPORT-01](tasks/IMPORT-01.md), [IMPORT-02](tasks/IMPORT-02.md), [IMPORT-04](tasks/IMPORT-04.md).

## 09. Stage employee hours and identity review

**Change:** use the same staged workspace, with employee totals and a direct queue of unmatched people/excluded rows. Make the employee summary primary and the full source table secondary. Reuse current mapping and source-hours policy.

**Verify:** a range boundary, open punch/questionable row, missing ID, duplicate-looking names, unmatched employee, an existing approved mapping and a failed mapping/history fetch. Every included or excluded source row remains accounted for; source overtime is not silently recalculated to simplify the UI.

**Review gate:** a reviewer can explain who is included, what is excluded, what needs matching and what the output contains. A failed directory read cannot become an empty/complete employee list.

**Checks:** `imports:test`, hours-preview/mapping/validation browser checks; Worker import-directory tests if contracts change. **Rollback:** retain raw source identity, existing mappings and output compatibility. Related briefs: [IMPORT-05](tasks/IMPORT-05.md), [IMPORT-06](tasks/IMPORT-06.md), [DATA-04-IMPORT](tasks/DATA-04-IMPORT.md).

## 10. Unify retained imports and comparison reports

**Change:** add a readable shared history view with store/period/preparer and explicit output/save states. Move fingerprints, parser versions and JSON export to Details. Present scheduled-vs-actual as employee/store summaries with coverage and exceptions, keeping evidence reachable.

**Verify:** download succeeds but shared saving fails; retry does not create another import; exact duplicate/reprocess handling; source/mapping/publication changes; resume an existing record; incomplete two-store coverage; unmatched rows and missing publication. Use only actual activated service capabilities.

**Review gate:** users can distinguish a downloaded workbook, device snapshot and shared retained record. Totals and denominators match the selected sources. A JSON audit export remains available without dominating the main workflow.

**Checks:** `imports:test`, `imports:worker:test`, history/retention/comparison browser scenarios and output checks. **Rollback:** preserve old retained snapshots/identities and independent output download. Related briefs: [IMPORT-07](tasks/IMPORT-07.md), [IMPORT-08](tasks/IMPORT-08.md), [SCH-06-IMPORT](tasks/SCH-06-IMPORT.md).

## 11. Make inventory counting explicit

**Change:** introduce an area/shelf-oriented count workspace, generous On hand rows, Search/Remaining/Needs ordering and a stable progress summary. Move past-date pairs out of routine entry. Preserve free text/fractions and Enough where used.

**Verify:** measured quantity, zero, untouched, Enough and deliberately skipped are distinguishable. Progress reflects those actual states; an unknown unit is not guessed from a name. Count one area, leave/resume, switch context explicitly, save and reload. Historical/catalog identity is preserved.

**Review gate:** a reviewer can find the remaining items and complete a count without learning INV/SUP/Use abbreviations from a long paragraph. Define what “complete” means before showing it. Durable line/session states require the backend gate below; do not infer them from the existence of a generic saved count.

**Checks:** inventory helper tests in `cashout:test`, recovery/data tests as touched, explicit count-state/browser scenarios. **Rollback:** preserve original count values and stable item IDs; support existing readers during additive state rollout. Related briefs: [INV-01](tasks/INV-01.md), [INV-02](tasks/INV-02.md), [INV-03](tasks/INV-03.md), [INV-10](tasks/INV-10.md).

## 12. Separate ordering, catalog editing and inventory history

**Change:** give the supplier order checklist, catalog and past-count comparison their own views. Use confirmed units/pack/target labels. Keep suggestions and manual overrides clear; preserve the existing copy/print workflow.

**Verify:** supplier grouping, an overridden suggestion, Enough versus a number, a saved checklist, a catalog revision conflict, rename/reorder/removal and an old count after the catalog changes. Renaming must not rewrite the meaning of a historical record.

**Review gate:** count entry is calm; configuration is reachable; the order list says whether it is a checklist or a persisted order. No claim that a vendor received an order merely because a box was checked.

**Feature extension 12b:** persisted orders, partial receiving and outstanding-order-aware suggestions are a separate connected loop, delivered in that order after supplier/unit/session contracts are dependable. They remain visible work, not a hidden definition of checklist completion.

**Checks:** inventory/recovery/data suites and historical snapshot scenarios. **Rollback:** additive snapshots and old-list/count compatibility. Related briefs: [INV-05](tasks/INV-05.md), [INV-06](tasks/INV-06.md), [INV-07](tasks/INV-07.md), [INV-08](tasks/INV-08.md), unit decision [DEC-05](tasks/DEC-05.md).

## 13. Simplify the forms library and editors

**Change:** default to saved forms, with one New form action and a short purpose-based chooser. Move blank downloads into their own view. Use sectioned editors and check-answers review; extend translation coverage through fields, errors and confirmations.

**Verify:** existing write-up plus customer complaint, injury report, payroll change and pay increase; optional/required sections; long narratives and names; drafts/reload; permanent-copy warning; label change; deletion confirmation and list refresh; blank downloads and printed pagination.

**Review gate:** existing documents still open and print; all required content remains. Changing a visible label is not permission to alter a declaration or historical form. No attachment/amendment/follow-up service is implied by a screen-only control.

**Checks:** `forms:test`, forms-list/drafts/compatibility/digital browser checks, shared recovery/language and print checks. **Rollback:** keep original record readers/types and immutable originals. Related briefs: [FORM-01](tasks/FORM-01.md), [FORM-02](tasks/FORM-02.md), [FORM-03](tasks/FORM-03.md), [FORM-07](tasks/FORM-07.md).

## 14. Unify manager scheduling

**Change:** bring manager scheduling into the same visual/context/access shell while preserving `/scheduler-demo` links. Evolve the existing new layout: board plus contextual shift/fix panel, obvious copy/build, Staff & rules and a quieter request view. Consolidate the Classic choice only after checking functional parity.

**Verify:** all four stations, special crew-edit permission, week switching with drafts, generation, manual assignment, both sides of a swap, locks/Keep, undo, recurring availability, time off, warnings, required/optional spots, printing and staff-view links. The assistant stays optional; applying a proposal changes the draft and never auto-publishes.

**Review gate:** a manager can copy/build and fix a week without entering staff configuration unnecessarily. Current qualification validation is retained. Preserve coverage when replacing obsolete Classic-layout test assertions; do not delete tests merely to get green.

**Checks:** `scheduler:test`, `scheduler:requests:test`, Worker request tests when touched, `agent:test` for assistant integration, scheduler/request/agent browser scenarios. **Rollback:** preserve station IDs, assignments, links, drafts and publish records. Related briefs: [SCH-03](tasks/SCH-03.md), [SCH-07](tasks/SCH-07.md), [SCH-08](tasks/SCH-08.md).

## 15. Review what will change for staff

**Change:** make publication review compare the proposed week with the version staff currently see: employee, day, previous shift, new shift and newly uncovered required positions. Keep publication state and hidden visibility distinct.

**Verify:** first publish, no changes, edited week, hidden week, stale server revision, requests/rules changed during review, invalid assignment and an optional assistant proposal. A local “changes since generation” list is not the published baseline. Do not assume the existing payroll publication projection supplies full historical comparison.

**Review gate:** the reviewer can predict exactly what staff will see after Publish. A conflict retains the draft and requires review of the newer baseline. Accurate persisted comparisons/history need the publication backend gate below.

**Checks:** scheduler, share/store, Worker/data and request suites as touched; explicit old/new and conflict scenarios. **Rollback:** preserve published snapshots and public reader compatibility; a code revert cannot undo a publish that already succeeded. Related brief: [SCH-04](tasks/SCH-04.md).

## 16. Focus the published staff schedule

**Change:** provide a light staff shell, This week/My shifts, a clear next shift when a person is selected, mobile day list and readable desktop/print output. Keep manager controls out of this view.

**Verify:** all stations; visible/hidden/unpublished weeks; selected person; no shifts versus no data; long names; changed publication; phone and paper output. A previous person's filter on a shared device must not masquerade as identification of the next worker.

**Review gate:** a staff reviewer finds the right next shift and can tell a real day off from a missing publication. Old public/encrypted links keep their intended behavior and access boundary.

**Checks:** scheduler/share/store/visibility suites, staff-view browser scenarios, build/SEO noindex/basePath checks. **Rollback:** retain the public viewer route/data adapter. Related brief: [SCH-08](tasks/SCH-08.md).

## 17. Add real cross-tool work signals to Home

**Change:** populate Resume, Needs attention and Recent records from the real services established in prior steps. Each row names its store/station/date, record/draft, progress and exact destination. Show device-only versus shared work explicitly.

**Verify:** partial-service failure, stale data, multiple stores, several drafts, no records, a calendar day with no configured cadence, explicit count progress and an unpublished schedule. Test each link into the exact task/field. A missing row or failed fetch cannot become “all done.”

Cash reporting must distinguish calculated turn-in, Extra money, recorded shortages/overages and available comparisons. Match average denominators to coverage and do not compare unsupported prior periods. Do not turn net zero into proof that there were no offsetting discrepancies.

**Review gate:** every signal is explainable from a source record. Nothing is marked overdue without a real cadence/business-date rule. Users can resume a task without reselecting its context manually.

**Checks:** dashboard/domain suites, summary adapters and exact-link/partial-error browser scenarios. **Rollback:** retain the simple launcher from Step 05 if a summary source is unavailable. Related briefs: [DASH-01](tasks/DASH-01.md), [DASH-03](tasks/DASH-03.md), [DASH-04](tasks/DASH-04.md), [DASH-05](tasks/DASH-05.md).

## 18. Resolve utilities and optional practice

**Change:** place QR generation in a named utility view and make the encoded destination/promise explicit. Add optional practice examples only if wanted after the routine workflows are clear.

**Verify:** scan one sample code and confirm its actual destination. The current ordering submit path stores/logs locally; a printed code must not imply that the restaurant receives an order. Practice uses synthetic records, a visible Practice label and no production save/publish path.

**Review gate:** an operator knows what a QR code does. A person can skip/exit/reopen practice without losing real work. No mandatory greeting tour, points/streaks or delay between routine actions.

**Checks:** URL/basePath/print checks; practice-to-live boundary if practice is implemented. **Rollback:** remove the new utility/practice entry without changing records. Related scope: [LATER-07](tasks/LATER-07.md); scanning/notifications/operational ordering remain separate decisions.

## 19. Evaluate, release a selected slice and verify live

**Change:** evaluate the completed flows with representative English/Spanish staff, fix the observed problems in small follow-ups, then release an explicitly selected compatible slice.

**Verify:** use the task protocol in [report section 13](../investigations/internal-tools-ux-2026-11-10.md#13-how-we-will-know-it-works). Observe next-action discovery, task correctness, elapsed time, help requests, save-scope understanding, phone keyboard behavior and print. Record actual outcomes rather than treating proposed improvement percentages as achieved.

Before release, list the exact frontend commit/artifact, backend versions/capabilities, bindings/migrations, approved policies, compatibility readers and rollback artifacts. The [current Pages workflow](../../.github/workflows/deploy.yml) publishes frontend output on main; it does not activate the separate Worker. A merge can therefore publish frontend code automatically—review release readiness before merging.

**Release gate:** required local checks and staff review pass, dependent services are activated, rollback is rehearsed, and the selected deployment is explicitly authorized. After release, verify routes, read/save/reload, context, English/Spanish, public schedules and print against that actual version. Use authorized synthetic/test records rather than modifying unrelated staff/financial records.

**Rollback:** restore a compatible frontend/backend version and reconcile any accepted writes; preserve drafts, snapshots and migration lineage. Never drop tables or erase history as a UI rollback.

Related briefs: [REL-02](tasks/REL-02.md), [REL-03](tasks/REL-03.md), [REL-04](tasks/REL-04.md), [REL-05](tasks/REL-05.md), [REL-06](tasks/REL-06.md), [REL-07](tasks/REL-07.md).

## Backend and policy checkpoints

These are feature dependencies, not a reason to turn every visual step into a platform rewrite. Before enabling one, inspect the current implementation and reconcile the relevant legacy brief.

| Capability | Needed for | Evidence before treating it as available |
| --- | --- | --- |
| Durable record revisions and approved retention | Step 07b, shared history/recovery | Atomic retry/conflict tests, compatible reads, retention decision, migration/restore rehearsal, actual activated endpoint |
| Count session/line states and catalog snapshots | Steps 11–12 | Zero/Enough/skipped/unknown semantics, stable IDs, old-count preservation, active read/write contract |
| Supplier order/receipt lifecycle | Step 12b | Confirmed units/packs/suppliers, issued snapshots, partial receipt reconciliation, outstanding quantities and duplicate prevention |
| Published schedule baseline/revisions | Step 15 | Reviewed current-vs-proposed comparison, stale-revision protection, compatible public reader, actual saved baseline |
| Existing directory/import/request services | Steps 09–10 and 14 | Source contracts plus local checks **and** environment capability evidence; a checked-in migration is not activation |

Keep cash within the approved notebook scope: fixed $100 per drawer; Count/Amount; Extra money; calculated comparisons and saved lookup. Cash approvals, physical-deposit workflow and mandatory discrepancy explanations remain deferred. Do not implement them to satisfy an obsolete schema.

Cross-station employee conflict detection, advanced fairness/optimization, attachments/amendments/follow-up, supplier communication, waste/transfers, scanning and personal notifications remain later feature slices with their existing identity/unit/policy dependencies. Retain them in the backlog; they are not secretly required to approve the shared UI foundation.

## Verification commands and evidence

Use locked dependencies and a local API override for UI checks. Do not run migration/seed/verify scripts against their default production endpoint as a routine test. Identify a script's prerequisites, loopback API expectation and arguments before running it; the Python browser scripts require their documented Playwright/PDF dependencies, which are not supplied by `npm ci` alone.

Example frontend start for synthetic local checks:

```sh
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- \
  --webpack --hostname 127.0.0.1 --port 3027
```

Use mock responses for isolated scenarios or the explicit local Worker configuration for integration. Some browser checks require a real local Worker/credentials rather than mocks; follow each script's header and the current contract. Reserve/apply migrations only within the intended local or authorized target environment. Never copy simulation resource IDs into a deployment.

| Changed area | Existing command families / browser evidence |
| --- | --- |
| UI/route integration | `npm exec tsc -- --noEmit`; `npm run build`; then `npm run seo:check` |
| Cash and reporting math | `npm run cashout:test`; `scripts/test-cashout-entry.py`, `test-cashout-context.py`, `test-entry-workspace.py` |
| Shared draft/recovery/language | `npm run recovery:test`; Node/jiti drafts/contracts/i18n tests; `scripts/test-internal-drafts.py`, `test-internal-recovery.py`, `test-internal-language.py`, `test-internal-feedback.py` |
| Imports and identities | `npm run imports:test`; `npm run imports:worker:test` when Worker paths change; validation/review/hours/mapping/history/retention/comparison browser scripts |
| Forms | `npm run forms:test`; forms-list/drafts/compat/digital browser scripts |
| Scheduling | `npm run scheduler:test`; `npm run scheduler:requests:test`; `npm run scheduler:requests:worker:test`; `npm run agent:test` when assistant paths change; scheduler/request/agent browser scripts |
| Data/Worker | `npm run data:test`; relevant Worker/domain tests; `npm run worker:build` with review of the generated mirror; explicit local schema/config checks |

For example, against the configured local frontend, cash entry takes `python3 scripts/test-cashout-entry.py http://127.0.0.1:3027`; the scheduler suite takes `python3 scripts/test-scheduler-views.py --url http://127.0.0.1:3027`. These are commands for future implementation verification, **not test results from this documentation task**.

The current CI includes type checking, agent/scheduler tests, build and SEO. A green CI result does not automatically cover every cash/import/form/browser scenario; record the checks relevant to the step. Run appropriate checks once after the final change, and repeat/broaden only when another change, failure or uncovered risk warrants it.

### Minimum checkpoint evidence

Record the source SHA/diff, expected and observed behavior, exact commands with results, fixture identity, screenshots of changed states, keyboard/touch/language/print coverage where relevant, and any unverified dependency. For service changes add failed/retried/conflicting writes and persisted reload; for UI-only work state that no service capability changed.

Useful common review widths are 375px, 768px and 1440px, plus 320px-equivalent reflow/enlarged text for affected layouts. A screenshot with no software keyboard is not native keyboard evidence. A local save mock is not a live save. A visually matching panel is not a passed calculation test.

If a gate fails, keep the step open, preserve the failing example and repair that slice. Do not compensate by adding unrelated features, skipping the check or declaring the next step complete.

## Documentation checkpoint — November 10, 2026

This planning update checked 192 local links and four Markdown anchors across 12 bank/planning/reference documents, all 15 approved-baseline file hashes, and all four font-provenance hashes. The four specimen source files still match their prior browser-verification digests. All 19 steps have verification scenarios, review/release gates and rollback guidance; all application steps remain Not started. The updated project design skill passes its skill validator, and authored text passes the Git whitespace check. Upstream font-license files retain their original bytes, including upstream trailing whitespace.

These are documentation/preservation results. No application build, new browser run, staff evaluation or release was performed for this update.
