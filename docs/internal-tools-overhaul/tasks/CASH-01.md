---
id: CASH-01
parent: CASH
title: "Correct store/date-specific draft restoration"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [UX-05]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# CASH-01 — Correct store/date-specific draft restoration

## Outcome and scope

Isolate cash-out drafts and explicitly handle store/date switching without reassigning an existing sheet.

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

This implementation reuses [UX-05](UX-05.md) at `implemented` (or `complete`), already locally verified in PR #137. The original brief was independently implementable; reuse records the actual shared draft API dependency and adds no business-policy gate.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/CashOut.tsx; src/lib/cashout.ts; src/lib/cashout-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Treat the unscoped legacy draft as unassigned until the user chooses its context
- [x] Test CR2 and CR3 with two dates, reloads, and rapid switches
- [x] Guard late fetch responses and storage denial without silently clearing entries
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Treat the unscoped legacy draft as unassigned until the user chooses its context. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Test CR2 and CR3 with two dates, reloads, and rapid switches. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Guard late fetch responses and storage denial without silently clearing entries. Record fixture/input, expected result, actual result, and evidence.
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

- Artifacts: [context/restoration guide](../cashout-context.md), legacy reader/tests, explicit assignment in cash-out workspace, chooser context snapshot guards, mounted-editor response guards, parity-tested keys and `scripts/test-cashout-context.py`. This implementation reuses locally complete UX-05 (#137); that actual API dependency is reflected in metadata/tracker.
- Scenario 1: the original raw sheet remains unassigned until exact store/date/preparer confirmation. Keyboard cancellation created no draft; Spanish touch confirmation copied exact AM/PM names/counts/Toast/Z to selected CR2/2026-10-20. Original bytes remain untouched; no backend PUT occurred. Malformed sources remain downloadable without coercion. Changed source bytes are rechecked around confirmation rather than blindly applying an obsolete view.
- Scenario 2: actual local browser wrote and reloaded all four CR2/CR3 × 2026-10-20/2026-10-21 contexts, restoring each name/count/Toast/Z value through explicit resume. Twelve rapid selections showed only the final context's rows. Active context cannot be reassigned; new contexts start empty unless a source is explicitly chosen.
- Scenario 3: held old-editor 200 load did not open a dialog or replace the new draft; held 401 did not lock the new editor. Denied writes retained current values and blocked context teardown. Malformed original download preserved raw text. Original unscoped key was never changed by application code.
- Checks (isolated local worktree, 2026-10-24): `npm run cashout:test`, 16/16 pass; contracts/dictionaries/drafts 15/15 pass; CASH-01 Python Playwright PASS and all three prior language/feedback/draft browser regressions PASS. Explicit loopback API override/synthetic requests only; production requests rejected. `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check` pass.
- I/L/E/V: done/done/not_applicable/not_applicable. No publication, Worker deployment, remote migration, production write, staff test or live verification. Financial policies/calculations and current API wire shapes are unchanged; English print/workbook compatibility is covered by the language regression.
- Recovery: original/new draft keys and local recovery downloads remain available; no automatic deletion, guessed context or token persistence. Rollback reverts scoped UI/reader changes while preserving those keys. Existing server last-save-wins guarantees remain explicit.
- Next owner/action: Codex continues UX-06 for shared navigation/retry/conflict protection; retain the established draft/context invariants and separate backend capability activation.
