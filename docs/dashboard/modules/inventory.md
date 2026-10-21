# Inventory

`/internal/inventory` — `Inventory.tsx`, `src/lib/inventory.ts`, `src/lib/inventory-store.ts`. Worker: `/api/inventory/CR3/...`. Paper source: `docs/supply/form1–6.png` (clipboard photos), `docs/forms/23-0404 CR3 Inventory List (FINAL).xlsx`.

## Job

A few times a week, walk the storeroom, write down what's on the shelf for each supply, work out what to order from each supplier, and place the orders.

## How the paper works (from the clipboard photos)

- Rows: ITEM, SUP (supplier code: D, L, LC, B, Pepsi…), **Use** (the par: how much should be on hand, e.g. `1`, `1/2`, `14`).
- Five INV/ORDER column pairs per page = five counts (dates handwritten: 10/1, 10/4, 10/6, 10/8, …). Every 2–3 days.
- **INV**: ✓ if there's enough (most rows, most days), else a number. Circled 0 (⊘) means none left.
- **ORDER**: what to order, often crossed out or rewritten after a phone call (things that are out of stock or substituted). "+" marks appear where a quantity was added.
- Gray rows = supplier L (the main distributor), printed shading.
- Handwritten fixes: suppliers changed (D → LC), Use changed (10 → 1), rows crossed out.

## What exists (and is right)

- The sheet is reproduced **as the paper**: same rows, spellings, gray shading, ✓ shortcut, blue "pen" color for entries, four past columns (hidden on phones), print layout. That's exactly right for recognition.
- ORDER auto-fills with `Use − INV` (rounded up), editable.
- Order list grouped by supplier with **Copy** (for texting the supplier).
- Item list editor (rename, supplier, Use, gray, reorder, add, remove) with conflict handling.
- Draft in `localStorage`; save per date; history powers the past columns.

## Gaps

| Gap | Why it matters |
|---|---|
| CR3 only (`/api/inventory/(CR3)`) | CR2 still on paper |
| A count of `40` where Use is `1` is accepted silently | Typo turns into an order of 0 and a wrong history |
| ORDER edits after calling the supplier aren't separate from the suggestion | Can't tell "we ordered 3" from "system suggested 3" |
| No "what did we order last time from L?" | Paper shows it in the past columns; screen shows past INV/ORDER only on desktop |
| No units: `1/2` of what? | New staff guess (case? sleeve? box?) |
| Copy is the only way out | Supplier contacts (phone, rep name, order cutoff, account # like Pepsi `3923058`) live in people's heads |
| "Edit list" sits next to "Save count" with the same weight | Rare admin action competing with the daily one |
| Rows are in sheet order, not walk order | Counter backtracks across the storeroom **(only if the sheet isn't already in shelf order. Ask.)** |
| Nothing says when the last count was | Home can't flag "not counted since Thu" |

## Ideal

### Count (default view)

1. Header: "CR3 inventory · Count for Mon, Oct 20", save status, "Last count: Thu, Oct 16".
2. **Phone mode = one big list, one row per item**, big ✓ button and a number field per row, and Use shown as "Use 2 cases". The paper-replica table stays the desktop and print layout. On a phone, the 10-column table is the hardest thing in the app to use.
3. **Smart checks inline, never blocking:**
   - Count more than 5× Use, or over 3× the last count: "! 40? Usually 1–2. [Keep 40]".
   - Item counted 0 twice in a row and nothing ordered: "! Out last time too. Order?"
4. **Progress:** "28 of 52 counted", plus a "Show only not counted" toggle. Lets a count be paused and finished later.
5. Action bar: `[Print] [Save count]`.

### Order (tab, or the section under the sheet as today)

- Grouped by supplier, each group shows the **supplier card**: name, phone (tap to call), rep, account #, order days/cutoff ("L orders by Tue 2 PM for Thu delivery").
- Each line: item, suggested qty, **ordered qty** (pre-filled from suggested; edit after the call), and a status: `To order` → `Ordered` → `Received`. Moving to Ordered stamps the date. "Received" is optional at first.
- **Copy** per supplier (text message format) and **Print order sheet**.
- Later: "Send" opens a pre-filled SMS (`sms:` link) or email (`mailto:`) to the supplier contact. Zero backend, big time saver.

### Items (admin, behind "More ▾ → Edit item list")

- Today's editor plus: **unit** (case, sleeve, box, bag, roll), **supplier from a list** (not free text, so "L" and "l" don't split the order list), and an optional **shelf/area** to sort by walk order.
- Suppliers get their own small list (code, name, phone, rep, account #, order days).

### Insights (later, once there's history)

- Per item: average weekly use = (previous count + received − current count) / days. Needs "received". Without it, use the orders as a proxy.
- "Use" suggestions: "You order Plasticware every count. Raise Use from 14 to 18?" This is a par recommendation, a standard feature in MarketMan/R365-type tools **(verify)**.
- Cost: if unit prices are ever entered, show weekly supply spend by supplier.

### CR2

Same screens, its own item list (`/api/inventory/CR2/list`). The Worker route already takes the store in the path; it's regex-limited to `CR3`. Start CR2 from an empty list plus "Copy CR3's list".

## Why

- Phone-first rows: counting is done standing in a storeroom, and a wide table on a phone means pinch-zoom on every row.
- Outlier warnings catch the most common data error (a typo) at the moment it happens, without blocking legitimate spikes.
- Ordered vs suggested and supplier cards turn the order list from a calculation into the actual ordering task, which is what the paper ORDER column's crossings-out show people really do.
- Units and supplier lists remove knowledge that currently lives only in experienced staff's heads.

## Keep

- `suggestOrder`, `parseAmount` (fractions like `1/2`), `ordersBySupplier`, `listProblem`, and their tests.
- The paper-replica table for desktop and print.
