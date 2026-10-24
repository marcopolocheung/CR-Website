---
id: CASH-02
parent: CASH
title: "Add guided cashier entry"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [UX-03, UX-04]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# CASH-02 — Add guided cashier entry

## Outcome and scope

Provide predictable denomination entry with cashier/shift context and a visible money summary.

Preserve denomination counts, integer cents, AM/PM presentation, Toast/Z comparisons, existing paper output, and sales workbook linkage. Do not invent cash-movement categories, shortage thresholds, payroll deductions, or starting-cash policy.

## Current behavior and verified sources

CashOut persists only sheet contents under cr-cash-out, while store/date are separate component state. Browser calculations use integer cents and a fixed $100 float; validateCashoutBody checks submitted totals for shape only. Saved days have 30-day history, a 31-day TTL, and last-save-wins behavior.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/CashOut.tsx](<../../../src/components/internal/CashOut.tsx>)
- [src/lib/cashout.ts](<../../../src/lib/cashout.ts>)
- [src/lib/cashout-store.ts](<../../../src/lib/cashout-store.ts>)
- [worker/src/index.ts](<../../../worker/src/index.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [UX-03](UX-03.md) at `implemented` (or `complete`).
- [UX-04](UX-04.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/CashOut.tsx; src/lib/cashout.ts; src/lib/cashout-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Keep repetitive entry on one workspace with Tab/Enter and a tablet keypad
- [x] Distinguish untouched counts from deliberate zero
- [x] Preserve counted cash, Toast/Z comparisons, and the familiar print output
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Keep repetitive entry on one workspace with Tab/Enter and a tablet keypad. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Distinguish untouched counts from deliberate zero. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Preserve counted cash, Toast/Z comparisons, and the familiar print output. Record fixture/input, expected result, actual result, and evidence.
- [x] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [x] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [x] Translate visible labels, field errors, confirmations, statuses, and empty states with stable keys; language switching preserves record identity and entered values.
- [x] Complete the relevant flow by keyboard and touch; retain visible focus, dialog focus recovery, readable wrapped Spanish, and generous frequent-action targets.
- [x] Print/output: preserve familiar existing reports and downloads, show store/date/status, and check long Spanish and pagination where output is affected; otherwise record why print is unaffected.
- [x] Recovery: exercise interrupted work, denied storage or authorization, late responses, retries, and a second editor where applicable; never label local-only work as server saved.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- `npm run cashout:test` covers existing cash-out, dashboard, and inventory helpers; expect current parity checks to pass.
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

No resource creation, binding change, migration execution, or Worker deployment is needed for this task. Verify locally; ordinary frontend publication is tracked by [REL-04](REL-04.md). This task reaching complete does not mean its frontend is live. Rollback: revert the scoped repository commit; retain any existing drafts and compatible record readers.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | done | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | not_applicable | No external operation in this task; frontend publication is REL-04. |
| Live verification | not_applicable | Covered by shared release/acceptance tasks where applicable. |

## Handoff evidence

- Delivery: implementation commit `e6c6a8e`, PR [#148](https://github.com/marcopolocheung/CR-Website/pull/148), base `feat/overhaul-ux-04` / PR #145. Both PRs are open; no merge or auto-merge was enabled. This documentation update records delivery on the same branch.

- Scope/owner: Codex, 2026-10-24; `feat/overhaul-cash-02` follows UX-04 commit `e2a9214` / PR [#145](https://github.com/marcopolocheung/CR-Website/pull/145) in the same `/home/wslunusn/CR-Website-cashout` worktree. Artifacts and evidence: [guided-entry guide](../cashout-guided-entry.md), CountKeypad.tsx, cashout-draft helpers/tests, CashOut.tsx, expanded-summary viewport limit in EntryWorkspace.tsx, dictionaries and `scripts/test-cashout-entry.py`. No Worker, schema, API, financial-policy or dependency changes.
- Scenario 1: synthetic cashier/count entry remains in one workspace using Tab/Enter or an optional inline touch keypad. Previous/next, digits/delete/clear, close/Escape, context/total visibility, long Spanish names and 44px targets PASS. A short 430px landscape viewport keeps the expanded keypad scrollable and Close reachable. Add/remove restore useful focus.
- Scenario 2: initial blank, deliberately entered zero and historical unknown remain distinct. Explicit resume after reload restores zero, nonzero and blank fields. A second resumed editor preserves its independent values. Invalid raw text is retained and blocks a server write without truncation; denied storage retains the raw current input and prevents context teardown. Legacy source bytes remain untouched.
- Scenario 3: AM $300 less $100 float versus Toast $199.75, PM $100 less $100 float versus Toast $0 and Z $200 produce the original integer-cent totals: deposit 20000, cash difference 25, Z difference 0. Server request has only original cashier fields; sales converter receives the same saved AM/PM deposit/difference. Three-page Letter PDF text/rendering verifies familiar English AM/PM/count/Toast/Z output even from Spanish UI; keypad/help/progress are omitted.
- Checks: `npm run cashout:test` 19/19; dictionaries/drafts 9/9; TypeScript, static build, SEO and whitespace checks PASS. CASH-02 and UX-04 browser scripts PASS; CASH-01/UX-03/UX-05/UX-01 browser regressions PASS. Exact commands and fixtures are in the guide. Synthetic loopback API only; production Worker calls are rejected.
- Milestones: done/done/not_applicable/not_applicable. No deployment/publication/live assertion. Physical tablet keyboards and staff acceptance remain REL-05/06. Blank fields preserve current financial meaning and do not introduce a submission policy; local entry status is not uploaded.
- Rollback: revert the UI/helper change while retaining every draft/source key; extended sources can require recovery download in older readers. Restore through a compatible reader rather than deleting them. Failed server requests preserve values and can be retried.
- Original delivery returned to the user for DEC-02. The subsequent [notebook decision](../cashout-rules.md) confirms always $100 per drawer, makes CASH-03 ready and defers operational CASH-04/05/06. No subsequent code task is claimed by this decision PR; existing PRs remain unmerged.
