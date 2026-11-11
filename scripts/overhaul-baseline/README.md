# Step 01 local baseline fixtures

These are test tooling, not application screens or shared records. Use only a new
browser context and a frontend compiled with the explicit loopback API override.
The fixture token is a public synthetic string, never a real manager credential.

```sh
npm ci --no-audit --no-fund
python3 -m venv /tmp/cr-step01-venv
/tmp/cr-step01-venv/bin/pip install -r scripts/overhaul-baseline/requirements.txt
/tmp/cr-step01-venv/bin/python -m playwright install chromium
# Supply Chromium's OS libraries if this host lacks them.
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py
```

In a separate terminal:

```sh
/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/capture.py
/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-context.py http://127.0.0.1:3027
```

`serve.py` serves `out/` on literal loopback and resolves extensionless HTML routes
and slash forms for local review. This is **local route resolution**, not evidence
of production hosting redirects. It does not proxy any request. No Worker needs
to listen on 8787: `capture.py` intercepts every API request, refuses successful
writes, blocks external origins, blocks service workers, fails on unexpected
endpoints and reports page errors. An absent/incorrect frontend override therefore
fails closed. It does not change the application's production fallback.

`fixtures.json` provides both stores, literal blank/zero, a $300/$200 drawer oracle,
a changed draft, untouched legacy bytes, a 503 save failure and partial hours data
(open punch and missing identity). Fixtures are deliberately incomplete task inputs;
they do not imply validated workbook output. Existing `scripts/create-import-fixtures.ts`
and browser scripts remain the source of complete sales/mapping/history examples.

`run-existing.py` adds a loopback-only default guard to the existing scripts; their
specific API routes still supply synthetic replies. Each script owns its fresh
profiles and task assertions. The guard is browser request isolation, not a host
firewall. It covers page requests, not browser-internal update traffic. Read each
script's header before selecting extra dependencies, credentials or services.

Capture output defaults to the dated baseline directory. Use `--output /tmp/new-baseline`
for new runs so reviewed evidence is not overwritten. `browser-results.json` records
the source SHA, fixture identity, viewport, screenshots with hashes and mocked API
requests. No real draft storage or profile is opened. Revert/delete only these new
test files and disposable outputs; never clear the owner's browser storage or
existing `.wrangler/`, `.agent-data/` or `.rea/` directories.
