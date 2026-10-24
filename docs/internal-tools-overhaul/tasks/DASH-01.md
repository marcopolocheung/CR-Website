---
id: DASH-01
parent: DASH
title: "Define the outstanding-work summary contract"
priority: P0
delivery_class: CODE_ONLY
status: ready
owner: unassigned
implementation_dependencies: [DATA-01]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
---

# DASH-01 — Define the outstanding-work summary contract

## Outcome and scope

Provide typed summary inputs and fixtures derived from real service records.

Preserve manager-gated cash summaries and public/private boundaries. Derive outstanding work from service records; do not create an unrelated manually maintained checklist or expose private records publicly.

## Current behavior and verified sources

Dashboard links to bookkeeping, inventory, scheduler, and forms, then displays manager-gated cash summaries from cash-out history. Missing-cash-out links open a general bookkeeping tab; other outstanding-work services and exact-record navigation are absent.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/Dashboard.tsx](<../../../src/components/internal/Dashboard.tsx>)
- [src/lib/dashboard.ts](<../../../src/lib/dashboard.ts>)
- [src/lib/cashout-store.ts](<../../../src/lib/cashout-store.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [DATA-01](DATA-01.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/Dashboard.tsx; src/lib/dashboard.ts; src/lib/cashout-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Include stable source record/revision, store/date/station, status, count, and target link
- [ ] Model unavailable, missing, empty, and stale inputs separately
- [ ] Keep cash summary compatibility and prohibit a separately maintained checklist
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Include stable source record/revision, store/date/station, status, count, and target link. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Model unavailable, missing, empty, and stale inputs separately. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Keep cash summary compatibility and prohibit a separately maintained checklist. Record fixture/input, expected result, actual result, and evidence.
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
- `npm run cashout:test` covers existing cash-out, dashboard, and inventory helpers; expect current parity checks to pass.
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
- Blockers: Listed prerequisites are pending.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.
