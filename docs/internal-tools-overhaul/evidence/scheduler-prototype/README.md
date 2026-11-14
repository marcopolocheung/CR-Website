# Scheduler prototype checkpoint

Date: November 14, 2026. Review unit: isolated UX prototype; not completion of overhaul Step 14.

## Try it

Run `npm run dev -- --hostname 0.0.0.0 --port 3057`, then open http://localhost:3057/scheduler-prototype.

1. On Jesus’s Monday shift, select **Edit person**, then **Save callout**. Only that date becomes unavailable; coverage repairs automatically. Undo restores both availability and assignments.
2. Drag Jesus’s Monday AM assignment onto Tuesday AM Server. His destination becomes Keep, and the displaced employee can relocate. Place Jules into Thursday AM Cashier using the Team list. Both placements survive subsequent adjustments.
3. Switch Auto-adjust off, record another callout, inspect the open slot, then use Adjust now.
4. Select a shift, release its Keep, or use Move followed by a destination. These controls work without native drag.
5. In an employee editor, uncheck the all-day callout to set an availability window; change Applies to for a recurring weekly rule. Reset sample restores the fixture and initial settings.

The prototype has ten fictional sample employees and 28 required slots for November 16–22, 2026. Reload resets browser-memory changes. No API, staff-record, authentication, notification, or publishing integration exists. Production scheduler behavior and shared records are untouched.

## Behavior and limitations

Manual placements keep the selected assignment. Occupied destinations relocate their former occupant rather than imposing a swap. Kept destinations must be released before replacement; kept sources can be deliberately moved. Availability edits remove invalid affected assignments, including their Keeps. Undo restores the complete preceding transaction (up to 30 retained transactions).

The prototype repair function uses the existing production validator. It prioritizes coverage, then changes to the post-edit board, then squared weekly hours. Search is deterministic, limited to 6,000 nodes, and yields every 200 nodes. A limit message distinguishes a bounded search from proven infeasibility. Repairs preserve valid existing assignments as their fallback; no global optimality guarantee is presented. Optional slots, cross-station planning, published-schedule repair, backend persistence, full bilingual coverage, and production integration are outside this checkpoint.

## Verification

- `npm run scheduler:test`: 145 passed.
- `node --import jiti/register --test src/components/scheduler-prototype/model.test.ts`: 7 passed, including valid fixture, scoped callout, two Keeps through occupied-slot repair, invalid placements, partial/recurring availability, impossible coverage, bounded search, and no unnecessary reshuffle of a valid week.
- `npx tsc --noEmit`: passed.
- Local Next dev route returned HTTP 200. Browser run with Chromium/Playwright passed: callout/Undo; native drag; two Keeps through repair; Auto-adjust off and Adjust now; rejected qualification; release Keep; partial/recurring availability and Undo; keyboard-only Move; all ten employees unavailable Monday leaving four explicit gaps; 390px and 320px without page overflow. No browser page errors.
- Desktop and phone screenshots inspected: [desktop](desktop.png), [phone](phone.png). Board scroll is contained; controls and employee editing reflow below it on smaller widths.

Reproducible browser check (requires the repository’s separately provisioned Python Playwright/browser prerequisites):

```sh
python3 scripts/test-scheduler-prototype.py --base-url http://localhost:3057 --output /tmp/scheduler-prototype-checks
```

Reviewed against the approved Night shift design bank: bundled Archivo/Grenze with licenses, shared palette tokens, layered paper, teal change markers, moving red navigation surface, selected-item marker, and reduced-motion support. This is design and synthetic local behavior evidence; no staff usability or production readiness claim.

Await user testing before changing the real scheduler.

## Color review revision — November 14, 2026

