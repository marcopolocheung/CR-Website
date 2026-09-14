# Schedule store Worker (Cloudflare, free tier)

Zero-knowledge blob store for one published week. The Worker never sees names,
shifts, or the manager code — it only holds the encrypted `ciphertext` the
browser already made with `encryptWeek`, plus `rev` for same-link updates.

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

- `POST /api/weeks { ciphertext, templateHash, weekStart }` → `201 { id, rev }`
- `GET /api/weeks/:id` → `200 { v, id, rev, ciphertext, templateHash, weekStart, updatedAt }`
- `PUT /api/weeks/:id { ciphertext, baseRev }` → `200 { rev }` or `409 { error: "conflict", rev }`
- `GET /api/health` → `{"ok":true}`

## Notes

- IDs are 10-char unguessable strings. Anyone with the link ID can fetch the
  ciphertext, but reading it still needs the manager code.
- `PUT` uses optimistic concurrency: send the `rev` you read as `baseRev`.
  A `409` means someone else saved first — reload, then save again.
- Docs live a year (`expirationTtl`) and refresh on every save.
- Writes are throttled per IP (60/hour) to keep the free tier safe.
- To use a custom subdomain later, add it under Worker → Settings → Domains.
  Not required: the `*.workers.dev` URL works from GitHub Pages as-is.
