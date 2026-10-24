# Current-state inventory

Verified by local source inspection on 2026-10-24. Live endpoints, resources, staff usage, and production contents were not inspected. Source presence does not establish that a Worker version is deployed. The [research](../internal-tools-research.md) supplies supporting workflow evidence; this inventory checks repository claims.

## Frontend and shared experience

[Next configuration](../../next.config.ts) sets `output: 'export'`, optional NEXT_PUBLIC_BASE_PATH, and unoptimized images. The [internal layout](<../../src/app/(order-shell)/internal/layout.tsx>) adds an English internal-use banner. [Dashboard](../../src/components/internal/Dashboard.tsx) links bookkeeping, inventory, scheduler, and forms; QR generation is a separate route. [Bookkeeping](../../src/components/internal/Bookkeeping.tsx) uses #cash-out, #sales, and #hours tabs and keeps panels mounted. Its manager token is memory-only; converters can work without it. Sources contain local English strings, with no common bilingual context/draft service. Preserve branding and existing route/basePath behavior: UX-01–07, DASH-02, REL-04.

## Capabilities to preserve and gaps to assign

| Area and verified entry points | Existing capability | Gap / task ownership |
| --- | --- | --- |
| [SchedulerDemo](../../src/components/scheduler/SchedulerDemo.tsx), [PublishPanel](../../src/components/scheduler/PublishPanel.tsx), [StaffEditor](../../src/components/scheduler/StaffEditor.tsx), [scheduler library](../../src/lib/scheduler/), [ScheduleViewer](../../src/components/schedule/ScheduleViewer.tsx) | Generation, independent validation, locks/manual assignment, copy prior week, undo, guided issues, weekly hours, draft/live state, visibility, print, person filters | SCH-01–07 add dated exceptions, review, publication history, shared identities/hours, bilingual/device flow; SCH-08 owns regression coverage |
| [CashOut](../../src/components/internal/CashOut.tsx), [cashout](../../src/lib/cashout.ts), [store](../../src/lib/cashout-store.ts) | Integer cents; fixed FLOAT_CENTS=10000; denomination counts, AM/PM totals, Toast/Z comparison, saved-day loading, print and 30-day history | cr-cash-out local draft contains sheet only; changing store/date leaves sheet state; client sends totals trusted for shape by server. CASH-01–08; DEC-01/02/03/04 |
| [Inventory](../../src/components/internal/Inventory.tsx), [inventory](../../src/lib/inventory.ts), [store](../../src/lib/inventory-store.ts) | CR3 paper-derived sections, INV/ORDER free text, Enough ✓, numeric/fraction suggestions, previous columns, edit list, supplier groups, copy, print; local draft includes date/counts | CR3 hardcoded; counts keyed by item IDs lack historical catalog snapshots; supplier units unknown; no persistent order/receipt workflow. INV-01–10; DEC-05 |
| [SalesConverter](../../src/components/internal/SalesConverter.tsx), [parseToast](../../src/lib/converter/parseToast.js), [fillTemplate](../../src/lib/converter/fillTemplate.js) | General/lunch/dinner slots, current template cell mapping, manually selected weekday/date, cash-out fill when manager unlocked, Excel download | Files/form reset after success; extraction happens during conversion without an independent review stage or import history. IMPORT-01–04/07 |
| [HoursConverter](../../src/components/internal/HoursConverter.tsx), [parseCSV](../../src/lib/converter/parseCSV.js) | CSV parsing, grouped employee workbook, regular/overtime/source hours, date range in filename | groupByEmployeeExternalId skips missing IDs; selected date range does not filter rows; no mapping review/history. IMPORT-01/03/05–08 |
| [Forms page](<../../src/app/(order-shell)/internal/forms/page.tsx>), [WriteUps](../../src/components/internal/WriteUps.tsx), [store](../../src/lib/writeup-store.ts), [blank files](../../public/internal/forms/) | Eleven blank downloads, saved write-up list, immutable submitted form, editable manager label, paper-oriented output, typed signature/date fields | No persistent draft/amendment/attachment/follow-up flow or searchable multi-type list. FORM-01–07; DEC-06/07 |
| [Dashboard](../../src/components/internal/Dashboard.tsx), [helpers](../../src/lib/dashboard.ts) | Manager-gated cash summary, 7/14/30-day views, store filter, missing close count; missing close link opens a general tab | No common work-queue contract; no exact-record targets or other service status inputs. DASH-01–05 |
| [QRGenerator](../../src/components/internal/QRGenerator.tsx), [OrderReview](../../src/components/order/OrderReview.tsx) | Customer table codes to /order; simulated submit logs payload and writes orders/lastOrder/orderCount in browser localStorage | No restaurant transmission; status of prototype is unresolved. LATER-07. Shelf lookup scanning is LATER-04 |

