---
id: DEC-03-IMPORT
parent: DEC-03
title: "Approve reviewed import history without raw uploads or disposal"
priority: P1
delivery_class: DECISION
status: complete
owner: Codex
implementation_dependencies: []
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# DEC-03-IMPORT — Approve reviewed import history without raw uploads or disposal

This independently deliverable import slice retains stable parent [DEC-03](DEC-03.md). It does not complete the parent's wider policy or service work. User authorization: six import PRs and the scoped import defaults approved on 2026-10-24. Codex coordinates all shared files in the single import worktree.

Scope, exact acceptance scenarios, interface, limitations and recovery: [import-history.md](../import-history.md). Preserve legacy data, source snapshots and names; no automatic identity merge, payroll recalculation, raw upload or disposal. A server save requires an authoritative response; local/device work is separately labelled. No credentials in persisted data. External activation and live verification remain separate.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Linked scoped artifact. |
| Local verification | done | Linked scenario/test evidence. |
| External activation | not_applicable | No external operation. |
| Live verification | not_applicable | No live claim. |

## Handoff evidence

- Scope/artifacts: [import-history.md](../import-history.md); Codex is the coordinating owner for touched shared files.
- Checks/evidence: User-approved reviewed-values/fingerprints scope, no raw upload/disposal; documented boundaries and reversal; 45 import and 4 local D1 tests passed. Local synthetic fixtures only; no live-system claim.
- Implementation and local verification: done. External/live: not applicable; frontend publication remains separate.
- Recovery/rollback and acceptance scenarios are recorded in the linked guide. Preserve prior records and drafts when reverting scoped changes.
- Next owner/action: Codex continues the user-authorized six-PR import stack in one worktree. Open PRs only; no merging or auto-merge.
