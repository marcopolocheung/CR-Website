# Internal-tools overhaul handoff — 2026-10-24

The requested final in-progress IMPORT-01 PR is open and ready for review as #140. Work stops here per the user’s instruction; no next task or agent has been started. This handoff records the current local implementation and the recommended continuation; it does not mark the overall overhaul complete. Work is isolated in `/home/wslunusn/CR-Website-overhaul`, branch `feat/overhaul-import-01`. The IMPORT-01 implementation commit is `40e4a00`; this handoff is a documentation follow-up on the same branch. Earlier UX-06 implementation is `d4eb9d4`. The original workspace's untracked `docs/forms/` and `docs/supply/` remain untouched.

## PR stack and milestones

All nine PRs were inspected open and non-draft. No merge or auto-merge was performed; UX-06 and IMPORT-01 auto-merge are not enabled. Each PR targets the immediately preceding task branch. First base is origin/main at `782f9d6`.

Milestones are implementation / local verification / external activation / live verification.

| Task | PR | Declared base | Status | Milestones |
| --- | --- | --- | --- | --- |
| DATA-01 | [#132](https://github.com/marcopolocheung/CR-Website/pull/132) | `main` | complete local CODE_ONLY | D/D/NA/NA |
| DATA-02 | [#133](https://github.com/marcopolocheung/CR-Website/pull/133) | `feat/overhaul-data-01` | complete local CODE_ONLY | D/D/NA/NA |
| DATA-05 | [#134](https://github.com/marcopolocheung/CR-Website/pull/134) | `feat/overhaul-data-02` | implemented | D/D/P/P |
| UX-01 | [#135](https://github.com/marcopolocheung/CR-Website/pull/135) | `feat/overhaul-data-05` | complete local CODE_ONLY | D/D/NA/NA |
| UX-03 | [#136](https://github.com/marcopolocheung/CR-Website/pull/136) | `feat/overhaul-ux-01` | complete local CODE_ONLY | D/D/NA/NA |
| UX-05 | [#137](https://github.com/marcopolocheung/CR-Website/pull/137) | `feat/overhaul-ux-03` | complete local CODE_ONLY | D/D/NA/NA |
| CASH-01 | [#138](https://github.com/marcopolocheung/CR-Website/pull/138) | `feat/overhaul-ux-05` | complete local CODE_ONLY | D/D/NA/NA |
| UX-06 | [#139](https://github.com/marcopolocheung/CR-Website/pull/139) | `feat/overhaul-cash-01` | complete local CODE_ONLY | D/D/NA/NA |
| IMPORT-01 | [#140](https://github.com/marcopolocheung/CR-Website/pull/140) | `feat/overhaul-ux-06` | complete local CODE_ONLY | D/D/NA/NA |

Canonical acceptance evidence is in each [task brief](tracker.md). The separate contract/guides describe implementation limits and rollback: [contract v1](contract-v1.md), [local D1/R2](../../worker/LOCAL_DATA.md), [atomic history](../../worker/ATOMIC_RECORDS.md), [translations](translations.md), [controls](feedback-controls.md), [drafts](drafts-and-handoff.md), [cash context](cashout-context.md), [navigation/recovery](navigation-and-recovery.md).

## IMPORT-01 final checks

- `npm run imports:test`: PASS 14/14.
- Dictionary tests via Node/jiti: PASS 3/3.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`: PASS.
- Python Playwright/Chromium: all three final runs PASS — import validation, language and feedback. Uses synthetic loopback responses; production Worker calls fail the tests.
- Canonical/tracker consistency: PASS 84 briefs and 162 repeated rows.
- Actual exported sales workbook cells and hours layout/source totals verified. English/Spanish, keyboard/touch phone layout, stale replaced reads, quota denial, template failure/retry, duplicate submit and offline hours covered.

[Source validation guide](import-validation.md) records commands, fixtures, acceptance, output compatibility and limits. Files/fields are retained in session memory; source authenticity, slot/store/date correctness, reviewed-output snapshots, payroll policy and persisted imports are not claimed. IMPORT-02/03 remain distinct tasks.

## Earlier UX-06 stack checks

| Check | Result |
| --- | --- |
| `npm run recovery:test` | PASS 7/7; retry identity/checkpoint, conflict, capabilities, duplicate prevention, raw-field comparison |
| `npm run data:test` | PASS 10/10; isolated local workerd D1/KV/R2, schema, concurrent revisions, retry/history rollback |
| `npm run scheduler:test` | PASS 128/128; existing scheduler/store/public compatibility and Worker fixtures |
| `npm run cashout:test` | PASS 16/16; existing cash/dashboard/inventory plus legacy source adapter |
| Contracts/dictionaries/drafts via Node + jiti | PASS 15/15 |
| `npm exec tsc -- --noEmit` | PASS |
| `npm run build` | PASS static export |
| `npm run seo:check` | PASS |
| `git diff --check` | PASS |
| Canonical/tracker consistency | PASS 84 briefs and 160 repeated tracker occurrences for dependency/status/owner/milestones |
| Local browser scripts | PASS all five: language, feedback, drafts, cash-out context, recovery |

The five Python Playwright/Chromium scripts run against Next dev with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`. They intercept backend calls with synthetic responses and reject production Worker requests. Commands and scenarios are recorded in the linked task guides. Browser tests cover keyboard/touch, English/Spanish, mounted fields/files, print recovery, independent draft editors, four store/date combinations, stale 200/401 responses, denied storage, route/native-reload cancellation, retained auth failures, original-base 409 comparison/copy/download, explicit server adoption and one held request for two immediate submits. Native mobile/process termination and same-document/programmatic SPA navigation limits are documented, without claiming universal interception.

## Pending external work and decisions

No resource provisioning, remote migration, Worker deployment, frontend publication, production mutation, staff session or live verification occurred. Existing production configuration and KV resources were preserved. Local resource names are simulation identifiers, not verified Cloudflare IDs.

DATA-05 remains implemented with external/live pending. Future authorized operators must verify account and existing SCHEDULES namespace, create/bind isolated non-production D1/R2, apply ordered migrations 0001–0003, rehearse restore, and deploy a compatible pinned artifact through DATA-03/REL-03. Only locally implemented, authorized service slices should wire the shared mutation layer and advertise capabilities; no generic write endpoint is exposed today. Repeat concurrent same-base, same/different-content retry and history-failure rollback through the deployed authorized service, recording environment/artifact/operator/time and redacted revisions. Production cutover is DATA-09 after DATA-08 rehearsal and its decision gates; frontend publication is separately REL-04.

Rollback must keep legacy KV attached and preserve D1/R2 records, receipts/history and device draft/source keys. Stop a selected slice's writes, export and reconcile accepted new writes before returning to an older artifact; code rollback alone does not restore data. See the atomic-record and external-operation runbooks for the operation-specific sequence. Next unused migration number is 0004 and must be reserved before editing.

DEC-01–07 remain unapproved: business-day/overnight rules; cash adjustments/review/corrections; retention/attachment/backup policy; employee identity/memberships; units/packs/stock events; next form/signature approval; terminology/numeric entry/print language. No task inferred those answers. Dependent work remains gated. Explicitly deferred LATER work stays deferred, including auth/hosting migration and Toast APIs.

## Next single task

Recommended next is **IMPORT-02**, P0 and now ready after IMPORT-01: separate sales parsing/review/generation, show source evidence for every mapped figure, flag inconsistent totals and verify familiar output. Follow with IMPORT-03 for explicit Start next report, replacement warning and repeat reviewed downloads. Do not split these across concurrent writers: they touch the same converters. IMPORT-05 is still blocked by DEC-01. FORM-02, UX-02, DATA-07, SCH-08, FORM-07, DASH-01, REL-01/02 and other ready tasks remain available.

Exact continuation when instructed:

1. Fetch/check origin, open PRs, claims and workspace changes. Preserve the original worktrees/user data. Earlier unmerged verified stack implementation satisfies code gates.
2. Create `feat/overhaul-import-02` from the current `feat/overhaul-import-01` head; its PR must target `feat/overhaul-import-01` (#140).
3. Read the full IMPORT-02 brief, inspect current parsers/converters and claim only that task in brief/tracker. Treat its baseline descriptions as historical: IMPORT-01 now validates sources and retains session inputs.
4. Implement complete bilingual review/reconciliation with original source evidence and workbook parity, without inferring DEC-01/02/07 answers. Use synthetic files and verified loopback API overrides.
5. Run task/skill checks, record milestones and evidence, open its own PR against #140’s head. No merge, external activation or automatic next-task start is part of the current finish-and-report request.

## Recommended parallel work

Use one coordinator/integrator plus three workers. This follows the [agent guide](agent-guide.md): one bounded claim per worker, explicit shared-file ownership, verified prerequisite milestones and separate activation gates. No agents have been launched. Recommended topology is one coordinator with bounded parallel subagents, each explicitly assigned an isolated worktree for code changes. OpenAI’s [subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents) favors independent bounded work and cautions that concurrent writes add coordination overhead; [worktree guidance](https://learn.chatgpt.com/docs/environments/git-worktrees) describes isolated checkouts. This recommendation applies those principles to the repo’s single-stack constraint; it does not claim agents automatically create worktrees.

| Worker | Ready P0 task | Main ownership |
| --- | --- | --- |
| A | IMPORT-02 | Sales extraction review/reconciliation and import translations; IMPORT-03 follows serially with the same owner |
| B | DATA-07 | KV export/transformation/reconciliation tooling and isolated replay fixtures; no real cloud/data execution |
| C | REL-02 | Reproducible Worker build/source-of-truth/mirror handling; package/toolchain changes |

Give each worker a separate **detached worktree** from the frozen IMPORT-01 head, with its own dependencies/build output. Each updates its local task brief/tracker and hands back a bounded patch/commit plus evidence. Detached preparation allows implementation in parallel while preserving the user's literal ordered task-branch/PR rule: the coordinator creates each actual task branch only after the preceding PR is open, applies/integrates that worker's work, reruns relevant checks and opens it against the preceding branch. Other completed work then rebases/integrates onto that head. Do not independently publish three sibling PRs against main or the same base.

Reserve shared files before editing. Worker C owns package/toolchain edits; A owns import dictionary additions; the coordinator resolves shared tracker/readiness, API/contracts, navigation/layout and any Worker monolith/migration reservation. Proposed shared changes are coordinated and integrated rather than silently replacing another worker's snapshot. Freeze the delivered contract unless a named owner changes it and updates affected consumers. Keep every PR diff limited to its own task, tests and necessary tracker updates.

REL-01 CI is a good follow-up after REL-02 because both touch release/package/workflow concerns. Defer policy/access/staff/activation-blocked tasks and retain their exact blockers while other local code work continues. Do not merge, auto-merge, provision, deploy or run production migrations as part of this parallel plan.

## Exhaustive overhaul inventory requested by user

There are **84 canonical tasks**: 77 baseline tasks and 7 deliberately deferred tasks. The runbook has **9 supporting operational procedures**; together these are 93 named IDs, but operations are not additional independent feature tasks. Current states: 8 complete local CODE_ONLY, 1 implemented with activation/live pending, 23 ready (includes decisions/external work requiring separate authorization), 25 planned, 20 blocked and 7 deferred. No task is merged or live by virtue of its local completion.

### Business decisions

- [DEC-01](tasks/DEC-01.md) — Confirm business-date and shift-boundary rules (ready).
- [DEC-02](tasks/DEC-02.md) — Confirm starting-cash, adjustment, and discrepancy-review rules (ready).
- [DEC-03](tasks/DEC-03.md) — Define retention, archival, export, and recovery requirements (ready).
- [DEC-04](tasks/DEC-04.md) — Define shared employee identity and station membership (ready).
- [DEC-05](tasks/DEC-05.md) — Confirm inventory units, packs, suppliers, and targets (ready).
- [DEC-06](tasks/DEC-06.md) — Choose the next digital form and review requirements (ready).
- [DEC-07](tasks/DEC-07.md) — Review Spanish terminology, money, dates, and print language (ready).

### Shared UX

- [UX-01](tasks/UX-01.md) — Establish translations and local dictionaries (complete).
- [UX-02](tasks/UX-02.md) — Create navigation and visible working context (ready).
- [UX-03](tasks/UX-03.md) — Standardize controls, feedback, and save indicators (complete).
- [UX-04](tasks/UX-04.md) — Establish keyboard and tablet interaction patterns (ready).
- [UX-05](tasks/UX-05.md) — Implement labeled drafts and shared-device handoff (complete).
- [UX-06](tasks/UX-06.md) — Handle unsaved changes, retries, and edit conflicts (complete).
- [UX-07](tasks/UX-07.md) — Standardize print layouts and bilingual output (blocked).

### Data foundation and migration

- [DATA-01](tasks/DATA-01.md) — Establish record and API compatibility contracts (complete).
- [DATA-02](tasks/DATA-02.md) — Add D1 migrations, local configuration, and fixtures (complete).
- [DATA-03](tasks/DATA-03.md) — Provision and bind non-production D1/R2 (ready).
- [DATA-04](tasks/DATA-04.md) — Implement employee directory and legacy mappings (blocked).
- [DATA-05](tasks/DATA-05.md) — Implement atomic revisions and change history (implemented).
- [DATA-06](tasks/DATA-06.md) — Implement attachment metadata, upload, and retrieval (blocked).
- [DATA-07](tasks/DATA-07.md) — Prepare KV export and reconciliation tooling (ready).
- [DATA-08](tasks/DATA-08.md) — Rehearse migration and recovery in non-production (blocked).
- [DATA-09](tasks/DATA-09.md) — Execute production resource setup and verified cutover (blocked).
- [DATA-10](tasks/DATA-10.md) — Implement and verify backup/export/restore procedures (blocked).

### Scheduling

- [SCH-01](tasks/SCH-01.md) — Persist dated time off and temporary availability (blocked).
- [SCH-02](tasks/SCH-02.md) — Add manager-entered requests and review (planned).
- [SCH-03](tasks/SCH-03.md) — Apply approved exceptions to generation and validation (planned).
- [SCH-04](tasks/SCH-04.md) — Add publication revisions and readable comparisons (ready).
- [SCH-05](tasks/SCH-05.md) — Detect cross-station assignment conflicts (blocked).
- [SCH-06](tasks/SCH-06.md) — Add combined hours and agreed warnings (blocked).
- [SCH-07](tasks/SCH-07.md) — Improve planning and staff views in both languages (planned).
- [SCH-08](tasks/SCH-08.md) — Verify existing scheduler and public compatibility (ready).

### Cash-out

- [CASH-01](tasks/CASH-01.md) — Correct store/date-specific draft restoration (complete).
- [CASH-02](tasks/CASH-02.md) — Add guided cashier entry (planned).
- [CASH-03](tasks/CASH-03.md) — Recalculate financial totals on the server (blocked).
- [CASH-04](tasks/CASH-04.md) — Add incomplete, submitted, and reviewed states (blocked).
- [CASH-05](tasks/CASH-05.md) — Add discrepancy explanations and correction history (planned).
- [CASH-06](tasks/CASH-06.md) — Record actual versus expected deposits (blocked).
- [CASH-07](tasks/CASH-07.md) — Use the employee directory for cashier selection (planned).
- [CASH-08](tasks/CASH-08.md) — Improve history, filters, output, and recovery (blocked).

### Inventory and purchasing

- [INV-01](tasks/INV-01.md) — Add explicit count sessions and line states (ready).
- [INV-02](tasks/INV-02.md) — Add progress, remaining filters, and search (ready).
- [INV-03](tasks/INV-03.md) — Add units, packs, and clear target labels (blocked).
- [INV-04](tasks/INV-04.md) — Improve tablet entry and shelf-order navigation (planned).
- [INV-05](tasks/INV-05.md) — Generalize catalogs and counts for CR2/CR3 (planned).
- [INV-06](tasks/INV-06.md) — Persist supplier orders and issued snapshots (planned).
- [INV-07](tasks/INV-07.md) — Implement partial receiving and discrepancies (planned).
- [INV-08](tasks/INV-08.md) — Include outstanding orders in suggestions (planned).
- [INV-09](tasks/INV-09.md) — Add agreed waste and transfer records (blocked).
- [INV-10](tasks/INV-10.md) — Verify historical counts after catalog changes (planned).

### Sales and hours imports

- [IMPORT-01](tasks/IMPORT-01.md) — Validate source files with actionable errors (complete).
- [IMPORT-02](tasks/IMPORT-02.md) — Add sales previews and reconciliation (ready).
- [IMPORT-03](tasks/IMPORT-03.md) — Preserve inputs and repeat downloads (ready).
- [IMPORT-04](tasks/IMPORT-04.md) — Unify date/store handling and cash-out linkage (blocked).
- [IMPORT-05](tasks/IMPORT-05.md) — Add hours previews and explicit date ranges (blocked).
- [IMPORT-06](tasks/IMPORT-06.md) — Map employee IDs and show unmatched rows (planned).
- [IMPORT-07](tasks/IMPORT-07.md) — Add import history and duplicate handling (blocked).
- [IMPORT-08](tasks/IMPORT-08.md) — Add scheduled-versus-actual reporting (planned).

### Forms

- [FORM-01](tasks/FORM-01.md) — Add searchable employee/date/type lists (ready).
- [FORM-02](tasks/FORM-02.md) — Add recoverable drafts and navigation protection (ready).
- [FORM-03](tasks/FORM-03.md) — Separate bilingual entry from print layout (planned).
- [FORM-04](tasks/FORM-04.md) — Add attachments and append-only amendments (planned).
- [FORM-05](tasks/FORM-05.md) — Add follow-up dates, assignment, and resolution (planned).
- [FORM-06](tasks/FORM-06.md) — Implement the selected next digital form (blocked).
- [FORM-07](tasks/FORM-07.md) — Verify blank downloads and saved compatibility (ready).

### Dashboard

- [DASH-01](tasks/DASH-01.md) — Define the outstanding-work summary contract (ready).
- [DASH-02](tasks/DASH-02.md) — Add contextual exact-record links (planned).
- [DASH-03](tasks/DASH-03.md) — Surface closes, differences, and count progress (planned).
- [DASH-04](tasks/DASH-04.md) — Surface deliveries, schedule changes, and follow-ups (planned).
- [DASH-05](tasks/DASH-05.md) — Distinguish missing, failed, and empty data (planned).

### Release and acceptance

- [REL-01](tasks/REL-01.md) — Integrate internal-service checks into CI (ready).
- [REL-02](tasks/REL-02.md) — Make Worker builds reproducible and resolve the mirror (ready).
- [REL-03](tasks/REL-03.md) — Document and verify staged backend deployment (planned).
- [REL-04](tasks/REL-04.md) — Document frontend publication and verify activation (planned).
- [REL-05](tasks/REL-05.md) — Conduct bilingual shared-device staff tests (blocked).
- [REL-06](tasks/REL-06.md) — Pilot workflows and record defects (planned).
- [REL-07](tasks/REL-07.md) — Complete rollout, handoff, and recovery rehearsal (planned).

### Explicitly deferred

- [LATER-01](tasks/LATER-01.md) — Authentication redesign (deferred).
- [LATER-02](tasks/LATER-02.md) — Frontend hosting migration coordination (deferred).
- [LATER-03](tasks/LATER-03.md) — Optional Toast API integration (deferred).
- [LATER-04](tasks/LATER-04.md) — Barcode and shelf-QR scanning (deferred).
- [LATER-05](tasks/LATER-05.md) — Personal calendars and notifications (deferred).
- [LATER-06](tasks/LATER-06.md) — Advanced scheduling optimization (deferred).
- [LATER-07](tasks/LATER-07.md) — Ordering and QR prototype disposition (deferred).

### Supporting operations (external-operations.md)

- OP-01: create isolated, approved environment resources.
- OP-02: verify/configure bindings, API origins and secret presence; preserve real SCHEDULES binding.
- OP-03: apply ordered migrations with manifest/version/checksum and empty/upgrade evidence.
- OP-04: deploy the pinned Worker artifact separately from frontend publication.
- OP-05: record export, transform, import, reconcile, cutover and restore as distinct events.
- OP-06: publish the compatible static frontend through the existing GitHub Pages workflow.
- OP-07: verify selected live scenarios, authorization, revisions, retries, old clients and device/language behavior.
- OP-08: rehearse rollback and accepted-write reconciliation; never replace current data blindly with a snapshot.
- OP-09: observe actual bilingual staff sessions and store/shift pilots, record defects and acceptance.

### Requirements applying across tasks

English/Spanish labels and late/error states share language-independent records; retain original narratives/names and source fields. Support keyboard/touch, focus/error recovery, shared-device context and labeled drafts. Distinguish session memory, device drafts, sending, acknowledged server save and failed/stale/conflict states. Preserve money/null/unit/date semantics and wait for the relevant approved decision. Keep credentials out of URLs/drafts/logs/fixtures. Preserve old APIs, encrypted/public links, station defaults/restrictions, report layouts and historical records. Require task-specific fixtures/browser evidence and separate implementation/local/external/live milestones. Coordinate shared files/contracts/migration reservations and keep one bounded task per owner/PR. Use verified local/staging API bases; never mutate production during local tests. Selected release slices need verified targets, compatible pinned artifacts, migration/restore/reconciliation evidence and rollback thresholds. Business approvals, deployment, staff acceptance and rollout are distinct events; local tests do not substitute for them. Deferred work stays deferred.
