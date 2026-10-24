# Cash-out context and legacy restoration (CASH-01)

CASH-01 finishes the legacy path on top of UX-05's verified draft repository. An unscoped `cr-cash-out` source remains unassigned until the user chooses a store/date, enters a preparer label and confirms that exact context. Assignment creates a new local working copy with `sourceId: 'cr-cash-out'`, referencing the actual retained source key. It invents no earlier save time, employee identity, financial policy or server revision. The old key/bytes are never rewritten or deleted by this flow.

The legacy adapter accepts the original AM/PM cashier/count/Toast/Z shape without translating names, parsing money strings or coercing invalid values. Malformed/unsupported/context-bearing/credential-bearing sources remain available as original-source downloads. No unknown format is guessed. Source bytes are reread before and after confirmation; if another window changed them, the chooser asks the user to review the current source rather than applying an obsolete snapshot.

New/resumed drafts retain complete context keys and independent working IDs. An active editor cannot silently change its store/date: choose another draft, then explicitly select and start/resume the target context. Rapid context selection hides earlier chooser rows while the new selection loads, and the resume handler rejects a mismatched source. This prevents a prior store/date's content being reassigned during a fast switch.

Late fetches are scoped to their original editor lifetime. An old successful load cannot open a replacement dialog or overwrite a newly opened draft; an old 401 cannot retire the newer editor's manager session. Current input/device saves remain synchronous with edits; denied writes keep values open and block context teardown. No backend transaction, API wire shape, cash rule, denomination, fixed float, AM/PM layout, Toast/Z comparison or sales workbook linkage changes.

## Local evidence

`npm run cashout:test`: 16/16 pass, including three new legacy adapter scenarios (exact input/context absence, malformed values with no zero coercion, and unknown context/credential rejection) plus the existing calculation/dashboard/inventory tests.

`python3 scripts/test-cashout-context.py http://127.0.0.1:3017`: PASS against a local Next dev server using `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`. All API requests use synthetic loopback fixtures and production requests are rejected. The browser checks explicit cancel/assignment by keyboard and Spanish touch confirmation, exact source counts/names/Toast/Z, unchanged legacy bytes and no server write during assignment, all CR2/CR3 × 2026-10-20/2026-10-21 contexts across reload/resume, twelve rapid switches, stale 200 and 401 responses, denied storage preserving current input, and malformed-source recovery download.

UX-01, UX-03 and UX-05 browser regressions also pass, preserving language/focus/print and independent-editor behavior. Contracts/dictionary/draft tests: 15/15; TypeScript, static build, SEO and whitespace checks pass. These are local implementation results, not staff/live acceptance. No cloud operation, production data, publication or policy approval occurred.

## Recovery and continuation

Keep all scoped and unscoped source keys on rollback. Revert the scoped UI/adapter change if needed; source/download copies allow recovery while restoring a compatible reader. Assignment never migrates or deletes the original. If local storage is unavailable, retain the open editor or download its working copy; no UI status claims a successful device save. The observed legacy endpoint remains last-save-wins; future server calculations, policy and revisioned financial writes belong to their gated tasks.

CASH-01 reuses completed UX-05 and records that actual implementation dependency in its brief/tracker. Frontend publication remains REL-04. UX-06 owns shared navigation/retry/conflict protection next; no authentication redesign or external activation is implied.
