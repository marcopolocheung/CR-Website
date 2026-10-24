# IMPORT-05: explicit hours review

The hours editor retains structurally readable CSV rows, including physical CSV record numbers and row-level exceptions. Header/parser/width failures remain blocking file errors. Open punches, invalid/unsupported or ambiguous dates, reversed punches, missing/negative/malformed hours, out-of-range starts and missing names/IDs remain visible. The strict legacy exporter boundary is preserved; reviewable input is not an accepted export.

DEC-01-v1 owns a whole overnight shift by its Chicago starting date. Selected boundaries are inclusive. Outside-range or invalid shifts are visibly excluded; missing identity on an otherwise includable row blocks export until resolved. Users acknowledge all included/excluded rows and source totals before exporting only the included set. No inferred employee name matching, shift splitting, overtime calculation or payroll correction is introduced. Total/regular/overtime remain separate source values. Unknown numeric totals display unavailable rather than zero.

Changing source/store/period invalidates acknowledgement and generated output. Resuming a device copy requires acknowledgement again; an old cached workbook with excluded rows is discarded from the working copy and regenerated, while the original saved copy remains intact. Source row numbers and unresolved rows can be saved as a device copy; that does not approve them. Legacy snapshot schemas, source labels and context isolation remain readable.

Acceptance evidence (local synthetic fixtures, production Worker URLs blocked):

- `npm run imports:test`: 38 passed. New tests cover whole overnight inclusion, source regular/overtime workbook parity, physical blank-record numbering, open/bad/DST-ambiguous/reversed timestamps, malformed numbers, unmatched identity and complete included/excluded reconciliation.
- `npm run build`, `npm run seo:check`, `npm exec tsc -- --noEmit`: passed; 3 dictionary tests passed.
- `test-import-hours-preview.py`: passed at 390px in English/Spanish, touch/keyboard. One included overnight row and three excluded rows; source values F2=3, G2=2.5, H2=0.5 verified from the downloaded workbook ZIP/XML. Range edits clear acknowledgement.
- `test-import-retention.py`: passed, including offline identical output/reload recovery, storage quota preservation, independent second editor and source-copy preservation.
- `test-import-validation.py`: passed after narrowing an ambiguous test-only region selector; includes parser errors, source replacement, failed export/retry, workbook cells, denied storage and bilingual print handling.

Output retains the original grouped worksheet format, headings, styles and source regular/overtime values. The wide preview table scrolls inside a keyboard-focusable labelled region, with no document overflow. Stable persisted issue codes are translated; raw names/source text are unchanged. No API deployment, remote migration or production operation is part of this CODE_ONLY task. Publication remains REL-04. Rollback retains all draft keys/raw sources; revert the scoped consumer/parser changes without deleting device copies.
