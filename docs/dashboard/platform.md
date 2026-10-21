# The platform: shell, sign-in, saving, data

How the internal area works around the individual tools. Module pages assume everything here.

## 1. Who uses it, where, and when

| Person | Device | When | What they need |
|---|---|---|---|
| **Owner / GM** | Laptop at home or office, phone | Morning, weekly | Both stores at a glance: deposits, shorts, missing days, labor. Bookkeeping exports. Write-ups |
| **Store manager** | Office PC or phone, in the store | Open, mid-shift, close | Today's checklist, cash out, inventory count + order, next week's schedule |
| **Shift lead** | Phone, standing, in a hurry | Close of AM and PM shift | Cash out for their shift. Maybe inventory count |
| **Crew** | Own phone | Before a shift | Their schedule (public `/schedule` viewer). Later: request time off, swap |

Design for the **shift lead on a phone** first. If it works for them, it works for everyone.

## 2. Information architecture

```
/internal                 Today (home)           ← the only URL anyone needs to remember
/internal/cash            Cash out + cash history (today: bookkeeping#cash-out + dashboard charts)
/internal/bookkeeping     Daily sales report, employee hours
/internal/inventory       Count, order list, edit items
/internal/schedule        → the scheduler (today: /scheduler-demo/[station])
/internal/forms           Blank forms, write-ups
/internal/qr-generator    (tucked under "More")
/schedule                 Public staff viewer (stays public, outside the shell)
```

- **One home URL.** Bookmark `/internal` on every manager phone and the office PC. Add a web app manifest so it can be "Added to Home Screen" with the China Rose icon. That's the closest thing to an app with no app store.
- **Top-level nav = the six jobs.** Keep it to six or fewer; the QR generator and rarely used things go under "More".
- **Cash gets its own page.** Today cash out is a tab inside Bookkeeping, and the cash charts are on the home page. Cash is a daily, every-shift job; bookkeeping converters are once-a-day-or-less office work. Move cash out next to its history and charts. Keep `/internal/bookkeeping#cash-out` as a redirect so old links work.
- **Scheduler moves under the internal shell.** Today it lives in the `(public)` route group, with the public nav and footer and analytics. Moving its pages under `(order-shell)/internal/schedule/[station]` (or giving it the internal layout) makes it feel like the same product. It also takes the scheduler out of GA page views (the README says internal routes are deliberately untracked).

## 3. Shell

Every internal page renders inside `src/app/(order-shell)/internal/layout.tsx`, which grows from "yellow banner" to:

1. **Header:** "China Rose · Internal" (link home), store switcher, Lock button.
2. **Nav:** Home · Cash · Bookkeeping · Inventory · Schedule · Forms. Current page has two cues (bold + underline). On phones the row scrolls sideways; no hamburger, because hidden nav is forgotten nav.
3. **Yellow "Internal use only" banner:** keep it, but make it smaller (one line, under the header). `print:hidden` stays.
4. **Page:** h1 + save status, problem summary, work, action bar.

## 4. Sign-in: one door

**Today:** there are five separate code gates (dashboard cash board, cash out, inventory, write-ups, scheduler `DemoGate`), each holding the code in its own component state. Moving from Inventory to Cash out asks again. Write-ups also sits below the Forms list as a second gate on the same page.

