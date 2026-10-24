---
id: CASH-08
parent: CASH
title: "Improve history, filters, output, and recovery"
priority: P1
delivery_class: CODE_AND_EXTERNAL
status: blocked
owner: unassigned
implementation_dependencies: [DATA-05, UX-07, DEC-03]
activation_dependencies: [DATA-03, REL-03, DATA-09, REL-04]
implementation: pending
local_verification: pending
external_activation: pending
live_verification: pending
---

# CASH-08 — Improve history, filters, output, and recovery

## Outcome and scope

Provide saved bookkeeping notebook history, revision-aware print/export and retention-approved recovery under [DEC-02](../cashout-rules.md). Wire ordinary revision-checked saves and retained prior values using DATA-05; distinguish device-only work from acknowledged server saves. No submitted/reviewed status, special correction permission, mandatory explanation or actual cash-delivery tracking is required. CASH-04/05/06 are deferred and do not gate this task.

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

- [DATA-05](DATA-05.md) at `implemented` (or `complete`) for atomic ordinary saves and revision history.
- [UX-07](UX-07.md) at `implemented` (or `complete`).
- [DEC-03](DEC-03.md) at `complete`.

**Needed to activate:**

- [DATA-03](DATA-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-03](REL-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [DATA-09](DATA-09.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-04](REL-04.md) at `complete` for production completion; implementation may proceed with local fixtures.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/CashOut.tsx; src/lib/cashout.ts; src/lib/cashout-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Align the unused `cash_closes` workflow-state scaffold with the notebook through an additive coordinated migration before writing notebook records; no fabricated submission/review state or actual bank deposit requirement

- [ ] Wire revision-checked ordinary notebook saves with atomic retained prior values, save time and explicit conflict/retry recovery through DATA-05; require no approval workflow or correction reason

- [ ] Filter by store/date/cashier and reopen the exact saved record/revision
- [ ] Show missing/expired history distinctly from a zero close
- [ ] Verify exported totals and recovery against retained snapshots
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 4: Concurrent ordinary edits cannot silently overwrite; uncertain retries do not duplicate versions and history failure rolls back the save. Preserve both editors without requiring submitted/reviewed state or a reason. Record input, expected/actual result and evidence.

- [ ] Scenario 1: Filter by store/date/cashier and reopen the exact saved record/revision. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Show missing/expired history distinctly from a zero close. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Verify exported totals and recovery against retained snapshots. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Translate visible labels, field errors, confirmations, statuses, and empty states with stable keys; language switching preserves record identity and entered values.
- [ ] Complete the relevant flow by keyboard and touch; retain visible focus, dialog focus recovery, readable wrapped Spanish, and generous frequent-action targets.
- [ ] Print/output: preserve familiar existing reports and downloads, show store/date/revision and save state, and check long Spanish and pagination where output is affected; otherwise record why print is unaffected.
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
- Blockers: DEC-03 retention and UX-07 (including DEC-07 output approval). DATA-05 local implementation is available. No deferred cash workflow is a prerequisite.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.
