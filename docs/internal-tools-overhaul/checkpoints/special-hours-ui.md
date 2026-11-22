# Compact Hours dialog checkpoint

## Scope and baseline

- Requested follow-up: make Hours a simple Normal hours / Closed all day / Close early choice instead of a staffing-review screen.
- Baseline: `d661ce8`, branch `codex/scheduler-special-hours`; fetched `origin/main` at `b85671c` (merged PR #199). Packaged for review on `codex/scheduler-hours-ui` from that merged main. Existing diagnostic notes and dashboard SQL helpers were preserved outside the PR.
- Design: Night shift bank v1.0, Layered paper and Patina teal. This slice changes only the Hours dialog and its bilingual copy; shared navigation is unaffected.
- New behavior: compact 520px dialog, full date, three stacked choices, conditional closing time, Save hours. More options starts collapsed and contains the optional label and only affected early-close shifts. A short consequence summary includes assigned/kept shifts being removed. Existing custom finish times are retained and identified even while options are collapsed.
- Dining/kitchen status and navigation remain on the schedule page. Existing API, mutation/retry, review, publication, Undo and kitchen access contracts remain in place.

## Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Local implementation and checks | Pass | TypeScript, build, 238 scheduler tests, 3 dictionary tests, browser workflow, SEO, tracker and whitespace checks |
| Visual/task check | Pass locally | Desktop and phone captures inspected; keyboard disclosure and narrow/enlarged Spanish checks pass |
| Owner/device review | Pending | Owner review of the compact form; physical phone/software keyboard not tested |
| Backend compatibility | Existing contract | No Worker, schema, binding or API change required by this slice |
| Release/live verification | Pending | Prepared for PR review; no production deployment, live verification or live records changed for this UI follow-up |

## Scenario evidence

`scripts/test-special-hours.py` now checks the compact form and the previous end-to-end workflow using synthetic, intercepted APIs and a loopback static export:

- Three choices; no visible preview, label or station-status panel by default. Save disabled for a new unchanged normal day; Cancel writes nothing.
- Early-close time saved without opening options, automatically shortening crossing shifts and removing later shifts while preserving normal rules.
- Options open with the keyboard and show only affected early-close shifts. Custom cleanup finish times persist through reopening and saving with options collapsed.
- Closure with assigned Keep marks shows a removal summary. Uncertain review retries use the same operation, preserve the old draft until confirmed, and apply once.
- Normal-hours cancellation, date-safe copying, Undo, independent dining/kitchen review and publication, a fully closed week, protected CR3 kitchen, deferred deep links and failed-source reload all pass.
- Planning/Current/Classic controls, staff desktop/phone labels, cleanup times and print/PDF remain correct. Spanish enlarged dialog and 320px reflow pass.

Small retained screenshots: [early close desktop](../evidence/special-hours-ui/early-desktop.png), [early close phone](../evidence/special-hours-ui/early-phone.png), [closed day](../evidence/special-hours-ui/closed-desktop.png). Additional local screenshots and staff PDF are under `/tmp/cr-hours-simple-ui/`; those temporary files are not committed evidence.

## Checks actually run

- `npx tsc --noEmit`: pass.
- `npm run scheduler:test`: 238/238 pass.
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`: 3/3 pass.
- `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:3064 NEXT_PUBLIC_API_BASE=http://127.0.0.1:3064 npm run build`: pass. Next's unrelated generated `next-env.d.ts` change was restored afterward.
- `LD_LIBRARY_PATH=/home/unusn/.local/chromium-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-scheduler-checks/bin/python scripts/test-special-hours.py --url http://127.0.0.1:3064 --artifacts /tmp/cr-hours-simple-ui`: pass using Playwright 1.65.0 / cached Chromium 1254. No production data or paid assistant used.
- `npm run seo:check`, `python3 scripts/check-overhaul-tracker.py`, `git diff --check`: pass.

This is a frontend-only follow-up; deploying the website is sufficient to release it against the existing activated special-hours backend. No additional Worker deployment or database setup is introduced. Broader scheduler overhaul steps were not started.
