# Internal-tools overhaul handoff — 2026-10-24

The requested UX-06 PR is open and ready for review. This handoff records the current local implementation and the recommended continuation; it does not mark the overall overhaul complete. Work is isolated in `/home/wslunusn/CR-Website-overhaul`, branch `feat/overhaul-ux-06`. The application implementation commit is `d4eb9d4`; this handoff is a documentation follow-up on the same branch. The original workspace's untracked `docs/forms/` and `docs/supply/` remain untouched.

## PR stack and milestones

All eight PRs were inspected open and non-draft. No merge or auto-merge was performed; UX-06's autoMergeRequest is null. Each PR targets the immediately preceding task branch. First base is origin/main at `782f9d6`.

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

Canonical acceptance evidence is in each [task brief](tracker.md). The separate contract/guides describe implementation limits and rollback: [contract v1](contract-v1.md), [local D1/R2](../../worker/LOCAL_DATA.md), [atomic history](../../worker/ATOMIC_RECORDS.md), [translations](translations.md), [controls](feedback-controls.md), [drafts](drafts-and-handoff.md), [cash context](cashout-context.md), [navigation/recovery](navigation-and-recovery.md).

## Latest checks

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

Recommended next is **IMPORT-01**, P0 and ready; it unlocks P0 IMPORT-02 sales previews and IMPORT-03 retained inputs/repeat downloads. FORM-02 also becomes ready because UX-05/UX-06 are locally complete; UX-02, DATA-07, SCH-08, FORM-07, REL-01/02 and other tracker-ready work remain available.

Exact continuation:

1. Fetch origin/main; inspect current open PRs, claims and workspace changes again. Treat the unmerged stack's verified implementation as satisfying code prerequisites.
2. From the current `feat/overhaul-ux-06` head, create `feat/overhaul-import-01`; its PR must target `feat/overhaul-ux-06`. Preserve the existing worktrees/branches.
3. Read full `tasks/IMPORT-01.md` and recheck current converter/parser behavior. Claim only that task in its brief and tracker before editing. Its owner is currently unassigned.
4. Implement validation/remedies with current English/Spanish controls and retained inputs, preserving workbook formats/row evidence and avoiding business/date/payroll-policy guesses. Use local fixtures and explicit loopback/staging API overrides.
5. Run the task/skill checks, record acceptance and milestones, open its own reviewable PR, and continue in dependency/priority order when instructed. No merge or external activation.

## Recommended parallel work

Use one coordinator/integrator plus three workers. This follows the [agent guide](agent-guide.md): one bounded claim per worker, explicit shared-file ownership, verified prerequisite milestones and separate activation gates. No agents have been launched by this handoff.

| Worker | Ready P0 task | Main ownership |
| --- | --- | --- |
| A | IMPORT-01 | Converter/parser validation, import fixtures and its namespaced translations; unlocks IMPORT-02/03 |
| B | DATA-07 | KV export/transformation/reconciliation tooling and isolated replay fixtures; no real cloud/data execution |
| C | REL-02 | Reproducible Worker build/source-of-truth/mirror handling; package/toolchain changes |

Give each worker a separate **detached worktree** from the frozen UX-06 head, with its own dependencies/build output. Each updates its local task brief/tracker and hands back a bounded patch/commit plus evidence. Detached preparation allows implementation in parallel while preserving the user's literal ordered task-branch/PR rule: the coordinator creates each actual task branch only after the preceding PR is open, applies/integrates that worker's work, reruns relevant checks and opens it against the preceding branch. Other completed work then rebases/integrates onto that head. Do not independently publish three sibling PRs against main or the same base.

Reserve shared files before editing. Worker C owns package/toolchain edits; A owns import dictionary additions; the coordinator resolves shared tracker/readiness, API/contracts, navigation/layout and any Worker monolith/migration reservation. Proposed shared changes are coordinated and integrated rather than silently replacing another worker's snapshot. Freeze the delivered contract unless a named owner changes it and updates affected consumers. Keep every PR diff limited to its own task, tests and necessary tracker updates.

REL-01 CI is a good follow-up after REL-02 because both touch release/package/workflow concerns. Defer policy/access/staff/activation-blocked tasks and retain their exact blockers while other local code work continues. Do not merge, auto-merge, provision, deploy or run production migrations as part of this parallel plan.