## Existing API consumers and access

The [Worker source](../../worker/src/index.ts) is authoritative over comments in [Worker README](../../worker/README.md). The README's introductory roster/staff bullets describe public reads, but actual GET routes require manager authorization; preserve the stricter source behavior. The global/per-week roster/template distinctions also require source inspection.

| Current route family | Consumers / compatibility | Access and mutation behavior |
| --- | --- | --- |
| /api/health, /api/auth/verify | Gate checks and [verification script](../../scripts/verify-schedule-store.mjs) | Health public; auth verifies manager bearer token, separately throttled |
| /api/weeks, /api/weeks/:id | [schedule-share](../../src/lib/schedule-share.ts), encrypted legacy links | Existing ciphertext/link contract and rev/baseRev; preserve ID format, TTL and public encrypted fetch behavior |
| /api/schedule?month=…, /api/schedule/:weekStart | [schedule-store](../../src/lib/schedule-store.ts), scheduler and public viewer | Public reads; month list includes visible weeks, knownRev/notModified optimization; manager writes with rev/baseRev |
| /api/employees?restaurant=… and optional weekStart | [employee-store](../../src/lib/employee-store.ts), scheduler | Manager read/write; per-week override with global fallback; not yet a cross-station employee directory |
| /api/template?restaurant=… and optional weekStart | [template-store](../../src/lib/template-store.ts), scheduler/viewer | Public read, manager write; week/global fallback; special station rules remain enforced |
| /api/staff, /api/staff/verify, /api/staff/undo | [staff-store](../../src/lib/staff-store.ts), CR3 Kitchen crew editor | Manager read; separate staff password or manager authorizes crew writes; last 10 replaced crews; staff password does not authorize schedule publishing |
| /api/cashout/{CR3\|CR2}[/{date}] | cashout-store, Bookkeeping sales fill, Dashboard | Manager read/write; history 30 dates, last save wins; submitted client totals validated by shape only |
| /api/inventory/CR3, /api/inventory/CR3/{date}, /api/inventory/CR3/list | inventory-store, Inventory | Manager access; history 14 dates; count writes last save wins; list writes use rev/baseRev |
| /api/writeups[/:id][/label] | writeup-store, WriteUps mounted at /internal/forms | Manager read/write; create immutable original, list/get, update label only. Worker README's /internal/write-ups path is stale |

[Station IDs](../../src/data/restaurants.ts) are CR3-diningroom (default), CR3-kitchen, CR2-kitchen, CR2-diningroom. The legacy `restaurant` parameter means station, while cash-out `CR2`/`CR3` means physical store. CR3 Kitchen is the special schedule-only station. Default-station legacy key fallback does not apply to the other stations. Station-specific IDs/names do not establish shared employee identity.

## KV key and retention inventory

These describe current code, not approved future retention policy. DEC-03 owns that decision. Actual TTL expiration means already missing data may be unrecoverable; migration must not claim otherwise.

