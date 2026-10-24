---
id: REL-07
parent: REL
title: "Complete rollout, handoff, and recovery rehearsal"
priority: P1
delivery_class: EXTERNAL_ONLY
status: planned
owner: unassigned
implementation_dependencies: [REL-06, DATA-09, DATA-10]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: pending
live_verification: pending
---

# REL-07 — Complete rollout, handoff, and recovery rehearsal

## Outcome and scope

Roll out accepted slices in stages and hand over operations with demonstrated recovery.

Preserve current public routes, static export/SEO checks, actual KV data and bindings, and separately deployed backend/frontend compatibility. Do not turn authentication or hosting migration into release prerequisites.

## Current behavior and verified sources

deploy.yml runs npm ci, TypeScript, build, and SEO checks before publishing out/ to GitHub Pages. It does not run scheduler:test/cashout:test or deploy the Worker. worker/README.md describes manual TypeScript-to-dashboard.js generation and independent Worker deployment; the checked-in KV namespace ID is a placeholder.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [package.json](<../../../package.json>)
- [.github/workflows/deploy.yml](<../../../.github/workflows/deploy.yml>)
- [worker/README.md](<../../../worker/README.md>)
- [worker/wrangler.toml](<../../../worker/wrangler.toml>)
- [worker/dashboard.js](<../../../worker/dashboard.js>)
- [scripts/verify-schedule-store.mjs](<../../../scripts/verify-schedule-store.mjs>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [REL-06](REL-06.md) at `complete`.
- [DATA-09](DATA-09.md) at `complete`.
- [DATA-10](DATA-10.md) at `implemented` (or `complete`).

**Needed to activate:**

No additional task-wide activation dependency. For external execution, the implementation prerequisites and environment gate in the runbook must already be satisfied.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: package.json; .github/workflows/deploy.yml; worker/README.md. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Record per-store go/no-go decisions and operational owner training
- [ ] Rehearse restore plus frontend/Worker rollback with accepted post-cutover writes
- [ ] Record monitored results and any explicitly excluded/deferred work
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Record per-store go/no-go decisions and operational owner training. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Rehearse restore plus frontend/Worker rollback with accepted post-cutover writes. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Record monitored results and any explicitly excluded/deferred work. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- Use only the environment-confirmed operations linked below. OP-07 includes the existing read-only `npm run scheduler:verify -- <verified-api-base>` probe, which is insufficient alone for new services. Exact D1/R2/migration/restore probes are future deliverables from DATA-02/07/10; inspect their help/dry-run output before use.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

Required operations: [OP-05](../external-operations.md#op-05), [OP-06](../external-operations.md#op-06), [OP-07](../external-operations.md#op-07), [OP-08](../external-operations.md#op-08). Access: verified Cloudflare account operator with the least access needed for the named resources/deployments; GitHub Pages maintainer for frontend publication where listed. Environment: isolated non-production first, then explicitly selected production slices. Check actual account, resource IDs, KV binding, compatible schema, pinned Worker artifact, and environment API base before running operations. For schema-free changes record OP-03 as not applicable with evidence.

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
- Blockers: Listed prerequisites are pending.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.
