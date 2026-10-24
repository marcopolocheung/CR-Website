# IMPORT-01 — source validation and export boundary

Implemented locally on the ordered stack after UX-06. This is CODE_ONLY completion; no frontend publication, backend deployment, resource provisioning or live staff verification is implied.

## Behavior and preserved contracts

Sales still has three independent General/Lunch/Dinner slots, original filenames and explicit Replace controls. Each selected file is checked, then reread and revalidated before workbook generation. Empty/unreadable/wrong reports, missing/duplicate required headers, required or duplicate metric rows, blank/bad consumed numbers and spreadsheet error cells block export with localized sheet/physical-row/column evidence. A late read of a replaced file cannot overwrite the new result. The other files and entered metadata remain mounted. Generation disables its inputs and coalesces immediate duplicate submits. A template/network/generation failure retains all inputs and reports failure.

The existing `parseToast.js` cell mapping and English `daily-sales-template.xlsx` remain the output contract. Required sheets/headers follow that actual reader, rather than guessed report schemas. Absent credit-card brands and absent or empty optional Check Discounts still deliberately contribute zero. Cash-only Payments summary can omit the subtype column; credit rows require a usable subtype. Unused blank category cells are accepted; consumed blanks are not measured zero. USD source strings use complete decimal syntax with optional leading sign, `$` and conventional comma grouping; ambiguous separators and partial values fail rather than silently becoming zero. Optional manually entered deposit/difference fields are validated too, without changing their on-screen values. No cash, date-boundary or payroll policy is inferred.

The sales slot keeps its existing file chooser extensions, but the required named-sheet reports need Excel. A single CSV never satisfied the original multi-sheet reader; it now gets an explicit missing-sheet remedy. Manual employee-hours CSV remains supported. XLSX parsing is still the existing SheetJS dependency, and hours still uses Papa Parse and ExcelJS. No dependency/version/license change is introduced.

Hours validation checks the eight existing source columns, duplicate/missing headers, CSV parser errors and record widths, missing external ID/name, complete decimal source hours, and readable input/output timestamps. No rejected employee row is silently omitted, and no partial file is exported. CSV record numbers count the header and blank records; a quoted multiline field is one record, so these numbers are deliberately not claimed as physical line numbers. Original source bytes remain in the selected File. BOM, CRLF, quoted commas/newlines and extra/reordered columns are handled; the eight output columns are projected in their established order. Arbitrary source IDs (including prototype-property names) remain data. Grouping, date ordering, regular/overtime source values, totals, English headers, formats and end marker are preserved. Workbook filenames use the selected date text directly, avoiding a timezone-induced prior-day shift; chosen dates still label output and do not filter rows.

`parseCsvAndExport` retains its callback interface and now awaits workbook generation, routing both validation and later export errors to failure. The pure workbook builder validates at its own boundary. No transport or credentials were added.

## Local acceptance evidence

Final implementation checks (2026-10-24):

- `npm run imports:test`: 14 passing source-fixture/export tests. Includes actual XLSX bytes, complete sales cell mapping, optional empty/zero behavior, worksheet/row errors, CSV malformed/reordered/multiline cases, no partial export, arbitrary IDs and reloaded hours workbook grouping/values/layout.
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`: 3 passing dictionary/error tests; English/Spanish keys and placeholders agree.
- `npm exec tsc -- --noEmit`: passed.
- `npm run build`: passed static export; `npm run seo:check`: passed.
- Python Playwright/Chromium `scripts/test-import-validation.py`: passed in both languages, touch/keyboard and 390px viewport. Checks every selected filename, wrong/empty reports, row remedies, independent replacement, stale-file-read isolation, amount-error focus, failed template/retry, one export for two submits, downloaded sales workbook cells, hours input retention/malformed CSV/date metadata, offline hours export, denied storage, Spanish wrapping and English-print/Spanish-return behavior. API routes are synthetic loopback; production Worker requests fail the test.

Reproduce the browser check from repository root (Python Playwright/Chromium must be installed):

```bash
python3 /home/wslunusn/CR-Website/.codex/skills/webapp-testing/scripts/with_server.py \
  --server 'env NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- --hostname 127.0.0.1 --port 3017' \
  --port 3017 --timeout 60 -- \
  python3 scripts/test-import-validation.py http://127.0.0.1:3017
```

Fixture generation is `node --import jiti/register scripts/create-import-fixtures.ts`; all generated inputs contain synthetic employees/totals. Existing `test-internal-language.py` and `test-internal-feedback.py` also passed against the final code in the same local helper run, including optional protected cash-out fill and unchanged shared error/focus flows.

## Limits, next work and rollback

This validates source shape/values; it does not prove source authenticity, correct selected store/date/slot, sales reconciliation, reviewed-output identity or a deployed business rule. IMPORT-02 owns extraction review/reconciliation; IMPORT-03 owns explicit Start next report, replacement warning and reviewed repeat downloads; IMPORT-04/05 await DEC-01 for date/shift rules. Session fields/files are retained in memory, not persisted, shared or server saved. Reload/process termination still requires reselecting sources; UX-06's documented browser-navigation limits remain applicable. There is no new saved-revision/second-editor transport to test, no protected import API and no staff identity mapping. Independent tabs edit independent session files; denied storage cannot erase the selected in-memory files. Existing optional cash-out read/auth behavior remains covered by the prior shared feedback/language flows.

English workbook output and metadata remain familiar. Spanish screen labels/errors do not translate original names, headers or values. Print-language approval is still DEC-07; no new paper form or payroll summary layout is invented.

Rollback: revert this task's scoped commit and separately publish a compatible frontend only under REL-04 authorization. Keep source files and any existing device draft keys; no migration, backend resource, business-record mutation or cleanup is needed. Completion here has no external/live milestone; future publication and staff acceptance retain their own gates.
