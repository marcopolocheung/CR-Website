---
id: SCH-08
parent: SCH
title: "Verify existing scheduler and public compatibility"
priority: P0
delivery_class: CODE_ONLY
status: ready
owner: unassigned
implementation_dependencies: []
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
---

# SCH-08 — Verify existing scheduler and public compatibility

## Outcome and scope

Capture regression evidence for copying, locks, undo, visibility, printing, public reads, and encrypted legacy links.

Preserve copy, locks, undo, visibility, generation/independent validation, public staff links, prints, and schedule-only station restrictions. Personal notifications and advanced solver replacement remain deferred.

## Current behavior and verified sources

The scheduler already supports generation, independent validation, locks/manual assignments, prior-week copying, undo, hour summaries, draft/live status, visibility, printing, and person filtering. Published golden weeks use station-scoped KV with revisions; staff/employee lists remain station scoped. Dedicated dated-request/publication-history services are absent.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/scheduler/SchedulerDemo.tsx](<../../../src/components/scheduler/SchedulerDemo.tsx>)
- [src/components/scheduler/PublishPanel.tsx](<../../../src/components/scheduler/PublishPanel.tsx>)
- [src/components/scheduler/StaffEditor.tsx](<../../../src/components/scheduler/StaffEditor.tsx>)
- [src/lib/scheduler/validator.ts](<../../../src/lib/scheduler/validator.ts>)
- [src/components/schedule/ScheduleViewer.tsx](<../../../src/components/schedule/ScheduleViewer.tsx>)
- [worker/src/index.ts](<../../../worker/src/index.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

None. This task can be claimed independently within the stated scope.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/scheduler/SchedulerDemo.tsx; src/components/scheduler/PublishPanel.tsx; src/components/scheduler/StaffEditor.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Exercise all four stations and CR3 Kitchen special crew/rule paths
- [ ] Verify hidden weeks, spanning-month revisions, and default-station legacy fallbacks
- [ ] Retain independent solver/validator tests and capture old-link round trips
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Exercise all four stations and CR3 Kitchen special crew/rule paths. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Verify hidden weeks, spanning-month revisions, and default-station legacy fallbacks. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Retain independent solver/validator tests and capture old-link round trips. Record fixture/input, expected result, actual result, and evidence.
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
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

No resource creation, binding change, migration execution, or Worker deployment is needed for this task. Verify locally; ordinary frontend publication is tracked by [REL-04](REL-04.md). This task reaching complete does not mean its frontend is live. Rollback: revert the scoped repository commit; retain any existing drafts and compatible record readers.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | pending | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | pending | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | not_applicable | No external operation in this task; frontend publication is REL-04. |
| Live verification | not_applicable | Covered by shared release/acceptance tasks where applicable. |

## Handoff evidence

- Commits/artifacts: none; this brief is planning documentation.
- Checks performed: source inspection only; implementation scenarios not run.
- Remaining steps: claim task, verify prerequisites, execute applicable checklists, and record milestone evidence.
- Blockers: None established; verify access/context before work.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.
