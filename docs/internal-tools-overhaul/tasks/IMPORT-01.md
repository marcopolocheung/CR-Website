---
id: IMPORT-01
parent: IMPORT
title: "Validate source files with actionable errors"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [UX-01, UX-03, UX-06]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# IMPORT-01 — Validate source files with actionable errors

## Outcome and scope

Validate current sales and hours inputs before conversion and show a specific remedy.

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

- [UX-01](UX-01.md), [UX-03](UX-03.md), and [UX-06](UX-06.md) at implemented (or complete): the current converters reuse dictionaries, field-error controls and navigation protection. All are locally complete in the preceding stack.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/SalesConverter.tsx; src/components/internal/HoursConverter.tsx; src/components/internal/Bookkeeping.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Check empty, malformed, wrong-report, missing-column, and bad-number inputs
- [x] Keep three labeled sales slots with filenames and Replace actions
- [x] Preserve good inputs when one slot fails and expose row-level CSV problems
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Check empty, malformed, wrong-report, missing-column, and bad-number inputs. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Keep three labeled sales slots with filenames and Replace actions. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Preserve good inputs when one slot fails and expose row-level CSV problems. Record fixture/input, expected result, actual result, and evidence.
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
- Add focused fixture/behavior checks where this outcome introduces a new contract. This task adds `npm run imports:test` (14 focused source/export tests), `scripts/create-import-fixtures.ts`, and `scripts/test-import-validation.py`; the guide below records exact commands and results.
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

- Artifacts: `src/lib/converter/validation.ts`, updated `parseToast.js`/`parseCSV.js`, `SalesConverter.tsx`/`HoursConverter.tsx`, `SourceFileInput.tsx`, both dictionaries, synthetic fixtures and `scripts/test-import-validation.py`. Acceptance details and reproducible commands: [source validation guide](../import-validation.md).
- Checks: `npm run imports:test` 14/14; dictionary tests 3/3; TypeScript, static build and SEO passed. Targeted Chromium browser acceptance and existing language/feedback regressions all passed against the final code.
- Scenario 1: empty/unreadable/wrong/missing-column/bad-number sources block export; sheet/row/column and CSV-record evidence plus explicit remedies verified with synthetic fixtures.
- Scenario 2: three labeled sales slots, filenames and keyboard/touch Replace controls retained. Delayed old-file validation cannot replace the new result; duplicate submits start one generation.
- Scenario 3: failed slot/export preserves other files and metadata; missing-ID/bad-hour rows are reported without partial export. Actual generated workbooks preserve sales mapping and source hours layout/totals.
- Language/device/recovery: English/Spanish, keyboard/touch 390px layout, denied storage, offline hours generation, template failure/retry, focus, tab/language retention and print-locale return verified. There is no new protected import API or shared revision/second-editor state; credentials and staff identity mapping remain out of scope. Session-only retention and browser limitations are explicit in the guide.
- Milestones: implementation done; local verification done; external/live not applicable. No deployment, resource operation, real-data mutation or staff approval occurred. Frontend publication remains REL-04.
- Next: IMPORT-02 and IMPORT-03 are newly ready. IMPORT-05 still awaits DEC-01. No claim on the next task; stop after this PR per the user's instruction.
- Rollback: revert scoped repository change; preserve original sources and device draft keys; separate publication if already live.

## Claim and dependency coordination — 2026-10-24

Codex completed the bounded source-validation claim. Shared package script/dictionary edits were coordinated in this single task; no Worker routes, migrations or payroll/date policies changed. Prerequisite metadata now reflects actual reuse of already completed UX-01/03/06. Owner is Codex for completed evidence; the next task remains unassigned.
