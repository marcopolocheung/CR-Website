---
id: IMPORT-06
parent: IMPORT
title: "Map employee IDs and show unmatched rows"
priority: P1
delivery_class: CODE_AND_EXTERNAL
status: implemented
owner: Codex
implementation_dependencies: [IMPORT-05, DATA-04-IMPORT]
activation_dependencies: [DATA-03, REL-03, DATA-09, REL-04]
implementation: done
local_verification: done
external_activation: pending
live_verification: pending
---

# IMPORT-06 — Map employee IDs and show unmatched rows

## Outcome and scope

Persist reviewed external-ID mappings and make every unmatched row visible.

Preserve current Excel layouts and manual CSV/XLSX uploads using existing ExcelJS/Papa Parse. Do not silently discard unmatched rows, recompute payroll policy, require Toast API access, or install paid tooling.

## Current behavior and verified sources

SalesConverter has general/lunch/dinner upload slots, separately selected weekday/date, existing workbook mapping, optional cash-out fill, and clears files after success. parseCsvAndExport groups by Employee External Id and silently skips missing IDs; selected dates label output without filtering rows. There is no persisted import identity/history.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/SalesConverter.tsx](<../../../src/components/internal/SalesConverter.tsx>)
- [src/components/internal/HoursConverter.tsx](<../../../src/components/internal/HoursConverter.tsx>)
- [src/components/internal/Bookkeeping.tsx](<../../../src/components/internal/Bookkeeping.tsx>)
- [src/lib/converter/parseToast.js](<../../../src/lib/converter/parseToast.js>)
- [src/lib/converter/parseCSV.js](<../../../src/lib/converter/parseCSV.js>)
- [src/lib/converter/fillTemplate.js](<../../../src/lib/converter/fillTemplate.js>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [IMPORT-05](IMPORT-05.md) at `implemented` (or `complete`).
- [DATA-04-IMPORT](DATA-04-IMPORT.md) at `implemented`: the reviewed import directory slice. Wider DATA-04 remains pending; imports do not activate personnel administration.

**Needed to activate:**

- [DATA-03](DATA-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-03](REL-03.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [DATA-09](DATA-09.md) at `complete` for production completion; implementation may proceed with local fixtures.
- [REL-04](REL-04.md) at `complete` for production completion; implementation may proceed with local fixtures.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/SalesConverter.tsx; src/components/internal/HoursConverter.tsx; src/components/internal/Bookkeeping.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Keep rows lacking Employee External Id in the review and exception totals
- [x] Require explicit mapping for same-name people and record provenance
- [x] Reconcile included/excluded rows without silently dropping hours
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Keep rows lacking Employee External Id in the review and exception totals. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Require explicit mapping for same-name people and record provenance. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Reconcile included/excluded rows without silently dropping hours. Record fixture/input, expected result, actual result, and evidence.
- [x] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [x] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [x] Translate visible labels, field errors, confirmations, statuses, and empty states with stable keys; language switching preserves record identity and entered values.
- [x] Complete the relevant flow by keyboard and touch; retain visible focus, dialog focus recovery, readable wrapped Spanish, and generous frequent-action targets.
- [x] Print/output: preserve familiar existing reports and downloads, show store/date/status, and check long Spanish and pagination where output is affected; otherwise record why print is unaffected.
- [x] Recovery: exercise interrupted work, denied storage or authorization, late responses, retries, and a second editor where applicable; never label local-only work as server saved.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- `npm run scheduler:test` includes the existing Worker tests; expect all relevant cases to pass.
- Add focused fixture/behavior checks where this outcome introduces a new contract. No `imports:test`, `forms:test`, D1 migration runner, or Worker build script exists yet; exact new commands and fixtures are future deliverables and must be recorded in handoff.
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

Required operations: [OP-03](../external-operations.md#op-03), [OP-04](../external-operations.md#op-04), [OP-05](../external-operations.md#op-05), [OP-07](../external-operations.md#op-07), [OP-08](../external-operations.md#op-08), [OP-06](../external-operations.md#op-06). Access: verified Cloudflare account operator with the least access needed for the named resources/deployments; GitHub Pages maintainer for frontend publication where listed. Environment: isolated non-production first, then explicitly selected production slices. Check actual account, resource IDs, KV binding, compatible schema, pinned Worker artifact, and environment API base before running operations. For schema-free changes record OP-03 as not applicable with evidence.

Evidence specific to this task: the three task scenarios above must pass against the deployed service, with redacted request/result, record ID/revision, environment, artifact version, operator, and UTC time. Record staging and production separately. Rollback: OP-08 restores the last compatible artifact/bindings and reconciles accepted writes; do not delete D1/R2 or detach the original KV. Export preserved records first if the change created new data. Frontend consumers, when changed, publish through REL-04 after compatible backend activation; retain an old-client/absent-capability path until then.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | done | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | pending | Environment, operation IDs, deployment/resource evidence, or staff-session execution. |
| Live verification | pending | Observed target-environment behavior or staff acceptance with date and operator. |

## Handoff evidence

- Scope/artifacts: [import-identity.md](../import-identity.md); Codex is the coordinating owner for touched shared files.
- Checks/evidence: 41 import tests; 2 local D1 tests; 128 scheduler tests; build/types/SEO/dictionaries; mapping, retention and hours-preview browser flows passed. Local synthetic fixtures only; no live-system claim.
- Implementation and local verification: done. External/live: pending; activation dependencies remain required.
- Recovery/rollback and acceptance scenarios are recorded in the linked guide. Preserve prior records and drafts when reverting scoped changes.
- Next owner/action: Codex continues the user-authorized six-PR import stack in one worktree. Open PRs only; no merging or auto-merge.
