# Step 01 checkpoint: current-source baseline and disposable task fixtures

## Scope and baseline

- Step: **01 only — Establish the implementation baseline**. No application redesign or Step 02 work.
- Date / owner: November 11, 2026 / Codex; owner review pending.
- Source commit / branch: fetched `origin/main` at `f657779` (full SHA in the browser manifest); branch `chore/overhaul-step-01-baseline`, based directly on that main.
- Preservation: isolated worktree `/home/unusn/CR-step01`; original `/home/unusn/CR` remains on `docs/night-shift-design-bank`. No tracked uncommitted changes were present; ignored data/builds in the original checkout were left intact.
- Prior checkpoint: Step 00 approved-bank preservation; no previous application checkpoint. Historical feature inventories were rechecked against current source.
- Approved design bank: v1.0 Night shift / Layered paper / Patina teal / moving red highlight; **15/15 manifest hashes match**, bank unchanged.
- Frontend API / Worker / optional services: explicit `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`; static export served at `http://127.0.0.1:3027`; API requests intercepted in fresh browser contexts. No persistent Worker or assistant process started. Existing Worker tests use disposable local KV/D1/R2 (`persist:false`, `remoteBindings:false`). `NEXT_PUBLIC_AGENT_API=`, analytics and base path empty. No live activation claimed.
- Changed files / user behavior: new fixture/capture/guard/static-server tooling in `scripts/overhaul-baseline/`; dated baseline, portable evidence summaries, investigation and this checkpoint; progress/index pointers. Application source, business rules, dependency locks, records, drafts and links unchanged.

## Gates

| Gate | State | Evidence or reason |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Reusable synthetic CR2/CR3 fixtures, route/state capture, external-request guard; dated source/API capability table |
| Local automated checks | pass | 283 domain tests + 12 contracts/i18n/date tests; type/build/SEO; eight existing browser suites; custom baseline scenarios. Full-bundle REA timeout is explicitly partial, with a successful focused retry, not silently treated as pass. |
| Visual and task review | pass | Agent inspected actual desktop partial-hours and phone failed-save renderings, plus representative route/state captures; existing browser suites exercise keyboard/language/print. This is local review, not staff acceptance. |
| Owner review for next staged step | pending | Review this PR/checkpoint and existing-state evidence. Step 02 requires a separate request. |
| Required backend/policy/compatibility readiness | pending | Local simulations/handler tests pass; actual deployed services, bindings, policy and historical encrypted-link browser behavior remain unverified. No backend activation is required to review this baseline. |
| Authorized release and live verification | not applicable | This step is a local baseline; deployment is expressly excluded. No merge/deploy performed. |

Local verification, owner review and release remain independent.

## Scenario evidence

