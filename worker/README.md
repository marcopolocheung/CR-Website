# Schedule store Worker (Cloudflare, free tier)

Two stores in one Worker:

- Legacy per-link blobs (`/api/weeks`): kept read/write compatible so old
  staff links keep working. New development should use the golden schedule.
- Golden schedule (`/api/schedule`): one persistent codeless schedule per
  station, keyed by week start (`r:{restaurant}:golden:YYYY-MM-DD`), edited by
  `/scheduler-demo/{restaurant}` and read by `/schedule/{restaurant}`. Docs hold
  the plaintext week plus `visible` for the manager's week on/off toggle and
  `rev` for optimistic concurrency.

## Published time snapshots (special-hours foundation)

New manager publications include an additive `snapshot` on the existing v3 golden
document: `{ version: 1, basis: 'published', slots: [...] }`. Slots preserve their
published index order, IDs, days, periods, roles, labels, exact start/end times and
required flags. Dated editor fields are excluded. The share payload stays version
1 and existing staff URLs remain valid. Readers prefer the snapshot and refuse an
invalid/unknown snapshot rather than substituting current rules.

Before a weekly or global rules overwrite, legacy layouts are captured under
`r:{restaurant}:publication-layout:{weekStart}:{sha256-of-original-document}`.
These separate records do not rewrite a concurrent publication or change its
revision, timestamp or report employee keys. Their basis is `legacy-captured`:
the captured rules remain an estimate of historical times. Capture failure blocks
the rules save. Global saves scan all relevant station/default legacy week keys,
including paginated listings. These records use the existing one-year schedule
TTL. No D1 schema, binding or data migration is introduced by this foundation.

`GET /api/health` advertises `scheduleSnapshotVersion: 1`. The new client checks
support before publishing or saving rules. `PUT /api/template` can return
`preservedPublication` so the manager retains the correct baseline. Once a
publication has an inline or preserved snapshot, a legacy client cannot overwrite
it without a snapshot. Invalid persisted snapshots produce a read error rather
than a missing week. The publication request limit is 200,000 characters to
accommodate the existing maximum of 200 indexed slots; other body limits remain
unchanged.

Coordinate deployment of compatible readers and the backend before new snapshot
writes. Older running frontend tabs must reload; older Workers discard unknown
fields, and older readers still reconstruct times from mutable rules. A reader-
compatible release or maintenance window is necessary; a frontend-only deployment
does not activate Worker support. Reverting only the Worker would discard these
protections. Preserve all snapshots and deploy a compatible reader/writer for
rollback. Existing KV read/check/write revisions are **not atomic CAS**; this
slice does not introduce stronger cross-document concurrency guarantees.

The staff viewer and scheduled-versus-actual reader consume inline and preserved
snapshots. Reports distinguish `published-snapshot` timing from `legacy-estimate`
and retain the legacy caveat for captured rules. Restaurant-wide dated events,
closure labels and Hours controls are now implemented locally; their [completion
checkpoint](../docs/internal-tools-overhaul/checkpoints/special-hours.md) records
remaining activation and review gates.

[Checkpoint and verification](../docs/internal-tools-overhaul/checkpoints/special-hours-publication.md).

### Dated restaurant hours service

Manager-authenticated `GET /api/internal/special-hours/{CR2|CR3}?start=YYYY-MM-DD&end=YYYY-MM-DD`
reads up to 31 days of events, station reviews and publication references.
`PUT /api/internal/special-hours/{store}/{date}` accepts the existing mutation
envelope under `mutation`. Station review PUTs append `/review/{station}` and
include the normal `baseSlots` for independent choice validation. Reviews carry
their own revisions, the source event snapshot/revision, normal-rule fingerprint
and exact affected-slot decisions. The existing store/station IDs and authorization
rules are retained; the UI preserves the protected kitchen editor.

Records use the existing D1 schedule family with reserved IDs `hours-{date}` and
`hours-review-{station}-{date}`. They are dated configuration/review records, not
assignment drafts or rows in the legacy `schedules` relational projection. Existing
core/atomic-history migrations suffice. No raw uploads or new identity mapping
rules are introduced.

KV `r:{store}:special-hours:active` records that the service has been used. It is
set before accepting mutations, so removing `INTERNAL_DB` cannot silently restore
legacy publishing over known closures. Without prior activation, a missing binding
returns `backend_unconfigured` and the new controls remain unavailable. After
activation, a missing binding is an unavailable/unknown state and publication is
blocked. Keep the marker and D1 records when reverting UI code. A target binding
and initialized schema must be verified independently of a successful local build.

