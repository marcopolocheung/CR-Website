---
id: DATA-04-IMPORT
parent: DATA-04
title: "Persist reviewed import directory snapshots"
priority: P1
delivery_class: CODE_AND_EXTERNAL
status: implemented
owner: Codex
implementation_dependencies: [DATA-02, DATA-05, DEC-04-IMPORT]
activation_dependencies: [DATA-03, REL-03, DATA-09, REL-04]
implementation: done
local_verification: done
external_activation: pending
live_verification: pending
---

# DATA-04-IMPORT — Persist reviewed import directory snapshots

This independently deliverable import slice retains stable parent [DATA-04](DATA-04.md). It does not complete the parent's wider policy or service work. User authorization: six import PRs and the scoped import defaults approved on 2026-10-24. Codex coordinates all shared files in the single import worktree.

Scope, exact acceptance scenarios, interface, limitations and recovery: [import-identity.md](../import-identity.md). Preserve legacy data, source snapshots and names; no automatic identity merge, payroll recalculation, raw upload or disposal. A server save requires an authoritative response; local/device work is separately labelled. No credentials in persisted data. External activation and live verification remain separate.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Linked scoped artifact. |
| Local verification | done | Linked scenario/test evidence. |
| External activation | pending | Separately authorized deployment/cutover. |
| Live verification | pending | Observed deployed scenarios. |

## Handoff evidence

- Scope/artifacts: [import-identity.md](../import-identity.md); Codex is the coordinating owner for touched shared files.
- Checks/evidence: 2 real local D1/router tests, atomic conflict/replay/history, 128 scheduler/Worker tests, build, types, SEO and bilingual mapping browser acceptance passed. Local synthetic fixtures only; no live-system claim.
- Implementation and local verification: done. External/live: pending; activation dependencies remain required.
- Recovery/rollback and acceptance scenarios are recorded in the linked guide. Preserve prior records and drafts when reverting scoped changes.
- Next owner/action: Codex continues the user-authorized six-PR import stack in one worktree. Open PRs only; no merging or auto-merge.
