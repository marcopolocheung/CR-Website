---
id: DATA-02
parent: DATA
title: "Add D1 migrations, local configuration, and fixtures"
priority: P0
delivery_class: CODE_ONLY
status: planned
owner: unassigned
implementation_dependencies: [DATA-01]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
---

# DATA-02 — Add D1 migrations, local configuration, and fixtures

## Outcome and scope

Add ordered D1 schema migrations and isolated local D1/R2 development configuration with synthetic fixtures.

Preserve legacy KV data, station defaults/fallbacks, encrypted link behavior, existing public/private boundaries, and old frontend response compatibility. Do not guess resource IDs, employee matches, supplier units, retention periods, or financial policies.

## Current behavior and verified sources

The Worker Env binds SCHEDULES (KV), with no D1/R2 bindings. Station schedule/roster/template writes read and compare rev/baseRev before KV puts; these are not atomic cross-request revision guarantees. Cash-out/count days have last-save-wins writes. There is no shared relational employee or attachment service.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [worker/src/index.ts](<../../../worker/src/index.ts>)
- [worker/wrangler.toml](<../../../worker/wrangler.toml>)
- [src/lib/schedule-store.ts](<../../../src/lib/schedule-store.ts>)
- [src/lib/employee-store.ts](<../../../src/lib/employee-store.ts>)
- [src/lib/inventory-store.ts](<../../../src/lib/inventory-store.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [DATA-01](DATA-01.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: worker/src/index.ts; worker/wrangler.toml; src/lib/schedule-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Model relational record families, foreign keys, revision constraints, and legacy lineage
- [ ] Apply migrations to an empty local database and upgrade a prior fixture snapshot
- [ ] Keep unknown policy values nullable or disabled and require no remote resources
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Model relational record families, foreign keys, revision constraints, and legacy lineage. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Apply migrations to an empty local database and upgrade a prior fixture snapshot. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Keep unknown policy values nullable or disabled and require no remote resources. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- `npm run scheduler:test` includes the existing Worker tests; expect all relevant cases to pass.
- `npm run cashout:test` covers existing cash-out, dashboard, and inventory helpers; expect current parity checks to pass.
- Add focused fixture/behavior checks where this outcome introduces a new contract. No `imports:test`, `forms:test`, D1 migration runner, or Worker build script exists yet; exact new commands and fixtures are future deliverables and must be recorded in handoff.
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
