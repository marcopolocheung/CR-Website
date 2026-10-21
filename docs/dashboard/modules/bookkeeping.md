# Bookkeeping

`/internal/bookkeeping` — `Bookkeeping.tsx`, `SalesConverter.tsx`, `HoursConverter.tsx`, `src/lib/converter/*`.

**Constraint (from the owner, 2026-10-10):** converter *behavior* is frozen: same fields, same cells, same output file. Restyling is allowed. Everything below respects that: the changes are to the inputs around the converter and the page it sits on, not to `fillTemplate.js` / `parseCSV.js` output.

## Job

1. **Daily sales report:** take the three Toast exports for a day (general, lunch, dinner), add the cash-out figures, and produce the bookkeeping workbook.
2. **Employee hours:** take Toast's time-entries CSV for a pay period and produce the grouped hour log for payroll.

## What exists

- Both converters work without the manager code. Sales converter can **fill AM/PM deposit and over/short from the saved cash out** when the code is entered. That removes the retyping the owner asked to eliminate.
- Tabs with hash links (`#sales`, `#hours`), and panels stay mounted so a half-filled form survives tab switches. Good.

## Gaps

| Gap | Why it matters |
|---|---|
| First name / last name / day of week typed every time | Day of week is derivable from the date. Name is the same person most days |
| "Fill from cash out" only works if the code was entered on *this page's* cash tab | Hidden dependency. With one shared gate (platform.md) it just works |
| Three file pickers with no hint which Toast report goes where | Most common failure for a new person |
| Errors like `Sheet "Payments summary" missing.` | Accurate but not actionable: which file? which export? |
| Status messages like "Done! XLSX downloaded." vs "Error parsing file." | Inconsistent tone; the error doesn't say what to do |
| Hours converter: plant/location typed as full address strings from `LOCATIONS` | Should follow the shell's store switcher |

## Ideal

### Daily sales report

```
Daily sales report                                     CR3 · Mon, Oct 20
1  Toast reports                         How to export these from Toast ▸
   General (Sales summary)   [Choose file]  ✓ SalesSummary_2026-10-20.xlsx
   Lunch                     [Choose file]
   Dinner                    [Choose file]
2  Cash out                              ✓ Filled from saved cash out (CR3, Oct 20)
   AM deposit $612.00   PM deposit $672.00   AM over/short −$1.25   PM +$0.40   [Edit]
3  Prepared by   [Maria Lopez ▾]
                                                 [Download sales report]
```

- **Date and store come from the shell.** Day of week is computed from the date (still written to the same cell, so behavior is unchanged).
- **Prepared by** remembers the last name on this device.
- **Cash-out figures fill automatically** when a saved cash out exists for that store + date; "Edit" reveals the four fields. If none is saved: "! No cash out saved for Oct 20. [Do cash out] or enter the figures."
- **File pickers check the file on selection**: does it have the sheets this slot needs? Wrong file → "This looks like the Lunch report. Put it in Lunch?" with one button. Checking sheet names is a read of `wb.SheetNames`; the converter's own parse stays the same.
- **"How to export these from Toast ▸"** opens 3–4 numbered steps with screenshots. Collapsed by default (progressive disclosure).
- One primary button, labeled with what it does: "Download sales report".
- **Drag and drop** all three files at once onto the card and auto-sort them by sheet names. Nice to have.

### Employee hours

- Store from the shell; dates default to the **last completed pay period** (set the pay-period rule once: weekly/biweekly, start day).
- After download, show a short preview: number of employees, total hours, and **anyone over 40 hours in a week**, highlighted. That's an overtime check payroll needs anyway, and it costs one pass over rows already parsed. Output file unchanged.

## Later (needs owner decision)

- **Pull from Toast automatically** instead of uploading exports. Toast has partner APIs, but access requires an approved integration **(verify)**. Probably not worth it at two stores; the upload flow is fine if it's fast.
- **Send to the accountant**: if the bookkeeping workbook goes to someone every day, add "Email to bookkeeper" (needs an email-sending service on the Worker). Otherwise skip.
- **Monthly close page**: one month's sales reports + cash differences + hours in one zip. Do this only if the owner currently assembles that by hand.

## Why

- Asking for something the system already knows (day of week, store, cash figures) is the most common usability failure in forms (GOV.UK: "ask for each piece of information only once").
- Checking files at selection time moves the error to the moment of the mistake, with a fix attached (NN/g error guidelines).
- Overtime is the single most expensive payroll mistake for hourly restaurants. Surfacing it from data already in hand is cheap.
