---
id: CASH-05
parent: CASH
title: "Add discrepancy explanations and correction history"
priority: P1
delivery_class: CODE_AND_EXTERNAL
status: deferred
owner: unassigned
implementation_dependencies: [CASH-04]
activation_dependencies: [DATA-03, REL-03, DATA-09, REL-04]
implementation: pending
local_verification: pending
external_activation: pending
live_verification: pending
---

# CASH-05 — Add discrepancy explanations and correction history

## Current disposition — DEC-02

Deferred by the project owner's 2026-10-24 [bookkeeping notebook decision](../cashout-rules.md). The current tool counts cash, always subtracts $100 per cashier drawer, compares Toast/Z and saves figures for later lookup. The operational feature below requires a future explicit request; its old checklists are retained as future scope, not current requirements. This deferral is not a completed implementation.

Ordinary save/revision history and recovery remain baseline DATA-05/CASH-08 work and do not require a submission, review, mandatory explanation or physical-deposit workflow. Existing calculated `deposit` fields remain calculated turn-in, not evidence of a bank deposit. Existing access controls are unchanged.

## Outcome and scope (future only)

Persist explanations, review resolutions, and corrections without replacing the previous financial record.

Preserve denomination counts, integer cents, AM/PM presentation, Toast/Z comparisons, existing paper output, and sales workbook linkage. Do not invent cash-movement categories, shortage thresholds, payroll deductions, or starting-cash policy.

## Current behavior and verified sources

CASH-01/02 now provide independent store/date device drafts, guided counts and blank/zero/legacy-unknown entry status in this branch. Browser calculations use integer cents and always subtract $100 per cashier drawer. The existing Worker still validates client totals by shape, lists 30 days and saves to KV with a 31-day TTL and last-save-wins. The unused local cash-state scaffold reflects the earlier workflow plan; [DEC-02](../cashout-rules.md) defines current notebook scope without changing that schema or deployment.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/CashOut.tsx](<../../../src/components/internal/CashOut.tsx>)
- [src/lib/cashout.ts](<../../../src/lib/cashout.ts>)
- [src/lib/cashout-store.ts](<../../../src/lib/cashout-store.ts>)
- [worker/src/index.ts](<../../../worker/src/index.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [CASH-04](CASH-04.md) at `implemented` (or `complete`).

**Needed to activate:**

- [DATA-03](DATA-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-03](REL-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [DATA-09](DATA-09.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-04](REL-04.md) at `complete` for production completion; implementation may proceed with local fixtures.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/CashOut.tsx; src/lib/cashout.ts; src/lib/cashout-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Show expected/count/difference and the relevant cashier or shift
- [ ] Enforce agreed review requirements without inventing shortage thresholds
- [ ] Keep original values and append each correction with reason and revision
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Show expected/count/difference and the relevant cashier or shift. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Enforce agreed review requirements without inventing shortage thresholds. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Keep original values and append each correction with reason and revision. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Translate visible labels, field errors, confirmations, statuses, and empty states with stable keys; language switching preserves record identity and entered values.
- [ ] Complete the relevant flow by keyboard and touch; retain visible focus, dialog focus recovery, readable wrapped Spanish, and generous frequent-action targets.
- [ ] Print/output: preserve familiar existing reports and downloads, show store/date/status, and check long Spanish and pagination where output is affected; otherwise record why print is unaffected.
- [ ] Recovery: exercise interrupted work, denied storage or authorization, late responses, retries, and a second editor where applicable; never label local-only work as server saved.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- `npm run scheduler:test` includes the existing Worker tests; expect all relevant cases to pass.
- `npm run cashout:test` covers existing cash-out, dashboard, and inventory helpers; expect current parity checks to pass.
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

Required operations: [OP-03](../external-operations.md#op-03), [OP-04](../external-operations.md#op-04), [OP-05](../external-operations.md#op-05), [OP-07](../external-operations.md#op-07), [OP-08](../external-operations.md#op-08), [OP-06](../external-operations.md#op-06). Access: verified Cloudflare account operator with the least access needed for the named resources/deployments; GitHub Pages maintainer for frontend publication where listed. Environment: isolated non-production first, then explicitly selected production slices. Check actual account, resource IDs, KV binding, compatible schema, pinned Worker artifact, and environment API base before running operations. For schema-free changes record OP-03 as not applicable with evidence.

Evidence specific to this task: the three task scenarios above must pass against the deployed service, with redacted request/result, record ID/revision, environment, artifact version, operator, and UTC time. Record staging and production separately. Rollback: OP-08 restores the last compatible artifact/bindings and reconciles accepted writes; do not delete D1/R2 or detach the original KV. Export preserved records first if the change created new data. Frontend consumers, when changed, publish through REL-04 after compatible backend activation; retain an old-client/absent-capability path until then.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | pending | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | pending | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | pending | Environment, operation IDs, deployment/resource evidence, or staff-session execution. |
| Live verification | pending | Observed target-environment behavior or staff acceptance with date and operator. |

## Handoff evidence

- Commits/artifacts: none; this brief is planning documentation.
- Checks performed: source inspection only; implementation scenarios not run.
- Remaining steps: claim task, verify prerequisites, execute applicable checklists, and record milestone evidence.
- Disposition: deferred by completed DEC-02; a future explicit request must reactivate this operational scope.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; do not claim until a future explicit request reactivates this scope. Notebook saving/history remains independent.