Published snapshots retain reviewed `specialHours` date labels and source
revisions. The server rechecks current event/review versions and effective slots
before saving a publication, including legacy clients omitting the metadata.
Normal templates remain separate from exceptions, so copy/navigation do not make
holidays recur. A full explicitly closed week may publish an empty assignment list.
The optional Node assistant must support the new effective-layout context for
dated-hours weeks; ordinary weeks retain the old context shape.

Run `npm run scheduler:hours:worker:test` for disposable D1/KV integration coverage.
See the [complete workflow and rollout contract](../docs/internal-tools-overhaul/special-hours.md).

## Other stores

Plus two more stores, keyed separately per station:

- Employee roster (`/api/employees?restaurant={id}`): one persistent staff list
  per station (`r:{restaurant}:roster:current`), edited by `/scheduler-demo`.
  Public read, token-guarded write, same optimistic concurrency (`rev`/`baseRev`)
  as the golden schedule.
- Staffing template (`/api/template?restaurant={id}`): one persistent set of
  weekly shift rules per station (`r:{restaurant}:template:current`) — which roles
  are needed on each day/shift, and their hours. Edited by `/scheduler-demo`,
  read by both `/scheduler-demo` and `/schedule` so they always agree on shift
  layout. Same public-read, token-guarded-write, optimistic-concurrency pattern.
  Falls back to the app's built-in default layout when nothing has been saved
  yet (`rev: 0`).

- Station crew (`/api/staff?restaurant={id}`): the editable crew for
  schedule-only stations (`r:{restaurant}:staff:current`). One crew per station,
  shared by every week — the CR3 Kitchen crew editor saves here. Public read,
  password-guarded write. The Worker keeps the last 10 replaced crews so
  `POST /api/staff/undo` can step back through recent saves. `employees: null`
  means no crew has been saved yet; the app falls back to its built-in crew.

- Cash-out days (`/api/cashout/{CR3|CR2}/{YYYY-MM-DD}`): one saved cash-out
  sheet per store per day (`cashout:{store}:{date}`), with each cashier's counts
  and the computed AM/PM deposit and over/short. Written by `/internal/bookkeeping` (Cash out tab),
  read by that page and its Daily sales report tab to fill the deposit cells.
  `GET /api/cashout/{store}?to={date}` lists the 30 days ending at `to`.
  Reads AND writes need the manager token (cash figures, not public). Days
  expire after 31 days; last save wins.

  Sheets may include optional `extraMoney` dollar text for cash found after the
  drawer counts. It increases the day deposit and Z-report comparison; cashier
  and shift Toast comparisons retain their original figures. The Worker validates
  this amount, recalculates totals, and echoes `extraMoney` in a successful PUT
  response. Deploy the updated Worker before the cash-out frontend: older
  Workers discard this field, and the new frontend keeps the device draft and
  reports setup incomplete rather than confirming such a save. No KV migration
  or binding change is required.

- Employee write-ups (`/api/writeups`): one record per write-up
  (`writeup:{id}`), entered on `/internal/forms`. `GET /api/writeups` lists
  them by date (newest first) then employee, `POST /api/writeups` saves a new
  one, `GET /api/writeups/{id}` reads one, and `PUT /api/writeups/{id}/label`
  rewrites its manager label. `DELETE /api/writeups/{id}` removes the
  record and its list metadata. The form itself is never edited after saving.
  Reads AND writes need the manager token. Records never expire. The list row
  (date, employee, label) is kept as KV key metadata so listing needs no reads.

- Digital injury reports, customer complaints, payroll change requests, and pay
  rate increase applications (`/api/forms`): one versioned record at `form:{id}`
  in the same KV binding, with type-specific validated answers and summary
  metadata. `GET /api/forms` lists, `POST /api/forms` creates, `GET /api/forms/{id}`
  reads, `PUT /api/forms/{id}/label` labels, and `DELETE /api/forms/{id}` deletes
  the document and its list metadata. Answers are immutable, records do not expire,
  and all endpoints require the manager token. No D1 migration is required.
  Deploy these endpoints before the updated forms frontend.

Stations: `CR3-diningroom` (default, owns pre-partition legacy data),
`CR3-kitchen`, `CR2-kitchen`, `CR2-diningroom`. Omit `?restaurant=` to read the
default station. Unknown `?restaurant=` values answer `400 invalid_restaurant`.
Pre-partition singleton keys (`golden:*`, `roster:current`, `template:current`)
are served as a read fallback for the default station only — first save to the
default station writes to the new `r:CR3-diningroom:*` keys.

