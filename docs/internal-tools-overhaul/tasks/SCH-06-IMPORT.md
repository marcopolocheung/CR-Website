---
id: SCH-06-IMPORT
parent: SCH-06
title: "Read published schedule estimates for import comparison"
priority: P1
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [DATA-04-IMPORT, DEC-01, DEC-04-IMPORT]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# SCH-06-IMPORT — Read published schedule estimates for import comparison

This independently deliverable import slice retains stable parent [SCH-06](SCH-06.md). It does not complete the parent's wider policy or service work. User authorization: six import PRs and the scoped import defaults approved on 2026-10-24. Codex coordinates all shared files in the single import worktree.

Scope, exact acceptance scenarios, interface, limitations and recovery: [scheduled-actual.md](../scheduled-actual.md). Preserve legacy data, source snapshots and names; no automatic identity merge, payroll recalculation, raw upload or disposal. A server save requires an authoritative response; local/device work is separately labelled. No credentials in persisted data. External activation and live verification remain separate.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Linked scoped artifact. |
| Local verification | done | Linked scenario/test evidence. |
| External activation | not_applicable | No external operation. |
| Live verification | not_applicable | No live claim. |

## Handoff evidence

- Scope/artifacts: [scheduled-actual.md](../scheduled-actual.md); Codex is the coordinating owner for touched shared files.
- Checks/evidence: Read-only publication/combined-estimate slice; 52 import tests, 5 local Worker tests, 128 scheduler tests, build/types/SEO/dictionaries, packaging and comparison/PDF browser acceptance passed. Local synthetic fixtures only; no live-system claim.
- Implementation and local verification: done. External/live: not applicable; frontend publication remains separate.
- Recovery/rollback and acceptance scenarios are recorded in the linked guide. Preserve prior records and drafts when reverting scoped changes.
- Next owner/action: Codex continues the user-authorized six-PR import stack in one worktree. Open PRs only; no merging or auto-merge.
