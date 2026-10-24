# Local internal-tools data development (DATA-02)

This setup uses synthetic data and requires no Cloudflare account or deployed resource. Production `wrangler.toml`, routes and KV bindings are unchanged. D1/R2 bindings exist only in `wrangler.local.jsonc`; their IDs/names are local simulation identifiers, not resource IDs to copy into a deployment.

```sh
npm ci
npm run worker:types:local
npm run data:migrate:local
npm run data:test
npm run worker:dev:local
```

All scripts choose the explicit local config and local mode. No remote bindings are enabled. Use `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787` for frontend testing, with local credentials in the ignored `worker/.dev.vars` file. Do not run a local mutation against a production fallback. The existing Worker does not yet consume INTERNAL_DB/ATTACHMENTS or expose new services; the config makes them available for local service development only. No capability is advertised by this setup.

Wrangler is pinned to 4.86.0 (Node >=20.3) and its lockfile fixes Miniflare/workerd. `@cloudflare/workers-types` 4.20260426.1 supplies runtime names for generated `local-env.d.ts`; regenerate with `worker:types:local` after changing bindings. Wrangler's local simulator can support an earlier compatibility date than the existing Worker's requested date; this is local SQL/binding evidence, not runtime parity or live validation. Recheck the target runtime and artifact under REL-02/REL-03 before activation. Wrangler is MIT licensed; package notices remain in the installed packages. No vendor UI or paid component was adopted.

## Migration ownership and schema

Codex reserved/applied locally `0001_core.sql` and `0002_domain_relations.sql`. DATA-05 reserves 0003 for atomic receipts/history; next available number is 0004; reserve it in the consuming brief before editing. Applied migrations are append-only: never rewrite a migration that has reached a shared environment. Wrangler tracks their filenames in `d1_migrations`, in numeric order ([D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)).

0001 establishes stores/stations, opaque shared employees, separately reviewed legacy mappings, optional memberships, versioned approved policies, revisioned record envelopes and raw source/record lineage. New employees never match by name. 0002 links counts/catalogs/immutable context snapshots, cash closes, purchasing/partial receipt lines, scheduling/requests, imports, forms/follow-ups, stock events and private attachments. Composite foreign keys enforce store boundaries, receipt/order-line pairing and record-family identity. JSON snapshots preserve original names, labels, units and report context; they are not translations or a second authoritative checklist. Domain service tasks implement transition, snapshot immutability and policy validation before advertising writes. DATA-05 owns mutation/audit atomicity, not the legacy KV path.

Unknown policy versions and unit encodings stay null. No approved policy is seeded. Cash transitions beyond incomplete need a referenced DEC-02 version; approved scheduling requests need DEC-01; available attachments need DEC-03 and object/checksum/size; stock events need DEC-05. Unit encoding is explicitly disabled until DEC-05 examples select it. Source raw mixed units remain intact. Missing expected cents stays null; explicit actual zero stays 0. SQL rejects fractional/unsafe cents, nonpositive/unsafe stored revisions and invalid relationships. Calendar/time validation remains in contract v1 and domain services; this schema does not derive business days from UTC.

## Evidence and recovery

`data:test` creates fresh nonpersistent local workerd bindings through Wrangler's [getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy), with `remoteBindings: false`. Its test-only SQL loader uses the pinned Wrangler SQL splitter and D1 batch. It applies migrations to empty D1, verifies every family table and foreign keys, writes/reads local KV and private R2, then independently applies 0001 + prior fixture + 0002 + domain fixture. It verifies preserved Spanish names/narrative, lineage and missing/zero amounts, five count responses, and rejection of bad revisions, cross-store relationships, unresolved-policy transitions and deleted parents. Failed writes leave the original values available.

Fixtures are never part of production migration files and never seeded automatically. To populate your local Wrangler database deliberately:

```sh
npm exec wrangler -- d1 execute chinarose-internal-local --local --config worker/wrangler.local.jsonc --file worker/fixtures/0001_prior.sql
npm exec wrangler -- d1 execute chinarose-internal-local --local --config worker/wrangler.local.jsonc --file worker/fixtures/0002_domains.sql
```

Fixture seed is single-use; a duplicate fails rather than overwriting local work. `data:migrate:local` is repeatable and reports no pending migrations on its second run. Local state is ignored under `worker/.wrangler`; tests use disposable nonpersistent state and dispose handles on failure. Preserve any wanted local state before deliberately starting a fresh simulation. A failed migration is rolled back by Wrangler and earlier successful migrations remain ([command semantics](https://developers.cloudflare.com/d1/wrangler-commands/)). Do not automatically reset a developer's database. No production rollback is required by this local-only task; later activation must separately snapshot, rehearse migrations/restore, verify target IDs and reconcile accepted writes under DATA-03/08/09 and REL-03.

No screen, gesture, shared-device draft, language switch or print rendering changes here. IDs, errors and persisted states are language independent; original snapshots remain readable by future English/Spanish consumers and exports.
