---
id: DATA-01
parent: DATA
title: "Establish record and API compatibility contracts"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: []
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# DATA-01 — Establish record and API compatibility contracts

## Outcome and scope

Turn the proposed minimum interfaces into versioned shared types, adapters, and fixtures without deciding unresolved policy.

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

None. This task can be claimed independently within the stated scope.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: worker/src/index.ts; worker/wrangler.toml; src/lib/schedule-store.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Specify store/station/employee IDs, cents, dates, revisions, and error envelopes
- [x] Define additive old/new client compatibility and capability detection
- [x] Keep policy-dependent fields explicit and link their decision owners
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Specify store/station/employee IDs, cents, dates, revisions, and error envelopes. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Define additive old/new client compatibility and capability detection. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Keep policy-dependent fields explicit and link their decision owners. Record fixture/input, expected result, actual result, and evidence.
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

- Artifacts: [contract v1](../contract-v1.md), `src/lib/internal-tools/contracts.ts`, `compatibility.ts`, and `contracts.test.ts`. Codex owns the additive contract; existing Worker and client routes are untouched.
- Scenario 1: scalar fixtures accepted valid leap days, opaque IDs, safe integer cents/revisions and all four station mappings; rejected invalid dates, coercion and unsafe numbers (6 focused tests pass overall).
- Scenario 2: manifest fixtures accepted explicit atomic/idempotent v1 support, selected legacy only on 404, rejected invalid/unknown/unavailable manifests; seven synthetic legacy response families round-tripped unchanged, including hidden ciphertext, inherited roster/template, raw mixed units and original Spanish narrative.
- Scenario 3: all seven policy groups link DEC-01 through DEC-07 and remain unresolved; error/conflict fixtures retain rejected source context with language-independent codes.
- Checks (isolated local worktree, 2026-10-24): focused command in contract v1, 6/6 pass; `npm run scheduler:test`, 128/128 pass; `npm run cashout:test`, 13/13 pass; `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, and `git diff --check` pass. No new dependency. Installed Next package has no dist/docs; README inspected; no Next APIs changed.
- Keyboard/touch/shared-device and print: no UI, persistence or output change. Contract keeps source snapshots and separate actor labels; consuming owners must test their UI. Failure/reversal example is documented in contract v1 and tested through retained conflict input; no records or drafts are modified.
- Milestones I/L/E/V: done/done/not_applicable/not_applicable. No staging/production activation, cloud resources, migration, deployment or live check occurred.
- Remaining external actions: none for DATA-01. Future service owners implement discovery/routes before advertising them. Decisions remain unapproved. Rollback is revert of the additive modules/docs; legacy data and readers remain intact.
- Next owner/action: Codex continues DATA-02 from this PR head; DATA-07 and DASH-01 also become locally eligible. Source/tracker status is completion of local CODE_ONLY scope, not merge/publication.
