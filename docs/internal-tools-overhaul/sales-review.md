# IMPORT-02 — sales extraction review and reconciliation

Sales now follows select/validate → prepare review → inspect/acknowledge → generate workbook. This is local CODE_ONLY completion; publication and staff/live acceptance remain separate. It builds on merged IMPORT-01 without changing its original workbook mapping.

## Reviewed evidence and arithmetic

`src/lib/converter/sales-review.ts` creates a session snapshot of the selected context, normalized manual amounts, 14 existing mapped source values and four manual amount values. Each figure includes its destination cell and original filename/slot/sheet/physical row/header/raw value. Optional missing card/discount rows visibly preserve the established zero behavior; missing manual amounts stay blank. Report structure establishes the available sections, not source authenticity or correct lunch/dinner/store/date coverage; the review explicitly asks the operator to verify scope.

Category checks compare each report's Total net sales/tax with all its detail rows, including categories outside FOOD/DRINK. Payment checks compare an available unique Total row with the five existing mapped cash/card figures. Missing totals/detail, unsafe arithmetic or fractional-cent values are not silently rounded into a successful check. Cross-report revenue/sales/payments and cash/deposit comparisons always require scope review, even if their numbers match: no new tax, float, adjustment, date or cash policy is inferred. Source figures are never automatically reconciled by rewriting them.

Unsupported payment rows and extra sales categories remain visible with their physical row/value and are identified as outside the unchanged mapping. The operator must acknowledge selected context, source figures, missing values, differences and coverage before download. This acknowledgement is a session action, not an authenticated review, persisted business approval or source validation guarantee.

Changing a form value or replacing a file invalidates the snapshot and acknowledgement. Preparation disables inputs and coalesces immediate double clicks; the resulting review owns copied primitive data rather than mutable workbook references. Downloads use exactly that reviewed context/map, preserve input on failure, and coalesce duplicate submits. Earlier cash-out fills cannot overwrite newer input or a prepared/downloaded snapshot. Locale/tab switches preserve the same snapshot and acknowledgement. No credentials are included in snapshots or storage.

`createFilledWorkbook` separates pure template filling from browser download so parity can be tested against the real checked-in template. Existing destination cells, English workbook labels, filename conventions, formulas, sheets, styles and page setup are preserved. Screen source tables scroll horizontally within the phone viewport; normal print switches the screen labels to the established English output and restores Spanish afterward.

## Evidence — 2026-10-24

- `npm run imports:test`: 23/23 PASS (14 validation + 9 review/parity tests). Includes all 18 figure traces; matching/different/missing sales/tax/payment/deposit checks; unmapped rows; fractional-cent rejection for reconciliation; independent snapshots; and the actual template's known cells, untouched formulas/styles/sheets/print setup.
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`: 3/3 PASS.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`: PASS.
- Python Playwright/Chromium: all four PASS — `test-import-review.py`, updated `test-import-validation.py`, existing `test-internal-language.py`, existing `test-internal-feedback.py`.
- Review browser scenarios: source/row/cell table and detected reports, arithmetic mismatch/match/missing and unmapped payment warnings, initial disabled download, keyboard acknowledgement, Spanish switching, invalidation on context/file changes (including same filename/new bytes), one three-file read set for duplicate prepare, frozen inputs during preparation, retained mounted tabs, print/phone layout, late cash-out suppression and successful workbook download. Existing validation flow still checks real downloaded cells, template failure/retry, duplicate export, denied storage and offline hours. All API traffic is synthetic loopback; production Worker requests fail tests.

Reproduce:

```bash
python3 /home/wslunusn/CR-Website/.codex/skills/webapp-testing/scripts/with_server.py \
  --server 'env NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- --hostname 127.0.0.1 --port 3017' \
  --port 3017 --timeout 60 -- \
  python3 scripts/test-import-review.py http://127.0.0.1:3017
```

## Remaining work and rollback

IMPORT-03 owns persisted/recoverable reviewed outputs, explicit Start next report and replacement warnings. IMPORT-04/05 own approved date boundaries, source date matching and hours ranges; IMPORT-06/07/08 own identity mapping, durable shared history and schedule comparison. No new import API, database mutation, source-file retention policy, staff approval or deployment is claimed here. Source files and review remain session memory; reload requires reselecting sources until recovery work is implemented.

Rollback is a scoped repository revert and, if live, separately authorized compatible frontend publication. Keep original files and device draft keys; no Worker resource, database migration or record cleanup is involved.
