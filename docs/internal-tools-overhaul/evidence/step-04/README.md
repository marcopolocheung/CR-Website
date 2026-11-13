# Step 04 evidence

Start with the [checkpoint](../../checkpoints/step-04.md) and
[production manifest](session/results.json). Four production screenshots show
[retained Forms](session/forms-retained-desktop.png),
[explicit Forms resume on phone](session/forms-resumed-phone.png),
[Spanish cash at 320px/200%](session/cash-expiry-spanish-large-text.png), and
[catalog recovery against a newer revision](session/inventory-catalog-recovery.png).
The [Cash PDF](session/active-cash-print.pdf) excludes hidden Forms and shell chrome.

The production capture's source hashes and screenshot hashes were checked against
the final files. Additional [source/test hashes](checks/source-hashes.json),
[compatibility-shell results](checks/shell-results.json) and
[prefix results](checks/prefix-results.json) retain identities and observed scenarios.
The portable build log strips terminal carriage returns/trailing whitespace; its
raw original remains in `.rea/step04-checks/build.log`.

Shell screenshots/raw logs remain in ignored `.rea/step04-checks/shell/` locally;
the four Step 04 captures above are the portable review images.

## Replay with synthetic data

Use the pinned requirements in `scripts/overhaul-baseline/requirements.txt`:

```sh
python3 -m venv /tmp/cr-step04-venv
/tmp/cr-step04-venv/bin/pip install -r scripts/overhaul-baseline/requirements.txt
/tmp/cr-step04-venv/bin/python -m playwright install chromium
npm ci --no-audit --no-fund
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py --port 3036
```

In another terminal, with the documented browser libraries available:

```sh
LD_LIBRARY_PATH=/tmp/cr-step04-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step04-venv/bin/python scripts/test-internal-session.py http://127.0.0.1:3036 --artifacts .rea/step04-checks/session-production
LD_LIBRARY_PATH=/tmp/cr-step04-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step04-venv/bin/python scripts/test-internal-shell.py http://127.0.0.1:3036 --artifacts .rea/step04-checks/shell
```

The suites intercept loopback API requests with synthetic responses and reject
external origins. Do not use production endpoints or real staff/financial data.
The session test allows synthetic writes; the shell suite allows GET/OPTIONS only.
Add `--rea` to the session suite for a separately retained passive CDP observation.

For each of `internal-drafts forms-drafts internal-recovery internal-language
internal-feedback cashout-context cashout-entry entry-workspace import-review`,
the actual regression command was the following, with `<name>` replaced:

```sh
LD_LIBRARY_PATH=/tmp/cr-step04-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step04-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-<name>.py http://127.0.0.1:3035
```

Forms-drafts and internal-recovery were additionally replayed against the final
production export at `http://127.0.0.1:3036`. The Forms harness waits for
hydration before entering credentials.

That dev server used the loopback/empty optional-service configuration from the
checkpoint. Prefix replay used a separate dev server on 3037 with
`NEXT_PUBLIC_BASE_PATH=/review`; the session suite received
`http://127.0.0.1:3037 --prefix /review`.

See the [REA investigation](../../../investigations/internal-session-2026-11-12.md)
for static artifact digests, evidence IDs, selected-source coverage, passive attach
limits and raw `.rea/runs/` locations. These captures prove local fixture behavior;
they do not prove live backend activation, physical-device usability or staff acceptance.