| Scenario / fixture | Expected result | Observed result | Evidence path / limitation |
| --- | --- | --- | --- |
| Source/runtime identity | Main commit, override, Worker mode and assistant configuration known | Main `f657779`; compiled loopback API; simulated/mocked Worker only; assistant disabled | [Capability table](../baselines/2026-11-11/README.md); REA bundle/browser summaries |
| Local network isolation | Unexpected remote API use cannot become a production request | All requests from baseline pages pass through loopback-only guard; 0 external attempts / 0 page errors; service workers blocked; no actual API server on 8787 | `browser-results.json`; `run-existing.py`; guard is not a host firewall. App fallback unchanged. |
| Empty task | Truthful setup/empty states before entry | Existing cash draft chooser, locked internal entries, no staff publications, empty forms; failed forms read is separate | Dated `*-initial.png`, `cash-empty-desktop.png`, forms empty/failure images |
| Populated CR2 / CR3 | $300 drawer retains $100 and turns in $200; entered-zero Toast remains measured | AM card $300/$200 and +$200 comparison, blank vs zero count status distinct | Desktop CR2 / phone CR3 screenshots; incomplete PM still has −$100 turn-in, so day is $100 |
| Changed/interrupted drafts | Context-bound edits survive switching panels/reload and resume; originals stay intact | Name/count preserved; reload relocks; explicit store/date/preparer required; resume makes copy; original legacy bytes unchanged; no stored token | `cash-CR{2,3}-interrupted.png`, custom assertions; existing draft/context suites |
| Save fails | Retain entered work and report failed instead of saved | Mock 503, failed state, name/count retained; no successful write | `cash-CR{2,3}-save-failed.png`; existing offline/retry/conflict suites use synthetic adapters |
| Partial hours | Missing identity/open punch remain visible; no successful output claim | 2 source rows, 1 included / 1 excluded, 8 included hours; missing ID/out-date visible; workbook action disabled | `hours-CR{2,3}-partial.png`; `test-import-hours-preview.py` additionally verifies source overtime/workbook cells |
| Internal routes / hashes | Every current route opens; all supported hashes select correct mounted panels | 15 route 200/title checks; `#cash-out`, `#sales`, `#hours`, `#comparison` selected and visible | `browser-results.json`; local HTML resolution is not production redirect evidence |
| Station/shared public routes | Four exact station IDs and picker links remain reachable | Both manager/staff paths checked for CR2/CR3 kitchen/dining room; existing scheduler suite passes publication/visibility/editor cases and `.html` routes | Scheduler desktop/phone captures; public live data not contacted |
| Encrypted legacy contract | Preserve ciphertext/ID/rev/visibility behavior | Existing Worker lifecycle/stale-revision tests and lossless adapter round trips pass | Scheduler + contract suites. Actual historical browser link/decryption **unverified**; current frontend public viewer is station based. |
| Bank unchanged | No Step 02 tokens/components adopted yet | All 15 hashes match | Approved-baseline manifest check; no application-source diff |

## Checks actually run

Working directory for checks: `/home/unusn/CR-step01`. Raw logs remain locally in
`.rea/step01-checks/`; portable results are in the dated baseline's `checks/`.
Browser commands below all used the disposable library prefix documented in the
[baseline](../baselines/2026-11-11/README.md).

| Exact command | Result / counts | Scope and exclusions |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | exit 0 | Locked install in new worktree |
| `npm run cashout:test` | 27 pass | Cash/dashboard/inventory/draft math |
| `npm run recovery:test` | 7 pass | Shared recovery |
| `npm run imports:test` | 52 pass | Validation/review/context/mapping/history/comparison |
| `npm run forms:test` | 15 pass | Forms/digital forms/write-up and shared drafts |
| `npm run scheduler:test` | 145 pass | Domain/editor/store/share/Worker handler; synthetic encrypted lifecycle |
| `npm run scheduler:requests:test` | 5 pass | Request domain/store |
| `npm run agent:test` | 13 pass | Synthetic assistant service; no model API |
| `npm run data:test` | 10 pass | Disposable local KV/D1/R2, migrations, atomic mutations |
| `npm run imports:worker:test` | 5 pass | Disposable directory/history/publication services |
| `npm run scheduler:requests:worker:test` | 4 pass | Disposable request service |
| `node --import jiti/register --test src/lib/internal-tools/contracts.test.ts src/lib/internal-tools/i18n/i18n.test.ts scripts/business-dates.test.ts` | 12 pass | Lossless contracts, dictionaries, dates |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | exit 0 | Static export; no production use; generated `next-env.d.ts` change restored |
| `npm exec tsc -- --noEmit` | exit 0 | Generated Next types available after build |
| `npm run seo:check` | exit 0, “SEO check passed” | Export SEO/noindex/routes |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-entry.py http://127.0.0.1:3027` | pass | Count/Amount, Extra money, EN/ES, keypad, PDF, retry, denied storage |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-context.py http://127.0.0.1:3027` | pass | CR2/CR3 × two dates, late responses, legacy/storage recovery |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-drafts.py http://127.0.0.1:3027` | pass | Forked drafts, corrupt/future/legacy bytes, handoff |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-recovery.py http://127.0.0.1:3027` | pass | Offline/auth/409, navigation cancellation, one in-flight save |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-language.py http://127.0.0.1:3027` | pass | Mid-edit EN/ES, files/tabs, print recovery, credential isolation |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-import-hours-preview.py http://127.0.0.1:3027` | pass | Included/excluded rows, source overtime and generated workbook cells |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-forms-list.py http://127.0.0.1:3027` | pass | Search/filter/exact open, failed vs empty/no-match |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-scheduler-views.py --url http://127.0.0.1:3027 --artifacts .rea/step01-checks/scheduler-browser` | pass | Desktop/phone publication/settings/staff layouts; selected 320/375/768 reflow |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/capture.py` | pass: 24 scenarios, 15 screenshots, 21 mocked requests | Route/state assertions and screenshots; fresh profiles, intercepted API |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/capture.py --rea` | pass: 24 scenarios + passive REA attach exit 0 | Final corrected harness and independently retained chooser observation |
| `rea-project analyze /home/unusn/CR-step01/out --project /home/unusn/CR-step01` | exit 1: per-source 300000ms timeout | Partial raw evidence retained; full reconstruction not claimed |
| `rea-project analyze /home/unusn/CR-step01/out --project /home/unusn/CR-step01 --source-path _next/static/chunks/b82dae5994d4afe7.js` | exit 0, summary exit 0 | One emitted API module; 64 unselected files; explicit unknowns preserved |