## Deploys do not reset data

GitHub Pages builds (`deploy.yml`) only ship the static frontend — they never
touch the Worker or its KV namespace, so a merge cannot wipe rosters, rules, or
published weeks. If the scheduler looks default after a deploy, run
`npm run scheduler:verify`: live revs mean the data survived and the page is
showing built-in fallbacks (offline store, unsaved edits, or a week with
nothing published yet).

Dashboard paste deploys: keep the existing `SCHEDULES` binding attached. A
deploy with a missing or fresh binding serves empty stations (`rev: 0`) while
the real data sits untouched in the old namespace.

## Write token (golden schedule)

Golden writes require a manager token. Set it as a Worker secret (never in
code or in a `NEXT_PUBLIC_` variable):

```sh
wrangler secret put SCHEDULE_WRITE_TOKEN --config worker/wrangler.toml
```

Dashboard deploys: Worker → Settings → Variables → Add secret
`SCHEDULE_WRITE_TOKEN`. Without it, golden `PUT`s answer `503
write_not_configured`; with a wrong token they answer `401 unauthorized`.
The manager types the token into the demo on every save — it is never stored
in `sessionStorage` or `localStorage`, by design.

## Staff password (crew editor)

Crew editing on schedule-only stations (CR3 Kitchen) is hidden behind a
separate staff password. It is **hardcoded for now** to `test` in
`worker/src/index.ts` (`DEFAULT_STAFF_EDIT_PASSWORD`) so it works with no Worker
setup. Override it for anything beyond the demo:

```sh
wrangler secret put STAFF_EDIT_PASSWORD --config worker/wrangler.toml
```

Dashboard deploys: Worker → Settings → Variables → Add a variable/secret
`STAFF_EDIT_PASSWORD`. When set, it takes the place of the hardcoded default;
the manager token also still authorizes crew writes. The password is typed into
the crew editor, checked against `GET /api/staff/verify`, and kept only in
memory for that page view.

## Toast cash fill (`GET /api/toast/cash/{CR3|CR2}/{YYYY-MM-DD}`)

The cash-out sheet's **Fill from Toast** button calls this route. It needs the
manager token, reads one business day from Toast's read-only Standard API
access, and returns only totals: each cashier's cash payments (AM if most of
their cash came in before 4 PM store time, else PM) and the day's Z report
expected cash = cash payments − cash refunds + cash in − cash out − pay outs −
tip outs. Voided payments and voided/deleted orders are left out. Raw orders,
the Toast secret and the Toast access token never reach the browser. The
24-hour Toast token is cached in KV under `toast:token`.

Set these on the Worker (dashboard: Worker → Settings → Variables). The client
ID and secret must be **secrets**; the location GUIDs are not secret:

| Name | Value |
| --- | --- |
| `TOAST_CLIENT_ID` | Toast Web → Integrations → Toast API access → Manage credentials |
| `TOAST_CLIENT_SECRET` | same credential set (secret) |
| `TOAST_GUID_CR2` | SW Military location GUID |
| `TOAST_GUID_CR3` | W Military location GUID |
| `TOAST_API_HOSTNAME` | optional; defaults to `https://ws-api.toasttab.com` |

```sh
wrangler secret put TOAST_CLIENT_ID --config worker/wrangler.toml
wrangler secret put TOAST_CLIENT_SECRET --config worker/wrangler.toml
```

Until all four required values are set the route answers `503
toast_unconfigured` and the page tells managers to type the figures in. Toast
trouble answers `502 toast_auth` or `502 toast_unavailable`.

## Toast sales (`GET /api/toast/sales/{CR3|CR2}/{YYYY-MM-DD}`)

The Reports page's **Sales from Toast** section first asks for every cached
day in one range request (below), then calls this route only for the days still
missing, two at a time. It uses the same manager token and Toast
settings as the cash fill and returns one business day's totals in cents:
net sales (Toast check amounts: after discounts, before tax and tips), gross
(= net + discounts), orders, an AM/PM split by when each order was opened (4 PM
store time), a Lunch/Dinner split by the meal periods configured in Toast
(orders without one are "other"), discounts by name, and voids by reason
(voided items, items on voided checks/orders; voided items never count as
sales). Deleted orders are ignored.

