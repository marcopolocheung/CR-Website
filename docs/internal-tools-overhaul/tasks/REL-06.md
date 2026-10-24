---
id: REL-06
parent: REL
title: "Pilot workflows and record defects"
priority: P1
delivery_class: USABILITY
status: planned
owner: unassigned
implementation_dependencies: [REL-05]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: pending
live_verification: pending
---

# REL-06 — Pilot workflows and record defects

## Outcome and scope

Run a scoped store pilot with selected activated workflows and a triaged defect log.

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

- [REL-05](REL-05.md) at `complete`.

**Needed to activate:**

No additional task-wide activation dependency. For external execution, the implementation prerequisites and environment gate in the runbook must already be satisfied.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: package.json; .github/workflows/deploy.yml; worker/README.md. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Name the store, shifts, pilot owners, included tasks, and fallback procedures
- [ ] Record defects with reproduction steps, language/device/context, severity, and task owner
- [ ] Agree exit criteria and retest blockers before expanding
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Name the store, shifts, pilot owners, included tasks, and fallback procedures. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Record defects with reproduction steps, language/device/context, severity, and task owner. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Agree exit criteria and retest blockers before expanding. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- Use OP-09 and the selected release artifact. Existing `npm run scheduler:test` and `npm run cashout:test` results are entry evidence, not substitutes for observed staff tasks. Record expected versus observed results for each scenario below.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

Access: participating English/Spanish staff, pilot manager, shared computer/tablet, printer, and the selected activated build. Run [OP-09](../external-operations.md#op-09), record consented observations without personnel secrets, and link defects and acceptance. Rollback: stop the session/pilot, preserve test evidence and drafts, and use the agreed paper/current-workflow fallback; infrastructure rollback belongs to OP-08.

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