| Key family | Current contents and lifetime | Migration/compatibility owner |
| --- | --- | --- |
| week:{id}, month:{YYYY-MM} | Encrypted legacy document and month index; DOC_TTL_SECONDS=31536000 on saved records/index writes | DATA-07/08/09, SCH-08 |
| r:{station}:golden:{weekStart}, r:{station}:golden:month-rev:{month} | Golden week and month revisions; 31536000-second TTL on writes; month revision also tracks spanning weeks | DATA-07/09, SCH-04/08 |
| golden:{weekStart}, golden:month-rev:{month} | Pre-partition default-station fallback, retained during compatibility | DATA-07/09, SCH-08 |
| r:{station}:roster:current, r:{station}:roster:{weekStart}, roster:current | Global/week roster and legacy default fallback; 31536000-second TTL on writes | DATA-04/07/09 |
| r:{station}:template:current, r:{station}:template:{weekStart}, template:current | Global/week staffing rules and default fallback; 31536000-second TTL on writes | DATA-07/09, SCH-08 |
| r:{station}:staff:current | Station crew plus up to 10 history snapshots; 31536000-second TTL on writes | DATA-04/07/09, SCH-08 |
| cashout:{store}:{date} | Sheet/totals; 31-day TTL; list covers 30 days | CASH-03–08, DATA-07/09 |
| inventory:{store}:{date} | CR3 count cells; 366-day TTL; list covers 14 dates | INV-01/05/10, DATA-07/09 |
| inventory-list:{store} | CR3 saved catalog with rev; no explicit TTL | INV-03/05/10, DATA-07/09 |
| writeup:{id} | Immutable form and editable label; no TTL; key metadata carries date/employee/label | FORM-01/04/07, DATA-07/09 |

All business data currently uses SCHEDULES KV. Existing read/compare/write revision code is not a transactional compare-and-swap guarantee; DATA-05 establishes atomic mutations and history in D1. No D1/R2 schema, migrations, attachments service, persisted import jobs, or purchasing/receiving services are present.

## Commands and release boundaries

[package.json](../../package.json) currently provides:

| Existing command | Scope / caveat |
| --- | --- |
| npm ci | Install locked dependencies; not run for this documentation work |
| npm run dev | Next dev; no implicit local Worker or local API override |
| npm run build | Next build plus scripts/mirror-trailing-slash.mjs; static out/ |
| npm exec tsc -- --noEmit | Standalone type check; CI uses npx tsc --noEmit |
| npm run seo:check | Generated static-output SEO/routing checks; build first |
| npm run scheduler:test | Node/jiti suites for scheduler, visibility, editor state, helpers, share/store, and worker/src/index.test.ts |
| npm run cashout:test | cashout, dashboard, and inventory helper suites |
| npm run scheduler:verify -- <verified-api-base> | Read-only live route probe; defaults to the production URL when omitted. Manager token optional; no token only proves protected roster returns 401. It logs returned summaries; handle evidence privately |
| npm run scheduler:seed-kitchens | Writes live station data; not a test or read-only prerequisite; excluded from documentation verification |
| npm start | next start exists as a script; do not presume it serves this static export correctly |

There is no dedicated imports/forms test script, D1 migration runner, pinned Worker build/deploy package script, or restore tool yet. DATA-02/07/10 and REL-01/02 must deliver exact commands before use.

[deploy.yml](../../.github/workflows/deploy.yml) builds with Node 22, runs type/build/SEO checks, and publishes out/ to GitHub Pages. It does **not deploy the Worker**, provision storage, configure bindings, or run migrations. [worker/wrangler.toml](../../worker/wrangler.toml) points to worker/src/index.ts and contains `REPLACE_WITH_YOUR_NAMESPACE_ID` for SCHEDULES. Never deploy that placeholder or invent the real ID. [worker/dashboard.js](../../worker/dashboard.js) is a checked-in JavaScript deployment mirror; its byte/behavioral parity has not been established here. REL-02 owns reproducibility and drift.

The Worker uses SCHEDULE_WRITE_TOKEN and an optional STAFF_EDIT_PASSWORD override; current source includes a demo staff-password fallback. Preserve the current authorization boundary during baseline work and coordinate a separate LATER-01 change. [schedule-store](../../src/lib/schedule-store.ts) permits NEXT_PUBLIC_SCHEDULE_API and otherwise defaults to the existing Worker URL. A production-looking default is not proof of current deployment state.