Caching keeps the Worker within free-tier request limits: a day older than
yesterday is stored in KV for 40 days (`toast:sales:v1:{store}:{date}`);
yesterday and today for 10 minutes. Meal-period and void-reason names are
cached for a day (`toast:config:v1:{store}`). A date that hasn't started in San
Antonio answers `400 invalid_date`. Errors match the cash fill route, plus
`503 toast_busy` when Toast keeps rate-limiting (the Worker waits up to 2 s for
Toast's `Retry-After` and retries once first).

### Sales codes (who can see which store)

Toast sales have their own codes, separate from the manager code, so a store's
staff can see only that store:

| Worker secret | Opens |
|---|---|
| `SALES_CODE_CR3` | CR3 sales only |
| `SALES_CODE_CR2` | CR2 sales only |

Setting both to the same value makes that one code open both stores. Once
**either** is set, the manager code no longer opens sales (it still
runs cash-out and Fill from Toast). Until then the manager code opens both
stores, so nothing breaks before activation. Every sales route checks the code
against the store: a code for the other store gets `403 forbidden_store`; a
wrong code gets `401` and uses the same wrong-code limit as the manager gate.
`GET /api/toast/sales/access` returns `{ stores }` for a code; the Reports
page asks it once when the code is entered. Codes live only in the page's
memory and are forgotten on **Lock sales** or when leaving the internal tools.
To remove someone's access, change that store's code.

Dashboard deploys: Worker → Settings → Variables and Secrets → Add → type
**Secret** for each code.

### Cached range (`GET /api/toast/sales/{CR3|CR2}?from=YYYY-MM-DD&to=YYYY-MM-DD`)

Sales code for that store required. Returns `{ store, days: { [date]: summary }, missing:
[date…] }` from KV only, so it never calls Toast and answers quickly. Up to 31
days; a backwards, longer or malformed range answers `400 invalid_range`.

### Hourly cache warm (cron)

The Worker's `scheduled` handler fills the newest finished days (older than
yesterday, last 30 days, both stores) that aren't cached yet, **two per run** so
each run stays within free-plan fetch and CPU limits. A cold cache fills in
about 30 hours; after that each run usually finds nothing to do. It skips itself
until the Toast settings are present.

Activation for dashboard deploys: Worker → Settings → Triggers → Cron Triggers →
Add → `0 * * * *` (hourly). `wrangler.toml` declares the same schedule for
wrangler deploys.

## Manager assistant (Gemini)

Optional. Set the Worker secret `GEMINI_API_KEY` (a Google AI Studio API key) to turn on:

- `POST /api/assistant/cash` `{ question, to }`: answers questions about the last 30 days of saved cash-out sheets for both stores. Read-only.
- `POST /api/assistant/schedule` `{ text, weekStart, employees, slots, assignments }`: turns a sentence like "Maria called out Friday" into proposed steps (`callout`, `remove`, `place`). The scheduler applies them to the draft only after the manager chooses **Apply to draft**, through the normal adjustment and Undo.

Both need the manager code and have their own limit of 30 calls per hour per IP (`429`). Without the secret they answer `503 assistant_unconfigured`, and the panels say the assistant isn't set up. Each call sends the question plus the needed staff names, shifts or cash figures to Google's Gemini API, using model `gemini-flash-latest` through its OpenAI-compatible endpoint. Use a key from a project with billing turned on: Google's terms let it use free-tier API content to improve its products. Neither route writes records.

```sh
wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
```

For local testing, put `GEMINI_API_KEY=...` in `worker/.dev.vars`.

## Deploy option A: dashboard paste (what you already did)

1. Open Workers & Pages → `chinarose-schedule-api` → Edit code.
2. Replace everything with the contents of `worker/dashboard.js` in this repo.
   It is plain JavaScript — the dashboard editor cannot run the TypeScript
   source in `worker/src/index.ts`, so always paste the `dashboard.js` build.
3. Deploy. Bindings must show `SCHEDULES` → your KV namespace.
4. Verify: open `https://<your-worker>.workers.dev/api/health` → `{"ok":true}`.

## Regenerating dashboard.js after editing the TypeScript source

```sh
npm run worker:build
```

This bundles the shared form definitions and other imported modules using the
pinned Wrangler dependency. `worker/src/entry.ts` exposes only the default
handler; `index.ts` also exports constants and helpers for tests, which cannot
be exposed as workerd service exports. The dashboard file has no external imports.

## Deploy option B: wrangler

```sh
npm i -g wrangler
wrangler login
wrangler kv namespace list   # copy the id into worker/wrangler.toml
wrangler deploy --config worker/wrangler.toml
```

