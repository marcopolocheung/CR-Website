# Step 05 checkpoint: Home and separate Reports

## Scope and baseline

- **Step 05 only**, November 13, 2026 / Codex; owner review pending.
- Baseline: merged main `256b3e3619915ac886aebd758100febe8fad4524` (PR #177), branch `feat/overhaul-step-05-home-reports`, isolated `/home/unusn/CR-step05`. Earlier worktrees and the original checkout are preserved.
- Prior [Step 04 checkpoint](step-04.md) remains the session/draft contract. The user reported its merge and requested continuation. Its physical-device/live-service/accessibility limits remain open.
- Approved bank: unchanged Night shift / Layered paper / Patina teal v1.0. Shared outline icons, fonts, tokens and moving navigation retained.
- Loopback API `http://127.0.0.1:8787`, optional assistant/analytics/basePath empty. Dev preview 3038 and production export 3039 use synthetic intercepted responses only; no Worker activation, migration or production records.

## Changes and interfaces

Home now offers Cash count, Inventory, Schedule, Reports and Forms as direct labelled task links. It makes no API request and shows no credential gate, empty charts, fabricated overdue work or invented resume/recent rows. Actual cross-tool work signals remain Step 17.

`/internal/reports` is a new retained workspace with the existing cash-report adapter and three links to the unchanged sales/hours/comparison hashes. The old populated report arithmetic, filters, charts, table and endpoints are preserved in `CashReports`; zero selected coverage gets an explicit empty state, and failed history reads get an alert/retry with filter choices retained. No financial formula, parser or backend contract changed.

Primary Reports navigation opens the hub. Old Bookkeeping hashes and slash/HTML links still open their tools with correct active navigation. The retained host preserves cash/form inputs and original File objects through Home, Reports and import destinations. Re-selecting the identical current task URL is a no-op instead of a native reload that would clear the in-memory session. Changed same-page hashes, modified clicks, external departures and Schedule's separate gate keep their existing behavior.

## Gates

| Gate | State | Evidence / boundary |
| --- | --- | --- |
| Local implementation | pass | Five-task Home, retained Reports, original reporting adapter and compatible deep links |
| Local checks | pass | Cash/dashboard, session and dictionary/contract suites; type/build/SEO; browser scenarios below |
| Local visual/task review | pass | Actual Home, populated/empty/failed Reports and EN/ES narrow/enlarged captures reviewed against bank |
| Owner review before Step 06 | pending | Review launcher clarity, report discovery and retained input scenarios |
| New backend/policy activation | not applicable | No service/schema/retention change or activation claim |
| Release/live verification | pending | PR only; existing main-push Pages deployment remains unchanged |

## Verification

Portable results, screenshots and command logs are in the [evidence package](../evidence/step-05/README.md).

| Command | Actual result / scope |
| --- | --- |
| `npm ci --no-audit --no-fund` | pass; lock/dependencies unchanged |
| `npm run cashout:test` | 27 pass, including existing dashboard totals |
| `npm run internal:session:test` | 6 pass |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass |
| `npm exec tsc -- --noEmit` | pass |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | pass, static export |
| `npm run seo:check` | pass; new Reports inherits internal noindex behavior |
| `scripts/test-internal-home-reports.py` on production export | 11 scenarios, nine screenshots and two PDFs; Home zero requests; five pointer/keyboard destinations; independently expected $1,000 total, $500 saved-day average and +$2 difference; locked/populated/empty/failure/retry states; cash/form/File preservation; active navigation reselect; EN/ES, 320px/200% containment, print and direct aliases |
| `scripts/test-internal-session.py` | 14 scenarios pass against static export; shared access, quota denial, handoff, expiry, retained data, catalog conflict and scheduler boundary |
| `scripts/test-internal-language.py` through external-request guard | pass, including new Spanish Home/Reports entry and empty state |
| `scripts/test-internal-shell.py` | 11 scenarios pass; compatibility route/hash/keyboard/history/focus/print scenarios replayed with Reports hub before legacy import entry |

The Python executable is `/tmp/cr-step05-venv/bin/python`, with the pinned baseline requirements and `LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu`. Disposable Chromium dependencies were extracted locally, without a system install. Exact replay commands, result manifests and REA coverage are linked from the evidence README.

Existing session/shell/language scripts were updated to follow the new Reports destination while retaining their prior draft, auth, File, navigation and numeric assertions. Tests wait for hydration and completed transitions before interacting with lazy workspaces; the Inventory date-switch regression waits for its existing pending-operation guard before changing date again. Dev does not resolve every exported `.html` alias; alias acceptance uses the production static server.

No production API or staff/financial record was used. Synthetic failed history is visibly distinct from empty history, and Home never infers “all done” from either. Populated report calculations were compared to independent fixture expectations; their shared domain implementation is unchanged.

## Recovery and remaining work

- Rollback: revert this slice's Home/Reports/host/link adapters, copy and tests; retain the previous cash-report component and all original routes/readers. No data migration or storage clearing is required.
- Drafts, saved records, calculations, public/encrypted links, manager session boundaries and scheduler permissions remain compatible. No new partial-import recovery promise is added.
- Unverified: physical touch/software keyboard, full accessibility, staff acceptance, activated services/live persistence, production redirects/basePath hosting and historical encrypted-link browser decryption. Runtime/REA evidence is local and explicitly coverage-limited.
- Reports still uses the legacy report's coverage/retention semantics; broader denominators, discrepancy interpretation and cross-tool signals remain their planned later steps.
- Stop for owner review. Step 06 (focused cash entry) may be requested next; it has not begun. No merge/deployment is authorized by this handoff.
