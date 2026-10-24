---
id: DEC-04-IMPORT
parent: DEC-04
title: "Approve explicit identity mappings for imports"
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

# DEC-04-IMPORT — Approve explicit identity mappings for imports

This independently deliverable import slice retains stable parent [DEC-04](DEC-04.md). It does not complete the parent's wider policy or service work. User authorization: six import PRs and the scoped import defaults approved on 2026-10-24. Codex coordinates all shared files in the single import worktree.

Scope, exact acceptance scenarios, interface, limitations and recovery: [import-identity.md](../import-identity.md). Preserve legacy data, source snapshots and names; no automatic identity merge, payroll recalculation, raw upload or disposal. A server save requires an authoritative response; local/device work is separately labelled. No credentials in persisted data. External activation and live verification remain separate.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Linked scoped artifact. |
| Local verification | done | Linked scenario/test evidence. |
| External activation | not_applicable | No external operation. |
| Live verification | not_applicable | No live claim. |

## Handoff evidence

- Scope/artifacts: [import-identity.md](../import-identity.md); Codex is the coordinating owner for touched shared files.
- Checks/evidence: User-approved import scope; same-name, inactive/renamed and explicit correction scenarios verified in 41 import tests and 2 local D1 tests. Local synthetic fixtures only; no live-system claim.
- Implementation and local verification: done. External/live: not applicable; frontend publication remains separate.
- Recovery/rollback and acceptance scenarios are recorded in the linked guide. Preserve prior records and drafts when reverting scoped changes.
- Next owner/action: Codex continues the user-authorized six-PR import stack in one worktree. Open PRs only; no merging or auto-merge.