## API

Legacy links:

- `POST /api/weeks { ciphertext, templateHash, weekStart }` → `201 { id, rev }`
- `GET /api/weeks/:id` → `200 { v, id, rev, ciphertext, templateHash, weekStart, updatedAt }`
- `PUT /api/weeks/:id { ciphertext, baseRev }` → `200 { rev }` or `409 { error: "conflict", rev }`
- `GET /api/health` → `{"ok":true}`

Golden schedule (public read, token-guarded write):

- `GET /api/auth/verify` with `Authorization: Bearer <token>` → `200 { ok: true }`, `401 unauthorized`, `503 write_not_configured`. Read-only gate check for the scheduler demo entry screen — same manager token as the writes below, own throttle budget (30/hour per IP) so guesses can never lock out saves.

- `GET /api/schedule?month=YYYY-MM` → `200 { weeks, rev, notModified }` (visible only, sorted). Pass `knownRev=<rev>` and the Worker answers `notModified: true` with no weeks when nothing changed — every golden save bumps the month rev (including the neighboring month when a week spans two), so readers revalidate with one tiny read instead of refetching.
- `GET /api/schedule/:weekStart` → `200 GoldenWeekDoc` or `404`
- `PUT /api/schedule/:weekStart { week, templateHash, visible, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`.

Employee roster (token-guarded read and write, same token as the golden schedule — rosters hold availability and who is kept apart, so they are not public):

- `GET /api/employees` with `Authorization: Bearer <token>` → `200 { employees, rev, updatedAt }` (empty roster if nothing saved yet), `401 unauthorized`
- `PUT /api/employees { employees, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev, updatedAt }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`. Removing an employee from `employees` and saving is a real, persisted delete.

Staffing template (public read, token-guarded write, same token as the golden schedule):

- `GET /api/template` → `200 { template, rev, updatedAt }` (`template: null`, `rev: 0` if nothing saved yet — callers should fall back to their own default layout)
- `PUT /api/template { template, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev, updatedAt }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`. Schedule-only stations (CR3 Kitchen) accept only per-week saves (`?weekStart=`, `403 station_locked` otherwise), authorized by the staff password or the manager token.

Station crew (token-guarded read, password-guarded write, schedule-only stations only):

- `GET /api/staff?restaurant=CR3-kitchen` with `Authorization: Bearer <token>` (manager token; the staff password does not read) → `200 { employees, rev, updatedAt, canUndo }`, `401 unauthorized` (`employees: null` means no crew saved yet — fall back to the built-in crew). `403 staff_editing_not_enabled` for stations whose crew is not editable.
- `GET /api/staff/verify` with `Authorization: Bearer <staff password>` → `200 { ok: true }`, `401 unauthorized`. Read-only gate check for the crew editor — own throttle budget (30/hour per IP). The password defaults to the hardcoded `test` when `STAFF_EDIT_PASSWORD` is unset.
- `PUT /api/staff?restaurant=CR3-kitchen { employees, baseRev }` with `Authorization: Bearer <staff password>` → `200|201 { employees, rev, updatedAt, canUndo }`, `401 unauthorized`, `403 staff_editing_not_enabled`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`. Removing someone from `employees` and saving is a real, persisted delete.
- `POST /api/staff/undo?restaurant=CR3-kitchen { baseRev }` with `Authorization: Bearer <staff password>` → `200 { employees, rev, updatedAt, canUndo }` restoring the crew replaced by the last save, `409 { error: "nothing_to_undo", rev }` when there is nothing left. The first save is undoable back to `employees: null` (the built-in crew).

Crew writes (and CR3 Kitchen per-week rule saves) accept the staff password **or** the manager token. The staff password unlocks nothing else — publishing still needs `SCHEDULE_WRITE_TOKEN`.

## Notes

- Legacy IDs are 10-char unguessable strings. Anyone with an old link ID can
  fetch its ciphertext, but reading it still needs the old manager code.
- Golden week URLs are predictable (`/api/schedule/2026-09-13`) and public —
  that is the point. Name visibility is accepted; writes are what the token
  guards.
- `PUT` uses optimistic concurrency: send the `rev` you read as `baseRev`.
  A `409` means someone else saved first — reload, then save again.
- Docs live a year (`expirationTtl`) and refresh on every save.
- Writes are throttled per IP (60/hour) to keep the free tier safe.
- To use a custom subdomain later, add it under Worker → Settings → Domains.
  Not required: the `*.workers.dev` URL works from GitHub Pages as-is.
