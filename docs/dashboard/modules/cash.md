# Cash

Cash out: `src/components/internal/CashOut.tsx`, `src/lib/cashout.ts`, `src/lib/cashout-store.ts`. History charts: `Dashboard.tsx`. Worker: `/api/cashout/{store}/{date}`.

## Job

At the end of each shift, count every drawer, compare it to what Toast says should be there, find out who's over or short, and record the deposit. At day end, compare the total to the Z report. Over time, spot patterns (the same cashier short, the same weekday short).

## What exists (and is right)

- Denomination counter per cashier ($100 → 1¢), drawer total, fixed $100 float subtracted, Toast cash payments → per-cashier over/short.
- AM and PM shifts, any number of cashiers each, shift totals, day total, Z-report expected cash → day over/short vs Z.
- Integer cents everywhere, so no floating-point error. A blank Toast/Z figure shows "—", not $0. These are subtle and correct. Keep them.
- Draft in `localStorage`; save/load by store + date; 30-day history table with clickable dates; print.
- The daily cash difference paper record (`docs/forms/25-0211 CR DAILY CASH DIFFERENCE RECORD.xlsx`) has exactly the fields the day total produces: AM over/short, PM over/short, total, actual deposit, Toast expected, difference. **The screen already replaces that paper form.** Say so on the Forms page.

## Gaps

| # | Gap | Risk |
|---|---|---|
| 1 | One draft key (`cr-cash-out`) for every store and date | Switch store to CR2 → CR3's counts stay on screen → "Save day" writes them under CR2 |
| 2 | Save has no `baseRev` | Two leads saving the same day: last one silently wins |
| 3 | Days are deleted after 31 days | Bookkeeping evidence disappears |
| 4 | Nobody's name on the save | Can't tell who counted |
| 5 | Shift lead sees "Toast cash payments" next to their count | Not a **blind** count: the counter can make the drawer "match" |
| 6 | `confirm()` for remove cashier, clear, load | Vague, can't name buttons, trained click-through |
| 7 | No threshold: $0.03 short looks as alarming as $40 short | Noise hides real problems |
| 8 | No running total while counting | Counter can't sanity-check as they go |
| 9 | 14px fields, small number inputs | Mis-taps on a phone |
| 10 | Cash out lives under Bookkeeping, charts on Home | Two places for one job |

## Ideal flow

**Page: `/internal/cash`** with two tabs: **Count** (default) and **History**.

### Count

1. **Header:** store (from shell) · date (defaults to today; before 4 PM, the AM shift is preselected; after, PM). Save status top right.
2. **Shift picker:** `AM | PM` segmented. One shift on screen at a time on phones (both stacked on desktop). Shift leads only care about their own.
3. **Cashier card** (one per drawer):
   - Name: a picker from the station's roster (scheduler employees), with free text allowed. Typing names wastes time and gives "Ana" / "ana" / "Anna" in history.
   - Denomination rows: big count inputs (`inputMode="numeric"`, 44px), live line total, **running drawer total pinned at the card top**.
   - Optional "Count by bundle": $1 bills in straps of 25 / coins in rolls. A roll field multiplies (quarters roll = $10). Saves time and errors **(nice to have)**.
   - **Blind count mode** (setting, on by default for shift leads once PINs exist): the Toast figure is entered **after** "Done counting". Then over/short appears. Until PINs exist, put the Toast field below a "Done counting →" button on the card, so the order is at least nudged.
   - Result line: "✓ Balanced", "Over $1.10", or "▼ Short $4.25", with color + icon + word.
4. **Shift total** card under the cashiers.
5. **Day total** (only once both shifts have data): deposit, over/short, Z report expected cash → difference.
6. **Problems at top** when present: "Ana (PM) short $4.25", "Z report figure missing".
7. **Action bar** (sticky on phone): `[Print] [Save cash out]`. Saving a day with a short over the threshold asks for a one-line note ("Customer paid with wrong change, refunded") that's stored with the day. This is the "explain the variance" step every cash procedure has **(verify against Toast's guidance)**.

### History

- Moves here from Home and the bottom of cash out: KPI tiles, the two charts, the "By day" table. Filters: store (or both), range 7/14/30/90 days (90 needs the longer retention).
- **New: "By cashier" table**: count of shifts, total over/short, number of short shifts, largest short. Sorted by number of shorts. This is the pattern a manager actually acts on, and it's only possible because names are stored per cashier. The data is already saved in each day's `sheet`.
- **Export month**: one click → `.xlsx` in the layout of `daily-cash-difference.xlsx` for the bookkeeper/owner's files. Paired with longer retention, this closes the records gap.

### Thresholds (owner sets once)

| Setting | Default | Effect |
|---|---|---|
| Ignore under | $1.00 | Shown as "Balanced (−$0.35)" in green |
| Flag over | $5.00 | Needs a note; appears in Home "Needs you" |
| Deduction form prompt | Owner's call | Links to the paycheck deduction approval form with the amount and name filled, **only** as a printable form for a signature. Never deduct automatically (see research.md §6) |

## Why

- **Blind counts** are standard cash control: the counter can't make the drawer match a number they can see **(verify)**.
- **Per-store/date drafts** and **baseRev** close real data-corruption paths, and the code for both patterns already exists elsewhere in the repo.
- **Thresholds + notes** turn every cent of variance from noise into a short, explained list.
- **By-cashier history** is the question an owner actually asks ("who keeps coming up short?"), and it costs nothing extra to answer from saved data.

## Implementation notes

- Draft key: `cr-cash-out:${store}:${date}`. On store/date change, load that key's draft, or the server copy, or empty.
- Worker: `CASHOUT_TTL_SECONDS` → 4 years (or drop the TTL); add `rev`/`baseRev` like the inventory list; add `note` and (later) `savedBy` to the doc; validate note length.
- Roster for the name picker: `GET /api/employees?restaurant=CR3-diningroom` (public read) already returns names.
- Keep `src/lib/cashout.ts` math untouched; it's tested (`cashout.test.ts`).
