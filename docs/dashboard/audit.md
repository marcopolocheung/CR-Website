# Audit snapshot (2026-10-20, branch `feat/cr3-inventory-editor`)

What's in the code today, for anyone planning changes. Line counts are approximate.

## Routes

| URL | Shell | Gate | Component |
|---|---|---|---|
| `/internal` | internal (yellow banner) | manager code (cash board only) | `Dashboard.tsx` (341) |
| `/internal/bookkeeping` | internal | manager code (cash out tab only) | `Bookkeeping.tsx`, `CashOut.tsx` (387), `SalesConverter.tsx` (179), `HoursConverter.tsx` (83) |
| `/internal/inventory` | internal | manager code | `Inventory.tsx` (418) |
| `/internal/forms` | internal | manager code (write-ups section) | `forms/page.tsx`, `WriteUps.tsx` (370) |
| `/internal/qr-generator` | internal | none | `QRGenerator.tsx`. **Not linked from anywhere** |
| `/scheduler-demo/[station]` | **public** (Nav, Footer, Analytics) | manager code (`DemoGate`) + staff password for CR3 kitchen crew | `SchedulerDemo.tsx` (2,082) + 8 files |
| `/schedule/[station]` | public | none | `ScheduleViewer.tsx` (725) |

## Backend

One Cloudflare Worker (`worker/src/index.ts`, 1,707 lines) with one KV namespace (`SCHEDULES`). Manager token `SCHEDULE_WRITE_TOKEN` for all gated routes; staff password defaults to `test`. Throttles: 60 writes/h, 30 gate guesses/h per IP. TTLs: cash-out 31 days; inventory days 366 days; schedules/employees/templates 1 year refreshed on save; inventory list and write-ups none.

## Inconsistencies

| Thing | Variants found |
|---|---|
| Primary button | `bg-red-600` (cash out, inventory, write-ups, dashboard segmented) vs `bg-zinc-900` (scheduler) |
| Neutral palette | `gray-*` (internal) vs `zinc-*` (scheduler, viewer) |
| Field class | `inputClass` defined separately in CashOut, SalesConverter, HoursConverter; inline in Inventory, WriteUps |
| Status message | `<p role="status">` with plain text in each module; red text for every status in WriteUps (including "Saved.") |
| Store labels | `STORE_LABELS` defined in both Dashboard and CashOut; converters use full address strings `LOCATIONS` |
| `today()` | Defined in 4 files |
| Busy/error wrapper `run()` | Copied in CashOut, Inventory, WriteUps |
| Confirmations | 8 `window.confirm()` calls; scheduler has its own in-page confirm for reset |
| Tabs | Bookkeeping uses `role="tablist"`; scheduler uses `aria-pressed` buttons in a `nav` |
| Gates | `CodeGate` (exported from CashOut.tsx, used 4×) and `DemoGate` (scheduler) |
| Text size | `text-sm` (14px) for most fields and body on internal pages |
| Low-contrast text | `text-gray-400`/`500` used for hints and empty values in a few places |

## Strengths worth keeping

- Integer-cent money math with null-not-zero for unentered figures (`cashout.ts`), tested.
- Paper-faithful layouts and print styles (inventory, write-ups).
- Optimistic concurrency and clear conflict messages (inventory list, scheduler, staff).
- Scheduler solver/validator split, diagnostics, guided fixes, publish states, 869 lines of tests.
- Cash dashboard chart: validated palette, keyboard focus, table fallback.
- Manager code kept in memory only.
- Plain-language copy in most places.

## Tests

`npm run scheduler:test`, `npm run cashout:test` (cashout, dashboard, inventory). No component tests; no end-to-end tests. UI changes should be checked by running the app (`/run` skill) at 375px and desktop widths.
