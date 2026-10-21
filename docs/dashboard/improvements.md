# Suggested improvements, ranked

Ranked by **(risk removed + time saved for staff) ÷ effort**. Effort: S = under a day, M = 1–3 days, L = a week or more. Each item says why, and which doc has the detail.

## Tier 1: fix first (data safety, small effort)

| # | Change | Effort | Why |
|---|---|---|---|
| 1 | **Cash-out draft keyed by store + date** (`cr-cash-out:CR3:2026-10-20`) | S | Today one draft serves every store and date. Switching the store keeps the other store's counts on screen, and "Save day" writes them to the wrong store. That's silent bad data in the money records. → cash.md |
| 2 | **Keep cash-out days ≥ 4 years** (change `CASHOUT_TTL_SECONDS`), inventory days 2 years | S | Today cash days vanish after 31 days. These are bookkeeping evidence; the IRS keeps employment-tax records 4 years. → platform.md §7 |
| 3 | **`baseRev` on cash-out and inventory-day saves** | S–M | Two people saving the same day: last one silently overwrites. The pattern already exists for the inventory list and schedules. → platform.md §6 |
| 4 | **Weekly backup** of the KV namespace (Cron Trigger → R2, or a GitHub Action → artifact) | M | Every record lives in one KV namespace with no copy. → platform.md §7 |
| 5 | **Set `STAFF_EDIT_PASSWORD` and `ALLOWED_ORIGIN` secrets** in production | S | The crew editor password is the hardcoded `test`. → platform.md §10 |
| 6 | **Unsaved-work warning** (`beforeunload`) on cash out and inventory | S | The scheduler has it; the two counting screens don't. A closed tab keeps the local draft but not the server copy, and people assume it saved. |

## Tier 2: one product (design language + shell)

