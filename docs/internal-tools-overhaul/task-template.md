# Task brief template

Copy to `tasks/PREFIX-NN.md`; replace every placeholder before assigning. The 84 initial briefs are canonical examples. Future splits use a stable parent outcome reference and update coverage/tracker/dependencies together. Placeholder metadata below is a template, not an additional task.

```yaml
id: PREFIX-NN
parent: PREFIX
# For a split, use the original outcome ID as parent.
title: "Concrete independently deliverable outcome"
priority: P0
delivery_class: CODE_ONLY
status: planned
owner: unassigned
implementation_dependencies: []
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
```

## Outcome and scope

State the observable resulting behavior, required behavior, explicit exclusions, and existing capabilities to preserve. Distinguish repository completion from actual publication.

## Current behavior and verified sources

Link exact existing source files and name relevant symbols/routes; record inspection date. Separate source observations from live observations and proposals. Link supporting research rather than repeating vendor descriptions.

## Dependencies and coordination

**Needed to implement:** list IDs, links, required milestones, and the reason each is necessary. Use none when independent.

**Needed to activate:** list IDs, environment gates, and whether staging or production completion is required. Local fixtures should permit work before activation when possible.

Link shared contracts, affected code areas, and record families. Name owners for shared files, migration numbers, API changes, dictionaries, and release artifacts.

## Implementation checklist

- [ ] Deliver the specific artifact/behavior with preserved compatibility.
- [ ] Implement failure/recovery behavior and applicable contract checks.
- [ ] Update shared contracts, canonical evidence, and tracker.

## Acceptance checklist

- [ ] For each specific scenario: record input, expected result, observed result, and evidence.
- [ ] Verify preserved behavior and explicit exclusions.
- [ ] Cover language/device/output/recovery requirements with evidence or a reasoned not-applicable entry.

## English/Spanish, devices, output, and recovery

Specify translated labels/errors/statuses, language switching without data changes, keyboard focus and tap alternatives, shared-device context and draft labels, print/output language and pagination, offline/timeout/retry/conflict recovery. Backend tasks specify the corresponding consumer contract. Do not replace task-specific scenarios with a generic accessibility checkbox.

## Verification commands and expected results

List existing commands verified in package.json, future commands explicitly labeled as future deliverables, fixtures, manual scenarios, and expected results. Identify local/staging API configuration and avoid production mutation fallbacks.

## External operations, access, evidence, and rollback

For each operation: link the runbook ID, target environment, prerequisites, required access, exact command or dashboard procedure, expected result, evidence, rollback, and affected task IDs. State none when no external operation is required. Identify frontend publication separately. CODE_AND_EXTERNAL tasks require deployed behavior evidence for their own scenarios.

## Milestones

| Milestone | State | Evidence |
| --- | --- | --- |
| Implementation | pending | Artifact/commit or decision/protocol |
| Local verification | pending | Checks and scenarios |
| External activation | not_applicable | Change to pending for external work; environment and operation evidence |
| Live verification | not_applicable | Change to pending for external work; observed behavior |

## Handoff evidence

Record commits/artifacts, checks performed, remaining steps, blockers, environment-specific evidence, rollback readiness, and next owner/action. At creation, explicitly state no implementation or external work has occurred.

## Deferred activation criteria

For deferred work, state the observable trigger, owner approval, implementation and activation dependencies, and required access. Explicitly prevent it from gating unrelated baseline improvements.