**Should be:** a `ManagerCodeProvider` in the internal layout (`DemoGate`'s context, `useManagerCode()`, is the pattern to copy).
- Unlock once per visit; every internal page reads the code from context.
- Pages that don't need the code (forms list, sales and hours converters, QR) render without asking.
- Pages that do need it show the gate **inline in place of the content**, keeping the shell, so people know where they are.
- **Auto-lock** after 15 minutes idle and on "Lock". This matters more now that the code is shared across pages on a shared office PC.
- Keep the code in memory only, never in storage (current, correct choice). A reload asks again. If that proves annoying, `sessionStorage` (cleared when the tab closes) is the next step. Don't use `localStorage`.

**Later, when individual accounts matter** (crew requesting time off, knowing *who* saved a cash out): per-person PINs. Each manager gets a 4–6 digit PIN, and the Worker stores a hash per person, so saves record "Saved by Maria". This is how POS systems work and staff already understand it. It's the prerequisite for an audit trail and for employee self-service (see improvements.md).

## 5. Store context

- The store switcher in the header sets the store for every page (cash out, inventory, dashboard filter, scheduler station list).
- Remember the last store **on the device** (`localStorage` is fine; it isn't secret).
- Pages that only exist for one store (inventory is CR3-only today) say so: "Inventory is set up for CR3 only. [Switch to CR3]".
- "Both stores" is a valid choice only on overview pages (home, cash history).

## 6. Saving model (all modules)

| Layer | Where | Lifetime | Shown as |
|---|---|---|---|
| Draft | `localStorage` per module, per store, per date | Until saved or cleared | "Draft on this device" |
| Saved | Worker KV | See retention below | "✓ Saved 2:14 PM" |
| Exported | Excel/PDF download, print | Forever (owner's files) | — |

Rules:
- Draft keys include the store and date (`cr-cash-out:CR3:2026-10-20`). Today cash out uses a single `cr-cash-out` key, so switching store or date keeps the other store's numbers on screen. That's a real risk of saving CR2's counts as CR3.
- Every server save sends `baseRev` for optimistic concurrency (scheduler, inventory list, and staff already do; cash-out and inventory day saves don't). Two managers saving the same day should see "someone else saved this" instead of last-write-wins.
- Every saved record stores `updatedAt` **and**, once PINs exist, `updatedBy`.

## 7. Data retention

| Data | Today (Worker TTL) | Should be | Why |
|---|---|---|---|
| Cash-out days | **31 days** | ≥ 4 years, or 31 days + a monthly export the owner files | Bookkeeping evidence; IRS keeps employment-tax records 4 years, general records 3 |
| Inventory days | 366 days | 2 years | Year-over-year comparison (same week last year) |
| Inventory item list | No TTL | No TTL (correct today) | It's configuration; losing it silently resets to the built-in list |
| Golden schedules | 1 year, refreshed on save | ≥ 3 years | Schedules back up hours worked in a wage dispute **(verify with an accountant)** |
| Write-ups | No TTL | Keep, with a delete path for the owner only | Personnel records |
| Employees / template | 1 year, refreshed on save | No TTL | Configuration |

KV storage is cheap at this size: a cash-out day is a few KB, so 4 years × 2 stores is ~3,000 small keys. The 30-day history endpoint can stay as it is; only the TTL changes. If the history list should go further back, add a `?from=` range and page through it.

**Backups.** There's no backup today. Add a scheduled Worker (Cron Trigger) or a GitHub Action that, once a week, reads every key and writes a JSON dump to R2 or emails it. "Deploys do not reset data" (worker README) is true, but a deleted namespace or a bad script would be.

## 8. Phones, tablets, desktops

- Every flow must work at 375px wide. Test cash out and inventory on a real phone.
- Wide tables (cash history, inventory with past columns) scroll sideways inside their card, with the first column frozen (`sticky left-0`).
- Inventory already hides past columns on phones; keep that pattern for other wide sheets.
- Big tap targets (44px) matter most on the counting screens (cash and inventory), where people tap hundreds of times.

## 9. Printing

Paper is still the fallback when the internet drops, and some records (write-ups, signed deduction forms) need a signature. Every sheet keeps a print layout that matches the paper version. The shell, nav, and buttons stay `print:hidden`.

## 10. Security notes

- The manager code is a single shared secret (`SCHEDULE_WRITE_TOKEN`). Anyone who has it can read every cash figure and every write-up. Rotate it when a manager leaves (worker README: `wrangler secret put`), and tell the team that rotation is normal.
- The staff password for crew editing defaults to the hardcoded `test` (`DEFAULT_STAFF_EDIT_PASSWORD` in `worker/src/index.ts`). Set the `STAFF_EDIT_PASSWORD` secret before relying on it.
- Gate guesses are throttled (30/hour per IP) and writes too (60/hour per IP). Good. Keep it.
- `ALLOWED_ORIGIN` limits CORS when set. Make sure it's set in production to `https://chinarosesa.com`.
- Write-ups and future HR forms hold personal data. Don't add SSNs, medical info, or bank details to KV. Keep those on paper or in a proper HR/payroll system.
