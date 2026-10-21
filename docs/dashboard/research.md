# Research: what good operations dashboards look and act like

Researched 2026-10-20. Sources are listed at the bottom; each finding points to them by number. Items marked **(verify)** come from general industry knowledge because the vendor or legal page would not load during research.

## 1. "Dashboard" means two different things. We need both, separately.

NN/g separates a **dashboard** (one screen of at-a-glance information) from a **portal** (many tools and tasks gathered in one place) [1]. Our `/internal` is mostly a **portal** with a small **dashboard** (the cash charts) attached. That's fine, but each part has its own rules:

- **Portal rules:** find the tool fast, know where you are, get back home, the same controls in the same places everywhere.
- **Dashboard rules:** fits on one screen, readable in seconds, length and position for numbers (bars, lines) instead of area, angle, or color, sorted bars, no pies, donuts, gauges, or 3D [1].

NN/g also separates **operational** dashboards (time-critical, "is anything wrong right now?") from **analytical** ones (daily or weekly, "what should I look into later?") [1]. A restaurant manager's morning needs the **operational** kind first: *is today's cash out saved, did a drawer come up short, is inventory counted, is next week's schedule published*. Trends (14-day deposits) are analytical and belong lower down or one click away.

**Implication:** the home page should lead with a status checklist, not charts. See [modules/home.md](modules/home.md).

## 2. What restaurant back-office products converge on

