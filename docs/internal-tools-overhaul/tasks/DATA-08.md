---
id: DATA-08
parent: DATA
title: "Rehearse migration and recovery in non-production"
priority: P0
delivery_class: EXTERNAL_ONLY
status: blocked
owner: unassigned
implementation_dependencies: [DATA-03, DATA-07, DATA-02, DEC-03, REL-03]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: pending
live_verification: pending
---

# DATA-08 — Rehearse migration and recovery in non-production

## Outcome and scope

Run a controlled staging export/import, compatibility comparison, restore, and rollback rehearsal.

Preserve legacy KV data, station defaults/fallbacks, encrypted link behavior, existing public/private boundaries, and old frontend response compatibility. Do not guess resource IDs, employee matches, supplier units, retention periods, or financial policies.

## Current behavior and verified sources

The Worker Env binds SCHEDULES (KV), with no D1/R2 bindings. Station schedule/roster/template writes read and compare rev/baseRev before KV puts; these are not atomic cross-request revision guarantees. Cash-out/count days have last-save-wins writes. There is no shared relational employee or attachment service.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [worker/src/index.ts](<../../../worker/src/index.ts>)
- [worker/wrangler.toml](<../../../worker/wrangler.toml>)
- [src/lib/schedule-store.ts](<../../../src/lib/schedule-store.ts>)
- [src/lib/employee-store.ts](<../../../src/lib/employee-store.ts>)
- [src/lib/inventory-store.ts](<../../../src/lib/inventory-store.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [DATA-03](DATA-03.md) at `complete`.
- [DATA-07](DATA-07.md) at `implemented` (or `complete`).
- [DATA-02](DATA-02.md) at `implemented` (or `complete`).
- [DEC-03](DEC-03.md) at `complete`.
- [REL-03](REL-03.md) at `complete`.

**Needed to activate:**

No additional task-wide activation dependency. For external execution, the implementation prerequisites and environment gate in the runbook must already be satisfied.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: worker/src/index.ts; worker/wrangler.toml; src/lib/schedule-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Use synthetic or approved sanitized exports and retain originals
- [ ] Repeat an interrupted migration without duplicate records
- [ ] Record reconciliation, old/new client behavior, restore timing, and rollback results
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Use synthetic or approved sanitized exports and retain originals. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Repeat an interrupted migration without duplicate records. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Record reconciliation, old/new client behavior, restore timing, and rollback results. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- Use only the environment-confirmed operations linked below. OP-07 includes the existing read-only `npm run scheduler:verify -- <verified-api-base>` probe, which is insufficient alone for new services. Exact schema and isolated import/restore-replay probes are future deliverables from DATA-02/07; inspect their help/dry-run output before use. This storage rehearsal does not wait for DATA-10 ongoing backup automation. Use synthetic object fixtures and verify the OP-05 manifest and restored relationships.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

Required operations: [OP-03](../external-operations.md#op-03), [OP-05](../external-operations.md#op-05), [OP-07](../external-operations.md#op-07), [OP-08](../external-operations.md#op-08). Access: verified Cloudflare account operator with the least access needed for the named resources/deployments; GitHub Pages maintainer for frontend publication where listed. Environment: isolated non-production only in this task; production requires its own activation and evidence. Check actual account, resource IDs, KV binding, compatible schema, pinned Worker artifact, and environment API base before running operations. For schema-free changes record OP-03 as not applicable with evidence.

Evidence specific to this task: the three task scenarios above must pass against the deployed service, with redacted request/result, record ID/revision, environment, artifact version, operator, and UTC time. Record staging and production separately. Rollback: OP-08 restores the last compatible artifact/bindings and reconciles accepted writes; do not delete D1/R2 or detach the original KV. Export preserved records first if the change created new data. This task records execution, not just the existence of a runbook; do not mark an operation successful without its own evidence.

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
- Blockers: Business decision: DEC-03. Independent tasks remain available.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.
