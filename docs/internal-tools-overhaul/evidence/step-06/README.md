# Step 06 evidence

Start with the [checkpoint](../../checkpoints/step-06.md) and
[final production manifest](screens/results.json). Six captures show
[blank focused entry](screens/focused-blank-desktop.png),
[two counted drawers](screens/focused-two-drawers-desktop.png),
[Spanish phone](screens/focused-spanish-phone.png),
[enlarged Spanish](screens/focused-spanish-enlarged.png),
[short-viewport keypad](screens/focused-spanish-keypad-short-viewport.png) and
[simulated panned VisualViewport](screens/focused-reduced-visual-viewport.png).
The [English paper sample](screens/all-drawers-print.pdf) includes inactive AM/PM
drawers as well as the active one. This is local synthetic evidence, not staff/device approval.

## Replay

Install the pinned Python requirements from
`scripts/overhaul-baseline/requirements.txt` and Chromium into a disposable environment.
The run reused `/tmp/cr-step05-venv` and the extracted browser libraries below.

```sh
npm ci --no-audit --no-fund
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py --port 3041
```

In another terminal:

```sh
LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step05-venv/bin/python scripts/test-cashout-focused.py http://127.0.0.1:3041 --artifacts .rea/step06-checks/focused-static --rea
```

For each of `cashout-entry cashout-context entry-workspace internal-feedback
internal-drafts internal-language internal-recovery`, use the guarded regression runner:

```sh
LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step05-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-<name>.py http://127.0.0.1:3041
```

Cashout-entry, entry-workspace and internal-language were replayed on final static
3041. Other regressions ran on dev 3040 with the same explicit loopback/empty
optional-service configuration. Portable passing logs are under [checks](checks).
Additional retained-session (14), Home/Reports (11) and shell (11) scenarios
pass on final static 3041; their logs/manifests are also under checks.

They strip terminal carriage returns/trailing whitespace; originals remain under
ignored `.rea/step06-checks/`. Synthetic responses only; no production endpoint or
real record is permitted. The new suite intercepts writes to inspect the original
wire payload; that is not a live persistence test.

The [REA investigation](../../../investigations/internal-cash-focused-2026-11-13.md)
separates emitted-module analysis, passive final-page observation and browser action
assertions. Source/screenshot hashes were checked against final files. Physical
touch/software keyboard, staff acceptance and full accessibility remain unverified.
