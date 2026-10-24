---
id: IMPORT-03
parent: IMPORT
title: "Preserve inputs and repeat downloads"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [IMPORT-01, IMPORT-02]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# IMPORT-03 — Preserve inputs and repeat downloads

## Outcome and scope

Retain successful inputs and reviewed results until an explicit Start next report action.

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

- [IMPORT-01](IMPORT-01.md) and [IMPORT-02](IMPORT-02.md) at `implemented` (or `complete`): source validation and the sales review snapshot are reused. Both are locally complete.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/SalesConverter.tsx; src/components/internal/HoursConverter.tsx; src/components/internal/Bookkeeping.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Download the same reviewed output twice without a new upload
- [x] Warn before replacing inputs or starting another report
- [x] Distinguish session memory from recoverable local storage and report storage failure
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Download the same reviewed output twice without a new upload. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Warn before replacing inputs or starting another report. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Distinguish session memory from recoverable local storage and report storage failure. Record fixture/input, expected result, actual result, and evidence.
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
- Add focused fixture/behavior checks where this outcome introduces a new contract. `npm run imports:test` now includes 31 focused validation/review/recovery tests; the guide below records the exact browser commands and observed outcomes.
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

- Artifacts: versioned import snapshots, shared workbook byte/checksum/download helper, device-copy panel, source replacement confirmation, retained sales/hours editors and generated-output refactor. Full acceptance/commands: [retained imports guide](../retained-imports.md).
- Scenario 1: repeated actual sales/hours downloads have identical SHA-256/bytes and filename without re-upload; cached output also works offline. Source/template generation and established Excel mapping/layout remain covered by real-workbook fixtures.
- Scenario 2: Replace and Start next report warn; keyboard/Escape cancel preserves files/values/review/output, confirm clears only the current editor and returns focus. Device copies remain untouched.
- Scenario 3: explicit session-versus-device state, optional labeled snapshots, reload/resume without original uploads, quota failure preserving memory/prior copies and independent resumed editor UUIDs/source lineage pass. Source/schema/context and checksum failures never silently replace working data; original raw sources remain recoverable.
- Checks: imports 31/31, dictionary 3/3, TypeScript/build/SEO/diff checks PASS. Three final local Chromium flows PASS: retention, sales review, source validation. Covers English/Spanish, keyboard/touch, phone, reload, denied storage, separate editors, print and failed export/retry. Synthetic loopback only.
- Milestones: I/L done; E/V not applicable. No Worker/resource/data operation, publication or staff approval. Device copies are not shared/server import history.
- Owner/action: Codex completed this bounded task; STOP after PR creation per the user. No next task claimed. Future import date work uses the scoped delegation documented in [service session](../imports-session.md); do not merge current PRs.
- Rollback: scoped revert plus separately authorized compatible frontend publication if live; preserve device draft keys and original source files.
