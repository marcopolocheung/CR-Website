# Guided cash-out entry (CASH-02)

New cashier cards keep each raw denomination entry in optional device-only `countInputs` metadata. An empty string is an unentered field; `"0"` is a deliberately entered zero. Both retain the existing zero contribution to financial calculations. A missing metadata array, or a null element after editing an older sheet, means the original entry status is unknown. Existing counts are displayed and retained; editing one does not confirm other counts. Status does not establish server submission completeness or approval.

Whole counts from 0 through 100000 match the existing Worker limit. Invalid raw input remains in the open editor and the device draft, with a field error. It contributes zero to clearly identified preview totals, and Save focuses the first invalid count without sending a request. No parseInt truncation, negative clamping, discrepancy threshold, new required cash field or starting-cash rule is introduced.

The optional inline keypad provides digits, clear, delete, previous/next denomination and close/Escape. It retains the selected store/date/shift/cashier, value and running drawer total in the sticky summary. Direct field entry retains native numeric input modes; while the custom keypad is open numeric fields suppress the native keypad. There is no repeated modal or drag requirement. The expanded summary scrolls internally in short visible viewports; keyboard navigation and close return to the selected field. Adding a cashier focuses its name; removing one returns focus to Add cashier.

## Compatibility and recovery

`cashoutServerSheet` strips raw/status metadata before saving, preserving the existing exact AM/PM/name/counts/Toast/Z wire contract. `src/lib/cashout.ts`, the fixed $100 float, integer cents, Worker endpoints and existing sales workbook calculations are unchanged. A server-loaded sheet has unknown original entry status because the server never retained this metadata. A successful server save is not a claim that device entry-status metadata was uploaded.

Existing draft keys, source copies and original unscoped source bytes remain intact. Independent resumes create independent working IDs. Failed device writes retain raw current input and block context teardown; failed server writes preserve the draft and can be retried. Rolling back code must retain all draft keys. An older reader may offer a recovery download for an extended draft rather than edit it; export/reconcile that source through the compatible reader instead of deleting it. No schema migration, cleanup or automatic disposal is needed.

## Local evidence — 2026-10-24

All checks use `/home/wslunusn/CR-Website-cashout`, the sole new worktree for UX-04 and CASH-02. The server runs with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- --hostname 127.0.0.1 --port 3027`. API requests are synthetic loopback fixtures; production Worker calls fail the tests.

- `npm run cashout:test`: PASS 19/19, including original calculations/dashboard/inventory, blank/zero/unknown round trips, invalid raw recovery and server-payload stripping/parity.
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/drafts.test.ts`: PASS 9/9.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`: PASS.
- `python3 scripts/test-cashout-entry.py http://127.0.0.1:3027`: PASS. Covers initial blank versus zero/clear, keyboard navigation, touch keypad, digits/delete/next/Escape, invalid-save prevention, explicit reload/resume, independent second editor, EN/ES and long names, 390px phone width, 44px keypad targets, 430px landscape panel scrolling/close, legacy unknown status, offline retry and denied-storage retention.
- Browser parity example: AM drawer $300, float $100, Toast $199.75; PM drawer $100, float $100, Toast $0; Z $200. Wire totals: AM deposit 20000 cents, PM 0, AM/day difference 25, PM/Z difference 0. The sales converter receives $200.00/$0.25/$0.00/$0.00 through its existing saved-day linkage.
- Actual three-page Letter PDF was generated from Spanish UI using the existing English print behavior. Extracted text and rendered pages verify AM/PM names, denominations, Toast/Z and expected totals; new keypad/progress/help are omitted. Synthetic artifacts are transient `/tmp/cash-02-output.pdf`, `/tmp/cash-02-print-*.png` and `/tmp/cash-02-keypad-phone.png`. The browser script requires the available Python Playwright and pypdf packages.
- `scripts/test-entry-workspace.py`, `scripts/test-cashout-context.py`, `scripts/test-internal-feedback.py`, `scripts/test-internal-drafts.py`, `scripts/test-internal-language.py`: PASS against the same local server. Existing store/date isolation, legacy bytes, late responses, save feedback, language/print recovery and mounted inputs remain covered.

No production mutation, deployment or publication occurred. Native tablet software keyboards and staff usability remain REL-05/06; headless Chromium viewport/touch coverage does not substitute for those sessions. Local CODE_ONLY milestones are complete. DEC-02 is the next cash-workflow gate: starting cash, permitted adjustments, required submission/review fields, actual deposit and correction permissions must be approved before CASH-03/04/05/06 can finish.

## Delivery and next action

UX-04 implementation `e2a9214` is PR [#145](https://github.com/marcopolocheung/CR-Website/pull/145) against main. CASH-02 implementation `e6c6a8e` is PR [#148](https://github.com/marcopolocheung/CR-Website/pull/148) against `feat/overhaul-ux-04`. Both were opened non-draft, left unmerged and have no auto-merge enabled. The sole new worktree remains `/home/wslunusn/CR-Website-cashout` on `feat/overhaul-cash-02`; the original workspace and other existing worktrees were not edited. Task ownership returns to the user for the next decision; no next task has started.

DEC-02 needs named approval and worked normal/short-close examples covering where the $100 float applies, permitted adjustments, expected/actual deposit, required close fields and review, and who can correct a reviewed close with what history. The decision remains pending. Resolve only approved portions rather than inventing defaults.
