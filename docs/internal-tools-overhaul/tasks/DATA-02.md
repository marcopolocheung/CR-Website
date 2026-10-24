---
id: DATA-02
parent: DATA
title: "Add D1 migrations, local configuration, and fixtures"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [DATA-01]
activation_dependencies: []
implementation: done
local_verification: done
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

- [x] Model relational record families, foreign keys, revision constraints, and legacy lineage
- [x] Apply migrations to an empty local database and upgrade a prior fixture snapshot
- [x] Keep unknown policy values nullable or disabled and require no remote resources
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Model relational record families, foreign keys, revision constraints, and legacy lineage. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Apply migrations to an empty local database and upgrade a prior fixture snapshot. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Keep unknown policy values nullable or disabled and require no remote resources. Record fixture/input, expected result, actual result, and evidence.
- [x] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [x] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [x] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [x] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [x] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [x] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

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
| Implementation | done | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | done | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | not_applicable | No external operation in this task; frontend publication is REL-04. |
| Live verification | not_applicable | Covered by shared release/acceptance tasks where applicable. |

## Handoff evidence

- Artifacts: [local development/schema guide](../../../worker/LOCAL_DATA.md), migrations 0001/0002, local-only config and generated binding types, two fixture snapshots, `worker/local-data.test.mjs`, pinned Wrangler/runtime types and package scripts. DATA-01 prerequisite is verified in PR #132.
- Scenario 1: local D1 contains all record families and relationships; tests reject invalid revisions, orphan employees, cross-store stations/catalogs, unsafe/fractional cents and missing policy approvals. Foreign-key checks return no violations.
- Scenario 2: `npm run data:test`, 2/2 integration tests pass, covering empty migration plus prior 0001 fixture upgraded to 0002 without changing original records, Spanish names, zero/null values or lineage. Local KV metadata/value and private R2 bytes round-trip. `npm run data:migrate:local` applies both migrations; repeat reports no migrations to apply.
- Scenario 3: fixtures seed no approved policy. Unit encoding stays null/disabled; submitted close and reviewed employee mapping are rejected without required context. Failed batched update/constraint rolls back the earlier amount change; original source remains available.
- Other checks (isolated worktree, 2026-10-24): generated binding `wrangler types ... --check` passes; `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check` pass; scheduler/Worker 128/128 and cash-out/dashboard/inventory 13/13 tests pass. Worker runtime names are scoped to avoid changing frontend Response types. Initial SQL exec-loader and type-global issues were fixed and checks rerun.
- I/L/E/V: done/done/not_applicable/not_applicable. Only isolated local simulated storage was written. No resource provisioning, production migration, Worker deployment, frontend publication or live check occurred. Production config/legacy routes/mirror remain unchanged.
- Device/translation/print: schema-only, no UI/gesture or shared-device persistence change; snapshots preserve original narrative/labels and raw units for consuming tasks. No credentials are seeded or retained.
- Remaining steps: future DATA-03/08/09 and REL-03 must verify actual account/bindings, target runtime and migration/restore evidence separately. Wrangler 4.86.0 supports local Node 20; local simulator may cap the requested compatibility date and does not establish deployed runtime parity. No cloud action is authorized by this task. Local recovery preserves wanted state before a fresh simulation; failed migrations/transactions roll back. Details in local guide.
- Next owner/action: Codex continues DATA-05. Migrations 0001/0002 reserved; next available number 0003. DATA-05 and external-only DATA-03 become eligible at implementation gates; DATA-03 remains outside this session's authorized external scope.
