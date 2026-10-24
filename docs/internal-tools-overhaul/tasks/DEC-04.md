---
id: DEC-04
parent: DEC
title: "Define shared employee identity and station membership"
priority: P0
delivery_class: DECISION
status: ready
owner: unassigned
implementation_dependencies: []
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
---

# DEC-04 — Define shared employee identity and station membership

## Outcome and scope

Define who owns shared IDs, how duplicate names and rehires are resolved, memberships, temporary cashiers, external-ID mapping, and optional hour targets.

Current policy remains in force until the approved affected implementation activates. This task does not grant authority to change financial procedure or personnel data.

## Current behavior and verified sources

Policy inputs are embedded or incomplete: FLOAT_CENTS is 10000, dates are selected in individual screens, station rosters are separate, inventory uses SUP/Use text, and saved write-ups have signature text fields. Source files establish behavior, not approved business policy.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/lib/cashout.ts](<../../../src/lib/cashout.ts>)
- [src/data/restaurants.ts](<../../../src/data/restaurants.ts>)
- [src/lib/inventory.ts](<../../../src/lib/inventory.ts>)
- [worker/src/index.ts](<../../../worker/src/index.ts>)
- [src/app/(order-shell)/internal/forms/page.tsx](<../../../src/app/(order-shell)/internal/forms/page.tsx>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

None. This task can be claimed independently within the stated scope.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/lib/cashout.ts; src/data/restaurants.ts; src/lib/inventory.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Review anonymized ambiguous roster examples without automatically matching names
- [ ] Approve membership and mapping correction workflow
- [ ] Decide whether hour targets are enabled and their values or explicitly disabled
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Review anonymized ambiguous roster examples without automatically matching names. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Approve membership and mapping correction workflow. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Decide whether hour targets are enabled and their values or explicitly disabled. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- No application build is required. Read the linked sources and check each approved example against the proposed contract; record unresolved subquestions and the affected IDs. Confirm implementation and activation dependency updates remain acyclic.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

No deployment is required. Access: the business/product owner and affected staff, plus approved sample records/templates. Review the documented options and examples, record the named approver/date and scoped answer, and link affected tasks. Evidence: signed-off decision record. Reversal: supersede the decision with a dated record and assess only affected tasks; do not silently rewrite prior policy. No live system claim follows from approval.

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
