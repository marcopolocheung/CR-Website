# Home ("Today")

`/internal` — `src/components/internal/Dashboard.tsx`

## Job

Answer one question in under five seconds: **what needs me today, and is anything wrong?**

## Today

- Four link cards (Bookkeeping, Inventory, Scheduler, Forms), then a manager-code gate, then the cash board: store/range filters, four KPI tiles (deposits, average per day vs previous period, net over/short, missing cash-outs), two column charts (AM/PM deposits; over/short), and a "By day" table.
- The cash board is good analytical work: validated palette, table fallback, keyboard-focusable bars, missing days counted and linked to the fix.
- What's missing: anything that isn't cash. And it leads with links, so the first thing you see doesn't tell you anything.

## Ideal

```
Today · Mon, Oct 20                         [CR3 · W Military ▾]

Needs you
  ✕ Yesterday's PM cash out not saved            [Do it now]
  ▼ CR2 Sat AM drawer short $12.40 (Ana)         [Open]
  ! Next week's schedule not published (CR3 Dining)  [Open scheduler]
  ! Inventory not counted since Thu              [Count now]

Done today
  ✓ AM cash out saved 3:02 PM — deposit $1,284.00, balanced
  ✓ Schedule for this week is live

This week                          (tiles, link to Cash for charts)
  Deposits $8,412   Avg/day $1,202 ▲3.1%   Net over/short −$6.15   Shorts 2 days

Tools
  Cash · Bookkeeping · Inventory · Schedule · Forms
```

### Behavior

1. **"Needs you" list** is computed from data that already exists. All of these checks are cheap reads:
   - Cash out missing for any past day in the last 7 (from `fetchCashoutHistory`). Today counts only after closing time.
   - Any saved day with a drawer short beyond a threshold (default **$5**, editable) or a Z-report difference beyond the same.
   - Next week's golden schedule for each station not published, or published with unpublished changes (`/api/schedule?month=` already returns `visible` weeks; add a cheap status read).
   - Inventory: no count saved in the last N days (N = the usual count rhythm: the clipboard shows Mon/Wed/Fri/Sun-ish counts, so 3 days).
   - Optional later: write-ups awaiting employee signature.
2. Each item is **one line, one link, plain words**, sorted by severity (problem → warning). When the list is empty: "✓ Nothing needs you. Nice." (empty state that celebrates).
3. **"Done today"** gives reassurance (status tracker pattern: latest first).
4. **Tiles** keep the current four, but default to "this week" and link to the Cash page for the charts and table. The charts move off the home page. They're analytical and push the operational list below the fold on phones.
5. **No code needed for the list skeleton.** Show the checklist rows' names without numbers when locked ("Cash out — unlock to check"), so the page is useful before unlocking and makes clear what the code unlocks.
6. Store switcher drives everything; "Both stores" groups the "Needs you" list by store.

### Why

- The NN/g operational/analytical split: a morning check is operational. Charts are analytical, and they answer a question nobody asked first thing.
- Every leading restaurant back office (Toast, 7shifts) opens on a "today" summary with alerts, not a link grid **(verify)**.
- Turning "Missing cash-outs: 2" from a number into a task with a button is the difference between information and action.

## Keep

- The cash KPI tiles, the chart code (`Columns`, `Segment`, `niceStep`), and the "By day" table. Move them to the Cash page.
- `summarize()` / `dailyRows()` in `src/lib/dashboard.ts` and their tests.
