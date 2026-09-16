# Schedule store Worker (Cloudflare, free tier)

Two stores in one Worker:

- Legacy per-link blobs (`/api/weeks`): kept read/write compatible so old
  staff links keep working. New development should use the golden schedule.
- Golden schedule (`/api/schedule`): one persistent codeless schedule keyed
  by week start (`golden:YYYY-MM-DD`), edited by `/scheduler-demo` and read
  by `/schedule`. Docs hold the plaintext week plus `visible` for the
  manager's week on/off toggle and `rev` for optimistic concurrency.

Plus two more stores, keyed separately:

- Employee roster (`/api/employees`): one persistent staff list (`roster:current`),
  edited by `/scheduler-demo`. Public read, token-guarded write, same optimistic
  concurrency (`rev`/`baseRev`) as the golden schedule.
- Staffing template (`/api/template`): one persistent set of weekly shift rules
  (`template:current`) — which roles are needed on each day/shift, and their hours.
  Edited by `/scheduler-demo`, read by both `/scheduler-demo` and `/schedule` so
  they always agree on shift layout. Same public-read, token-guarded-write,
  optimistic-concurrency pattern. Falls back to the app's built-in default layout
  when nothing has been saved yet (`rev: 0`).

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

## Deploy option A: dashboard paste (what you already did)

1. Open Workers & Pages → `chinarose-schedule-api` → Edit code.
2. Replace everything with the contents of `worker/dashboard.js` in this repo.
   It is plain JavaScript — the dashboard editor cannot run the TypeScript
   source in `worker/src/index.ts`, so always paste the `dashboard.js` build.
3. Deploy. Bindings must show `SCHEDULES` → your KV namespace.
4. Verify: open `https://<your-worker>.workers.dev/api/health` → `{"ok":true}`.

## Regenerating dashboard.js after editing the TypeScript source

```sh
npx tsc worker/src/index.ts --outDir /tmp/opencode/worker-out --target es2022 --module esnext --moduleResolution bundler --skipLibCheck
cp /tmp/opencode/worker-out/index.js worker/dashboard.js
```

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

- `GET /api/schedule?month=YYYY-MM` → `200 { weeks, rev, notModified }` (visible only, sorted). Pass `knownRev=<rev>` and the Worker answers `notModified: true` with no weeks when nothing changed — every golden save bumps the month rev (including the neighboring month when a week spans two), so readers revalidate with one tiny read instead of refetching.
- `GET /api/schedule/:weekStart` → `200 GoldenWeekDoc` or `404`
- `PUT /api/schedule/:weekStart { week, templateHash, visible, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`.

Employee roster (public read, token-guarded write, same token as the golden schedule):

- `GET /api/employees` → `200 { employees, rev, updatedAt }` (empty roster if nothing saved yet)
- `PUT /api/employees { employees, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev, updatedAt }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`. Removing an employee from `employees` and saving is a real, persisted delete.

Staffing template (public read, token-guarded write, same token as the golden schedule):

- `GET /api/template` → `200 { template, rev, updatedAt }` (`template: null`, `rev: 0` if nothing saved yet — callers should fall back to their own default layout)
- `PUT /api/template { template, baseRev }` with `Authorization: Bearer <token>` → `200|201 { rev, updatedAt }`, `401 unauthorized`, `409 { error: "conflict", rev }`. First save uses `baseRev: 0`.

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