Looking at Toast, 7shifts, Homebase, MarginEdge, and Restaurant365 together, the same pattern repeats [5][6] **(verify details against each vendor's current product)**:

| Area | What the leaders do | What we do today |
|---|---|---|
| **Home** | "Today" view: sales so far, labor % vs sales, tasks due, alerts (late clock-ins, missing counts) | Tool links + cash charts behind a code |
| **Scheduling** (7shifts, Homebase) | Drag-and-drop board, templates, copy last week, auto-scheduling, availability and time-off **requested by employees from their phone**, shift swaps/drops with manager approval, labor cost and **overtime warnings while building**, publish → push/SMS notification | Strong solver, templates, copy week, publish/hide, public viewer. No employee requests, no notifications, no labor cost or overtime warnings |
| **Inventory** (MarginEdge, R365, MarketMan) | Count sheets in **shelf-to-sheet order** (the order items sit on shelves), count on a phone, units per item (case/each), **par levels** → suggested order, order guide per vendor, send order to vendor, actual vs theoretical usage, price alerts [6] | Clipboard-replica sheet with Use (par) → auto ORDER, supplier-grouped order list with Copy. One store only. No units, no usage trend |
| **Cash** (Toast + back office) | Drawer opened with a fixed starting bank, cash in/out logged, **blind count** (cashier counts without seeing expected), over/short vs POS, manager sign-off, deposit log, safe count **(verify)** | Denomination counter per cashier, $100 float, Toast vs counted over/short, Z report compare, 30-day history, dashboard |
| **Bookkeeping** (MarginEdge, R365) | POS sales pulled automatically, daily P&L, invoices captured by photo, exports to QuickBooks/Xero [6] | Upload Toast Excel/CSV → fill the bookkeeping workbook. Cash-out totals pre-fill. Manual but works |
| **HR / forms** (Homebase, 7shifts) | Digital onboarding packets, e-signature, documents stored per employee, write-up history per employee **(verify)** | Blank form downloads; write-ups saved on site, uneditable after save, labeled |

Two things stand out:

1. **The leaders put the employee in the loop.** Availability, time-off, and swaps are requested by staff and approved by a manager. Our scheduler has the manager type everyone's availability. That's the biggest workflow gap. It's also the hardest to close, because it needs per-employee identity.
2. **The leaders warn while you work.** Overtime while scheduling, a count way off the usual while counting inventory, a short drawer when closing out. The warning comes at the moment of entry, not in a report later.

## 3. Designing for non-technical staff

The people using this are managers and shift leads in a busy restaurant, often on a phone, often interrupted, often not confident with software. Sources agree on a short list:

- **Plain words from their world** ("Cash out", "Order list", "Use"), not system words ("persist", "sync", "token", "rev") [2]. Our screens already mostly do this; keep it as a hard rule.
- **Recognition over recall.** Show options; don't make people remember a code, a URL, or which tab something lives on [2]. Today: you must remember that the dashboard is at `/internal`, the QR generator isn't linked, and the scheduler is somewhere else.
- **Consistency.** The same action looks the same everywhere [2]. Today: "Save" is a red button in cash out and a black button in the scheduler.
- **One thing at a time, and a few things up front.** Show the essentials first and put the rest behind a clearly labeled "More" (progressive disclosure), at most two levels deep [3]. GOV.UK starts from "one thing per page" and allows grouping related questions for internal staff who switch tasks quickly [4]. That fits a manager working through a cash-out sheet.
- **Labels above fields, no placeholder-as-label, right keyboard for the field** (`inputMode="decimal"` for money), sensible defaults (today's date, last store used), accept the formats people type [7].
- **Mark optional fields "(optional)"; don't use asterisks** [4].
- **Errors next to the problem, in plain words, with the fix, never blaming, keeping the input** [8]. Don't use a disappearing toast for an error [9].
- **Confirm only the destructive and the rare; prefer Undo.** Name the thing in the confirmation and on the buttons ("Clear 23 counts" / "Keep counts"), not "Are you sure? OK/Cancel" [10]. Native `confirm()` can't label its buttons, so it always fails this rule. There are 8 `confirm()` calls in the internal components today.
- **Show status where people look, latest first, in plain words** [11]. Our scheduler's "Live / Not published / Hidden" badges are a good example. Spread them to every module (Saved / Not saved / Out of date).
- **Empty screens should say why they're empty and what to do next**, with one action button [12].
- **Touch targets at least 24×24 CSS px (WCAG 2.2 AA)** [13]. Aim for 44×44 on anything tapped often (WCAG 2.5.5 AAA, Apple HIG). Fields at 16px+ text also stop iPhones from zooming the page when a field is focused.

## 4. Data and charts

From NN/g [1] and the dataviz skill bundled with Claude Code:

- **Is it even a chart?** A single number is a stat tile; a handful is a row of tiles; more than ~7 categories is a table.
- **Bars and lines; one axis; sorted when categorical; recessive grid.**
- **Color is not magnitude.** Use length. Color carries identity (AM vs PM) or status, and status always comes with an icon and a word, never color alone (~8% of men have color-vision deficiency [1]).
- **Every chart has a table view.** The cash dashboard already does this ("By day"). Keep it.
- **Status colors are reserved:** good / warning / serious / critical, never reused for a data series.

## 5. Tabs, tables, saving

- **Tabs** only for a few distinct groups that don't need comparing; the default tab is the most used; the active tab gets two cues (underline + bold); one row only; never mix page links and in-page tabs in one row [14]. The Bookkeeping tabs pass. The scheduler's Schedule / Staff / Rules mostly pass.
- **Tables:** first column is a human identifier (date, name); freeze the header on long tables; inline row actions only for 1–2 actions; batch actions via checkboxes; edit in a side panel rather than a modal [15].
- **Check before submit** for anything that becomes a permanent record (write-ups): a "check your answers" summary with "Change" links, and a submit button that says what it does ("Save write-up — it can't be edited after") [16].

## 6. Records and compliance

- **IRS:** keep employment tax records at least 4 years after the tax is due or paid; general business records at least 3 years [17]. Cash-out days (31-day TTL in the Worker) and inventory days (366-day TTL) are bookkeeping evidence and are deleted far sooner.
- **Paycheck deductions for drawer shortages:** federal law (FLSA) generally doesn't allow a deduction that drops pay below minimum wage or cuts into overtime. Texas Payday Law requires **written, specific** authorization for wage deductions. **(verify both with TWC and DOL — the official pages would not load.)** That's why the paycheck deduction approval form exists. Anything we build around "short drawer → deduction" must keep that signed step.
- **Personnel records** (write-ups, applications with SSNs and medical questions) are sensitive. The hiring application asks for SSN, felony history, and medical limitations up front. Several of those questions are commonly restricted or discouraged on applications (ADA medical questions before an offer, and ban-the-box rules in some places). **Have someone review the application form before it's digitized.** (verify)

## Sources

1. NN/g — Dashboards: Making Charts and Graphs Easier to Understand. https://www.nngroup.com/articles/dashboards-preattentive/
2. NN/g — 10 Usability Heuristics. https://www.nngroup.com/articles/ten-usability-heuristics/
3. NN/g — Progressive Disclosure. https://www.nngroup.com/articles/progressive-disclosure/
4. GOV.UK Design System — Question pages. https://design-system.service.gov.uk/patterns/question-pages/
5. USWDS — Components overview. https://designsystem.digital.gov/components/overview/
6. MarginEdge — product overview. https://www.marginedge.com/
7. NN/g — Mobile input checklist. https://www.nngroup.com/articles/mobile-input-checklist/
8. NN/g — Error message guidelines. https://www.nngroup.com/articles/error-message-guidelines/
9. NN/g — Indicators, validations, notifications. https://www.nngroup.com/articles/indicators-validations-notifications/
10. NN/g — Confirmation dialogs. https://www.nngroup.com/articles/confirmation-dialog/
11. NN/g — Status trackers and progress updates. https://www.nngroup.com/articles/status-tracker-progress-update/
12. Atlassian Design — Empty state. https://atlassian.design/foundations/content/designing-messages/empty-state
13. W3C — Understanding SC 2.5.8 Target Size (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
14. NN/g — Tabs, used right. https://www.nngroup.com/articles/tabs-used-right/
15. NN/g — Data tables. https://www.nngroup.com/articles/data-tables/
16. GOV.UK Design System — Check answers. https://design-system.service.gov.uk/patterns/check-answers/
17. IRS — How long should I keep records? https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records

Not reachable during research (worth reading directly): 7shifts and Homebase feature pages, Toast cash-drawer support articles, Texas Workforce Commission wage-deduction guidance, DOL WHD Fact Sheet on deductions.