User requested distinct employee and weekday colors with stronger visual emphasis. The prototype now uses ten stable employee identity colors for assignment chips, Team cards, and employee editor headings, plus seven weekday colors for bold date headers and softly tinted columns. Employee colors follow the employee across manual moves and automatic repairs. Names, dates, Keep labels, and Adjusted labels remain visible independently of color. This is an explicit prototype palette extension requested in review; shared design-bank tokens and production tools are unchanged.

White text against all 17 solid colors has at least 5.08:1 contrast. TypeScript and the full prototype browser scenario script passed again, including drag, two Keeps, Undo, callouts, keyboard movement, impossible coverage, and 320/390px layout. Updated screenshots: [color desktop](color-desktop.png), [color phone](color-phone.png). Original screenshots above are retained for comparison.

## Date-header refinement

Removed weekday-specific colors and column tints per user feedback. Headers now use large, bold uppercase day/date pairs (MON 16), centered with proportional spacing on white. Employee identity colors remain. Checked all seven headers and overflow at desktop, 390px and 320px; inspected the updated [board screenshot](neutral-date-headers.png).

## Parameter icons refinement

Added labeled parameter rows to Team cards and employee/shift detail panels, reusing the shared outline icon component. Category colors are consistent across people: blue calendar for day/availability, teal clock for shift times and hour totals, purple workplace/cash symbol for roles, and amber layers for doubles rules. Board positions now pair AM/PM and role text with those category icons; Keep includes a lock. Neutral date headers retain large day/date text alongside a small blue calendar. Staff identity colors remain independent of parameter colors. Visible labels remain alongside decorative, accessibility-hidden icons.

TypeScript and the existing prototype browser scenarios passed after the markup update, including keyboard moves, callout/Undo, two kept placements, impossible coverage, and narrow widths. Inspected [desktop](parameter-icons-desktop.png); [phone](parameter-icons-phone.png) also captured. Parameter captions use 11px supporting type with larger values and icon wells.

## AM/PM icon refinement

AM now uses a sun and PM a crescent moon in board slots and the shift-time legend. These are prototype-local specimens following the shared 24×24, 2-unit rounded-stroke icon grammar; they have not been added to the shared bank or other tools. Removed calendar icons from weekday headers and restored their larger plain day/date typography. Calendar icons remain in availability metadata; hour totals retain clocks. TypeScript passed, and browser inspection verified distinct AM/PM glyphs, icon-free weekday headers, and overflow checks at desktop, 390px and 320px. [Board capture](sun-moon.png).

## Keep emphasis and contextual editing

Keep now uses a vivid amber fill with dark text and lock icon. Removed persistent Edit person links from board cells; clicking an occupied employee name opens a small anchored Edit person popover while retaining shift details. Clicking again, clicking outside, starting a drag/transaction, or pressing Escape closes it. Escape restores focus to the name; the native button order supports keyboard access. Selecting Edit person opens the employee editor for that exact date.

Updated the existing browser scenarios for the new click-before-edit flow and verified initial action invisibility, outside-click dismissal, and Escape/focus restoration. Full browser scenarios and TypeScript passed. Also checked last-row popovers at 390px and 320px to ensure they fit the board without page overflow. [Keep and popover capture](keep-popover.png).

## PR validation against current main

Prepared on top of `origin/main` at `5345d3f` (Toast cash-fill merge), in an isolated checkout. Included only this prototype, its local fonts/licenses, evidence, browser scenarios, and registration of its domain tests in `scheduler:test`.

Checks on that base: `npm run scheduler:test` (165 passed), `npm run agent:test` (13 passed), `npm run internal:session:test` (6 passed), `npm run build`, `npx tsc --noEmit`, and `npm run seo:check` passed. The full prototype browser scenario script also passed against the production static export, including popover dismissal and keyboard focus, at desktop and phone widths. Updated final views: [desktop](final-desktop.png), [phone](final-phone.png).

For a plain static server without extensionless URL rewrites, use `--page-path /scheduler-prototype.html` with the browser script. The usual development route remains `/scheduler-prototype`.