| # | Change | Effort | Why |
|---|---|---|---|
| 7 | **One manager-code gate for the whole internal area**: a provider in the internal layout, plus a 15-minute idle auto-lock | M | Five gates today, so the code is typed up to five times per visit. With one gate and an auto-lock it's both easier to use and safer on a shared PC. → platform.md §4 |
| 8 | **Internal shell**: header (home link, store switcher, Lock) and a six-item nav on every internal page | M | Internal pages have no way back to the dashboard except the browser back button, and the QR generator isn't linked anywhere. → platform.md §3 |
| 9 | **Shared UI kit** `src/components/internal/ui.tsx` (Button, Field, MoneyInput, SaveStatus, StatusBadge, ConfirmDialog, UndoToast, EmptyState, Tabs, Tile, Segmented) | M | `inputClass`, `button`, `today()`, `STORE_LABELS`, and the `run()` busy/status helper are copy-pasted across 5+ files with small differences. One kit means one look. → design-language.md §6 |
| 10 | **Main buttons dark, red only for problems and deleting** | S (with #9) | Red main buttons on every internal page make real problems (a short drawer) stand out less. The scheduler already uses dark main buttons. → design-language.md §3 |
| 11 | **16px fields, 44px tap targets** across internal pages | S (with #9) | Most fields are 14px today; iPhones zoom in on focus below 16px, and small targets cause mis-taps while counting. → design-language.md §4 |
| 12 | **Replace the 8 `window.confirm()` calls** with named dialogs or Undo | S–M | Native confirm can't label its buttons ("OK" deletes?), and routine confirmations train people to click through. → research.md §3 |
| 13 | **Move the scheduler under the internal shell** (`/internal/schedule/[station]`, redirect `/scheduler-demo`) | M | Today it lives in the public site's shell (public nav, footer, GA page views) with its own gate. It's the biggest "two products" seam. → modules/scheduler.md |
| 14 | **Home becomes "Today"**: the needs-you checklist first; tiles; charts move to Cash | M | A manager's first question is "what needs me", not a 14-day chart. → modules/home.md |
| 15 | **Cash gets its own page** (Count + History tabs); bookkeeping keeps the converters | S–M | Cash out is an every-shift job; it shouldn't sit inside an office tool. → platform.md §2 |
| 16 | **Add to Home Screen** (web app manifest + icon) for `/internal` | S | The closest thing to "the app" for non-technical staff: one tap, no URL to remember. |

## Tier 3: do what paper can't (features)

| # | Change | Effort | Why |
|---|---|---|---|
| 17 | **Over/short thresholds + required note on large shorts** | S–M | Turns every cent of variance into a short list of explained exceptions. → cash.md |
| 18 | **Cashier name picker from the roster** + **By-cashier history** | M | Stops "Ana/ana/Anna" splitting history; answers "who keeps coming up short?" from data already saved. → cash.md |
| 19 | **Blind count order** on the cashier card (count first, then the Toast figure) | S | Standard cash control; the UI order alone nudges it before PINs exist. → cash.md |
| 20 | **Hours, overtime and labor $ strip on the schedule board** | M | Overtime is the expensive payroll mistake; the numbers are already computed per person. → scheduler.md |
| 21 | **Inventory phone mode** (one row per item, big ✓, progress "28 of 52") + **outlier warnings** | M | The 10-column paper table is the hardest screen to use on a phone; typos become wrong orders. → inventory.md |
| 22 | **Supplier cards + ordered vs suggested + tap-to-call/SMS** | M | The order list becomes the actual ordering task; supplier knowledge leaves people's heads. → inventory.md |
| 23 | **Customer complaint form on screen** + monthly count by type | M | All checkboxes, cheap to build; complaint patterns become visible. → forms.md |
| 24 | **Daily prep list** reusing the inventory components | M | Daily task with the same shape as inventory; high reuse. → forms.md |
| 25 | **Sales converter: date/store from the shell, day of week computed, file check on select** | S–M | Removes retyping and the most common failure (wrong file in the wrong slot). Output unchanged. → bookkeeping.md |
| 26 | **Hours converter: overtime preview after export** | S | Payroll catch from data already parsed. → bookkeeping.md |
| 27 | **Write-up check-your-answers step + per-employee history** | S–M | Permanent records deserve a review step; history makes discipline consistent. → forms.md |
| 28 | **Publish → "Copy link for group chat" + per-person `.ics` calendar** | S | Solves "didn't see the schedule" without an SMS service. → scheduler.md |
| 29 | **Monthly export** (cash difference layout) for the owner's files | S–M | Pairs with retention; an accountant-friendly record. → cash.md |
| 30 | **Inventory for CR2** | M | Route already takes the store; regex-limited to CR3. → inventory.md |

## Tier 4: bigger bets (need owner decisions first)

| # | Change | Effort | Why / dependency |
|---|---|---|---|
| 31 | **Per-person PINs** (managers, then staff) with `savedBy` on every record | L | Needed for an audit trail, blind counts by role, and employee self-service. The one infrastructure change that unlocks most of Tier 4. |
| 32 | **Employee self-service**: time-off and availability requests, shift swaps, manager approval inbox | L | Biggest workflow gap vs 7shifts/Homebase; existing `availabilityOverrides` means the solver needs no changes. Needs #31. |
| 33 | **Onboarding checklist per new hire** | M | Replaces the new hire packet's "did we get everything?" |
| 34 | **Toast API integration** (sales, time entries, cash) | L | Removes uploads entirely, but requires Toast partner access **(verify)**. Upload flow is fine at two stores. |
| 35 | **Buy instead of build** for scheduling or inventory | — | 7shifts and MarginEdge (~$350/mo per location for MarginEdge) do much of Tier 3–4 out of the box. The in-house tools fit China Rose's paper and rules exactly and cost nothing; revisit if a third store opens or the owner wants invoices/P&L. |

## Suggested order

1. Week 1: items 1–6 (safety).
2. Week 2–3: items 7–12 (one gate, shell, UI kit, buttons, sizes, dialogs). Do these **as one change** so pages are converted once.
3. Then 13–16, then pick from Tier 3 by what the managers complain about most. Ask them (open-questions.md).

## What not to do

- **Don't rewrite the scheduler solver** to CP-SAT now. It's deterministic, validated, and tested; the gaps are in the UI around it.
- **Don't change converter output.** That's the owner's explicit constraint.
- **Don't store SSNs, medical info, or bank details** in the Worker.
- **Don't add a charting library or a component library** for this. The house SVG chart and Tailwind are enough, and they match.
- **Don't make red the main button color again.**
