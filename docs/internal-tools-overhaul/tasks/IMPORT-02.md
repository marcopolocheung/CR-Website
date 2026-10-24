---
id: IMPORT-02
parent: IMPORT
title: "Add sales previews and reconciliation"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Codex
implementation_dependencies: [IMPORT-01]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# IMPORT-02 — Add sales previews and reconciliation

## Outcome and scope

Split sales parsing, review, and workbook generation with visible extraction evidence.

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

- [IMPORT-01](IMPORT-01.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/SalesConverter.tsx; src/components/internal/HoursConverter.tsx; src/components/internal/Bookkeeping.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Show detected general/lunch/dinner reports and source section for each mapped figure
- [x] Flag missing or inconsistent sales/tax/payment/deposit totals before download
- [x] Compare the resulting workbook against known current-output fixtures
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Show detected general/lunch/dinner reports and source section for each mapped figure. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Flag missing or inconsistent sales/tax/payment/deposit totals before download. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Compare the resulting workbook against known current-output fixtures. Record fixture/input, expected result, actual result, and evidence.
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
- Add focused fixture/behavior checks where this outcome introduces a new contract. `npm run imports:test` now includes source validation and sales review/parity tests. Exact browser commands and outcomes are in the guide below.
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

- Artifacts: `src/lib/converter/sales-review.ts`, `SalesReview.tsx`, updated `SalesConverter.tsx`/`fillTemplate.js`, bilingual dictionaries, synthetic fixtures, `sales-review.test.ts`, `scripts/test-import-review.py` and updated validation browser flow.
- Acceptance and commands: [sales-review guide](../sales-review.md). Every 14 mapped source figure and four manual amount figures has row/header/raw-value/cell evidence; selected context and detected report sections are visible. Same-report arithmetic, missing totals/detail, cross-scope comparisons and unmapped coverage are flagged without inventing financial rules.
- Output: actual checked-in template's known filled cells, unchanged formulas/styles/sheets/page setup verified; no payroll/cash/date-policy change. Download follows explicit session acknowledgement of the prepared snapshot.
- Recovery: edits/replacement invalidate review; duplicate prepare/download coalesced; earlier cash-out result cannot overwrite newer input; template failure retains work. English/Spanish keyboard/touch phone/print and mounted-tab behavior pass. Session memory is explicit; no persisted/server review, new credentials or second-editor import API is claimed.
- Checks: `npm run imports:test` 23/23, dictionary tests 3/3, TypeScript/build/SEO/diff checks PASS. Four final Playwright flows PASS (review, validation, language, feedback), synthetic loopback only. No external/staff operation.
- Milestones: I/L done; E/V not applicable (CODE_ONLY). Frontend publication remains separate.
- Next owner/action: IMPORT-03 is ready and remains unassigned until claimed on the successor branch. User requested imports-first, then cash-out; open PRs only, leave unmerged. [Current service session/delegated date choices](../imports-session.md).
- Rollback: revert this scoped commit; preserve source files/device drafts; separately publish a compatible frontend only when authorized.
