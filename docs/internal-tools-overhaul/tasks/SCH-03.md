---
id: SCH-03
parent: SCH
title: "Apply approved exceptions to generation and validation"
priority: P1
delivery_class: CODE_ONLY
status: implemented
owner: Claude
implementation_dependencies: [SCH-01]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# SCH-03 — Apply approved exceptions to generation and validation

## Outcome and scope

Use approved dated exceptions in both schedule generation and independent manual validation.

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

- [SCH-01](SCH-01.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/scheduler/SchedulerDemo.tsx; src/components/scheduler/PublishPanel.tsx; src/components/scheduler/StaffEditor.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Test approved versus pending/declined requests against identical shifts
- [x] Report actionable coverage warnings and keep suspension separate
- [x] Preserve existing solver constraints, locking, and manual assignment recovery
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Test approved versus pending/declined requests against identical shifts. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Report actionable coverage warnings and keep suspension separate. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Preserve existing solver constraints, locking, and manual assignment recovery. Record fixture/input, expected result, actual result, and evidence.
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
- `npm run scheduler:test` includes the existing Worker tests; expect all relevant cases to pass.
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

- Artifacts/evidence: [schedule-requests.md](../schedule-requests.md#sch-03-approved-exceptions-in-scheduling); `withApprovedRequests` in `src/lib/scheduler/requests.ts`, dated lookup in `validator.ts`, scheduler integration and messages.
- Local checks: scheduler 129 (new SCH-03 scenario test), request domain/client 5; build, types, SEO pass. Request browser suite and existing scheduler-view browser suite pass with synthetic loopback fixtures.
- Implementation/local verification done; no external operation. Frontend publication follows REL-04 after SCH-01/02 backend activation.
- Approved exceptions are derived per displayed week and never written into the saved staff list, published week or print output.
- Next: SCH-04 (publication revisions) is independent of this slice.
