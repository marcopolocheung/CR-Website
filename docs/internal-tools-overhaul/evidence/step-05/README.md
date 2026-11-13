# Step 05 evidence

See the [checkpoint](../../checkpoints/step-05.md), [production manifest](screens/results.json),
[Home](screens/home-blank-desktop.png), [populated Reports](screens/reports-populated-desktop.png),
[empty Reports](screens/reports-empty-desktop.png) and [failed Reports](screens/reports-failure-desktop.png).
The manifest also lists Spanish phone/enlarged captures, nine screenshots total,
and two print samples. [Home print](screens/home-print.pdf) and
[Reports print](screens/reports-print.pdf) exclude controls/hidden workspaces.

Replay uses the pinned baseline Python requirements and a loopback build:

```sh
npm ci --no-audit --no-fund
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py --port 3039
```

In another terminal (install baseline Python requirements and Chromium in a disposable environment first):

```sh
LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step05-venv/bin/python scripts/test-internal-home-reports.py http://127.0.0.1:3039 --artifacts .rea/step05-checks/home-reports-static --rea
LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step05-venv/bin/python scripts/test-internal-session.py http://127.0.0.1:3039 --artifacts .rea/step05-checks/session
LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step05-venv/bin/python scripts/test-internal-shell.py http://127.0.0.1:3039 --artifacts .rea/step05-checks/shell
```

The language regression ran through `scripts/overhaul-baseline/run-existing.py`
against `http://127.0.0.1:3038`, a dev server with the same empty optional-service
and loopback API configuration. All acceptance requests are synthetic/intercepted;
no production endpoint or real record is allowed. Chromium shared libraries were
downloaded/extracted under `/tmp`, with no system install. Portable command logs
strip terminal carriage returns/trailing whitespace; originals remain in `.rea/`.

[Session](checks/session-results.json) and [shell](checks/shell-results.json)
manifests retain compatibility evidence. [REA investigation](../../../investigations/internal-home-reports-2026-11-13.md)
records static artifact identity, passive target identity and coverage limits.
Physical devices, staff review, activated backend services and production hosting
redirects remain unverified. No merge or deployment was performed.