- Evidence integrity: 37 local evidence links resolve; all 17 screenshot hashes (15 custom + 2 scheduler) match; approved bank 15/15 hashes match; `git diff --cached --check` passes after normalizing terminal whitespace in the portable build log. Raw build output remains retained locally.
- Screenshots/rendered states: dated baseline image table and screenshot manifest; 1440×1000 / 375×1000 custom captures, selected existing scheduler screenshots.
- Keyboard/focus/reduced motion: existing suites exercised keyboard/focus/tab and touch-emulated interactions; no new reduced-motion review.
- Real touch/software keyboard: **unverified**; emulation is not a physical device.
- English/Spanish and enlarged/long text: mid-entry language and selected phone/long-name cases pass; no comprehensive enlarged-text/long-label review. Existing scheduler suite checks selected widths down to 320px.
- Print/output: existing cash suite's English PDF and hours suite's workbook-cell assertions pass; language suite covers print recovery. Full cross-tool print/pagination remains unverified.
- Save/reload/conflict: synthetic/mock/local adapters only. No shared or production accepted writes; no live persistence assertion.

## Recovery and remaining work

- Rollback: revert this review unit's fixture scripts, baseline/evidence documents and index/progress pointers. Application source and bank require no rollback. Remove only disposable files created in the isolated worktree or `/tmp/cr-step01-*`; keep evidence until review. Never clear an existing browser profile or the original `.wrangler/` / `.agent-data/` / drafts.
- Existing drafts/history/accepted writes preserved: original checkout untouched; browser fixtures use fresh profiles; unchanged legacy draft bytes asserted; no production writes/migrations/deletion/deploy.
- Known failures: initial browser host-library failure repaired locally; initial REA full-bundle timeout remains partial; new harness selector/context assumptions corrected. No unexplained red domain/browser baseline remains. See actual portable results for exclusions.
- Unverified: owner/staff acceptance, current production artifact/config, bindings/migrations/policy/retention, live API read/save/reload, old encrypted-link browser opening/decryption, real touch/keyboard, comprehensive accessibility/print/enlarged-text/reduced-motion review.
- External dependencies: later service slices must verify activated D1/KV/R2, schema, authorization and policy at their release gate. Local source/schema presence is not activation.
- Reviewer decision: accept the current-source capability table, fixture safety, screenshots and verification limits as the starting point. No business-policy change is proposed.
- Next request may be Step 02 after review: the approved bank and reproducible baseline are available. **Do not begin Step 02 automatically.**

Stop here for staged review. PR targets main but remains unmerged; a main push can
automatically deploy through the existing Pages workflow. No release is authorized
by this checkpoint. Legacy task milestones are unchanged by baseline verification.
