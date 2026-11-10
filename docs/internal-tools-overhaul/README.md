# Internal-tools overhaul: agent-ready work package

**Current execution sequence:** use the [step-by-step implementation guide](implementation-guide.md), the [checkpoint template](checkpoint-template.md) and the approved [Night shift design bank](../design/internal-language/README.md). The new UX overhaul proceeds one verified, reviewed step at a time; writing the guide does not implement its steps or change existing task statuses.

For a fresh experience audit against main at `64ffc15` and a proposed design/feature overhaul, see the [November 10, 2026 usability report](../investigations/internal-tools-ux-2026-11-10.md). Its recommendations complement this package; dated inventory and status claims below are not a substitute for checking current source and individual task milestones.

Current cash scope is the owner-approved [DEC-02 bookkeeping notebook](cashout-rules.md): always retain $100 per cashier drawer, calculate Toast/Z differences and save figures for later lookup. CASH-04/05/06 operational workflows are deferred; ordinary saving/history remains baseline. Earlier research and handoff snapshots do not override this decision.

This package originally assigned 84 tasks for China Rose's English/Spanish internal product on shared computers and tablets. Its original delivery was documentation only. Since then, capabilities have been implemented in source; use current source, individual brief evidence and the tracker rather than treating this packaging snapshot as a current status claim. This design-bank and guide update performs no application change, migration, deployment or staff test.

Start with the [tracker](tracker.md), claim one [task brief](tasks/DATA-01.md), and follow the [agent working guide](agent-guide.md). Individual briefs are canonical; update the tracker at the same time. One numbered outcome has one file; no further splits are currently needed. Prefixes preserve the parent workstream. Future splits must retain a parent reference and explicit independently deliverable scope.

| Reference | Purpose |
| --- | --- |
| [Implementation guide](implementation-guide.md) | Current experience-overhaul sequence, acceptance scenarios and per-step review gates |
| [Checkpoint template](checkpoint-template.md) | Record actual checks, visual review, limitations and release evidence for each step |
| [Tracker](tracker.md) | Ownership, priorities, delivery classes, implementation/activation dependencies, statuses, and milestone views |
| [Agent working guide](agent-guide.md) | Claiming, shared-file coordination, prerequisite gates, validation, and handoff |
| [Task template](task-template.md) | Contract for new or split task briefs |
| [Current-state inventory](current-state.md) | Locally verified behavior, API/KV boundaries, preserved capabilities, and existing commands |
| [Target architecture/contracts](architecture-contracts.md) | Proposed D1/R2 interfaces and compatibility boundaries for independent implementation |
| [Bilingual UX reference](bilingual-ux.md) | English/Spanish, keyboard, touch, print, drafts, and recovery requirements |
| [External-operations runbook](external-operations.md) | Separate provision, bind, migrate, deploy, publish, live-check, and rollback procedures |
| [Research coverage](research-coverage.md) | Mapping of research recommendations, current capabilities, and optional scope |
| [Supporting research](../internal-tools-research.md) | Workflow evidence, vendor references, reuse choices, and license boundaries; retained without duplication |

## Delivery and completion

| Class | Meaning |
| --- | --- |
| CODE_ONLY | Repository changes and local verification, with no new backend deployment, resource, or account configuration. Frontend publication is separate. |
| CODE_AND_EXTERNAL | Repository work plus explicit external activation, such as Worker deployment, migrations, or bindings. |
| EXTERNAL_ONLY | Provisioning, deployment, migration execution, or environment verification. |
| DECISION | A specific business/product choice that gates only affected work. |
| USABILITY | Observed staff evaluation or operational acceptance. |

Statuses are `planned`, `ready`, `in_progress`, `blocked`, `implemented`, `complete`, and `deferred`. Four independently recorded milestones are implementation, local verification, external activation, and live verification. `implemented` requires code/artifact and local evidence. A task needing external activation reaches `complete` only after activation and live evidence. A local CODE_ONLY task can reach `complete` while its frontend publication remains pending in REL-04. Decisions need a named approval and examples; staff acceptance needs actual observations.

D1 is the target for business records; R2 is the target for attachments. Existing KV readers/links remain compatible through staged adapters and verified migration. Records are language independent. Existing file imports and free reusable components are the baseline; no paid calendar timeline, form designer, translation service, or Toast API entitlement is presumed. Refer to the research when evaluating a component and verify the exact adopted license/version during implementation.

## Original infrastructure delivery sequence

This earlier sequence explains infrastructure dependencies. Use the implementation guide above to order the new experience work; reconcile affected briefs during each step.

1. Claim independent foundations: DATA-01, UX-01, CASH-01, IMPORT-01, SCH-08, FORM-07, REL-01, or REL-02. Ready decisions can be resolved concurrently by their business owners. DATA-07 export tooling follows DATA-01 contracts.
2. Use the contracts to add local schema/configuration, shared controls, context, draft recovery, previews, and progress. Do not hold independent code behind unrelated policy decisions.
3. Activate non-production resources and a compatible Worker, rehearse selected migrations and restore, then cut over one approved service slice at a time. A slice manifest identifies exactly which features and policy decisions are required.
4. Publish a compatible frontend through REL-04; run bilingual staff evaluation and a scoped pilot before expanding. Rerun release tasks per release/slice with dated evidence; a prior release does not verify later changes.

No brief requires automatic agent spawning. Multiple owners may work independently after coordinating shared contracts/files. Authentication redesign, frontend hosting migration, Toast APIs, scanning, personal notifications, advanced optimization, and ordering/QR disposition remain separately deferred.

## Documentation verification

Use read-only checks for local Markdown targets and anchors, all expected IDs and counts, front-matter/tracker agreement, legal statuses/classes, dependency references/cycles, and pending milestones. Check the repository diff against the initial untracked files. Application builds are unnecessary for this documentation-only package. [Validation evidence](validation.md) records checks performed and limitations.
