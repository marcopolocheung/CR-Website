# Special hours checkpoint A: preserve published shift times

## Scope and baseline

- Date / owner: November 20, 2026 / Codex.
- Source: `main`, baseline `0ac29ca0e9acefd74d3dd5f5201550a146aa0573`; initially clean working tree. Changes are uncommitted for review.
- Requested slice: the publication foundation from the approved restaurant-closure / early-closing plan. This does not complete Step 15 or SCH-04's full comparison/history workflow.
- Design: approved Night shift bank v1.0; no board redesign or new Hours control in this slice. Existing layouts and staff links are retained.
- Target: static frontend built with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`; browser checks served `out/` on loopback port 3064 and intercepted all APIs. Worker integration used disposable local KV through `worker/wrangler.local.jsonc`, with no remote bindings.
- Evidence: [check logs and rendered states](../evidence/special-hours-publication/).

## Result

New publications include a versioned, ordered snapshot of the actual shift slots and times. The staff viewer and comparison reader use it rather than mutable staffing rules. Saving a time-only rule change now keeps the manager's unpublished-change indicator active; staff retain the previously published times until Publish succeeds.

Before overwriting weekly or global rules, the Worker captures compatible legacy layouts under a separate key derived from the original publication bytes. It never rewrites the legacy publication, revision or timestamp. Existing report employee keys remain stable. Captured legacy times remain explicitly estimated, since current rules cannot prove the original historical times.

Snapshot validation rejects unknown versions, invalid ranges, duplicate IDs, count/hash mismatches and malformed stored snapshots without substituting current rules. Older clients cannot drop an inline or preserved snapshot. The new client checks `/api/health` for snapshot support before dependent writes. Preservation failure blocks the rules overwrite. The generated dashboard Worker mirror has been rebuilt.

Actual kitchen authorization was rechecked: the server already accepts either the manager token or staff password for weekly kitchen rules. That behavior remains unchanged; the UI's staff unlock remains unchanged.

## Gates

| Gate | State | Evidence / limitation |
| --- | --- | --- |
| Local implementation | Pass | Snapshots, legacy preservation, dirty checks and compatible readers implemented |
| Automated correctness | Pass | Domain suites, disposable KV, browser scenarios, types/build/SEO and Worker packaging |
| Visual/task inspection | Partial | Screens inspected; no redesign. Representative manager usability and physical-device review remain pending |
| Owner review before next slice | Pending | This checkpoint is the staged handoff |
| Backend compatibility and activation | Pending | Source and local Worker verified; no deployed capability or production binding verified |
| Authorized release / live verification | Pending | No deployment, migration, production write, merge or commit performed |

## Scenario evidence

| Scenario | Observed result |
| --- | --- |
| Time-only edit | Manager changes Sunday's finish from 4 PM to 3 PM, saves rules, and still sees “Changes not published yet” |
| Staff view before Publish | Continues to show 4 PM, without fetching `/api/template` for snapshot publications |
| Failed Publish, then retry | Failure preserves the published record and 4 PM finish; successful retry publishes 3 PM |
| Desktop, phone and paper | Staff desktop/390px phone display 3 PM after publication; print-media assertion checks the new time and PDF is retained |
| Legacy weekly/global rules | Prior times captured before changes; paginated global/default-legacy keys covered |
| Legacy report identity | Publication revision/timestamp and employee keys preserved; actual report endpoint still projects the captured earlier finish |
| Storage failure or intervening publish | Rules save stops; an intervening publication is not overwritten by capture |
| Malformed snapshot or downgrade | Explicit rejection/read failure; no fallback to today's rules or silent missing week |
| Existing manager workflows | Current/Classic, Planning, kitchen permissions, request recovery, bilingual request entry, keyboard navigation, layout switching, Keep/Undo and print regressions pass |

## Checks actually run

| Command | Result |
| --- | --- |
| `npm run scheduler:test` | 229 tests passed after the preservation-key change |
| `npm run imports:test` | 57 tests passed |
| `npm run imports:worker:test` | 6 local Worker tests passed; the affected publication reader was rerun afterward as below |
| `node --test worker/src/published-hours.test.mjs` | 2 tests passed against disposable real local KV after the final preservation implementation |
| `node --import jiti/register --test --test-reporter=spec --test-name-pattern='legacy times are pinned' worker/src/index.test.ts` | 1 passed, including the added report-endpoint identity assertions |
| `npm run scheduler:requests:test` | 5 tests passed |
| `npm run agent:test` | 13 tests passed on Node 22.22.0 |
| `npm exec tsc -- --noEmit` | Passed |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run build` | Passed; static export and route mirrors built |
| `npm run seo:check` | Passed |
| `npm run worker:build` | Passed; Wrangler dry-run only; generated `worker/dashboard.js` inspected |
| `scripts/test-schedule-snapshots.py --url http://127.0.0.1:3064` | Passed; save/publish failure/retry, staff reload, no mutable-rule fetch, desktop/phone/print assertions |
| `scripts/test-scheduler-views.py --url http://127.0.0.1:3064` | Passed; Current/Classic, shared week state, keyboard, editing, publishing, kitchen, narrow views and print |
| `scripts/test-scheduler-planning.py --url http://127.0.0.1:3064` | Passed; reports `production_api_access: false` |
| `scripts/test-schedule-requests.py --url http://127.0.0.1:3064` | Passed; provenance, retries/conflicts, bilingual phone and absent capability |
| `python3 scripts/check-overhaul-tracker.py` | Passed; canonical wider task statuses retained |
| `git diff --check` | Passed |

Browser commands used Python Playwright **1.65.0** in `/tmp/cr-scheduler-checks` with Chromium 1254 and `LD_LIBRARY_PATH=/home/unusn/.local/chromium-libs/root/usr/lib/x86_64-linux-gnu`. The first launch exposed missing system libraries; using the existing user-local libraries resolved it without system package changes. Early test-selector mistakes were corrected; the retained browser logs are the final passing runs. Playwright is a local verification dependency, not a new application dependency.

The focused fixture uses synthetic CR3 Dining Room / Sample Employee and the current week, November 15–21. Unit/integration fixtures include dated November and September weeks and kitchen stations. No holiday date or 7 PM business policy has been inferred or saved.

Snapshots in [unpublished-time-change.png](../evidence/special-hours-publication/screens/unpublished-time-change.png), [staff-before-publish.png](../evidence/special-hours-publication/screens/staff-before-publish.png), [staff-after-publish-desktop.png](../evidence/special-hours-publication/screens/staff-after-publish-desktop.png), [staff-after-publish-phone.png](../evidence/special-hours-publication/screens/staff-after-publish-phone.png) and [staff-snapshot.pdf](../evidence/special-hours-publication/screens/staff-snapshot.pdf) are synthetic local output. Manager desktop and staff phone captures were visually inspected. Physical touch/software keyboard and staff usability testing were not performed.

## Recovery and next slice

- No accepted production writes, drafts, source records or staff links were changed. No new D1 schema or binding is required for this foundation.
- Retain both inline snapshots and `publication-layout` records on rollback. Reverting to a Worker/reader that ignores snapshots would restore the original timing problem. Deploy compatible readers and backend together before allowing new writes; old browser tabs must reload.
- Existing KV revision checks are not atomic CAS and global listings have the existing KV consistency limits. Separate capture records avoid overwriting a concurrent publish, and a detected intervening publish blocks rule saving; this does not establish cross-document transactions.
- Historical missing/unresolvable layouts remain unknown; rule saving fails safely rather than inventing prior times. A capture is not retroactive proof of original published hours.
- Next requested slice: store-wide, exact-date normal/closed/early-close events; per-station staffing review and cleanup end times; visible Hours buttons in all manager layouts. Keep normal templates intact and dated events out of copying/navigation seeding. Then complete closure labels, per-station publication status and the end-to-end review scenarios.
- Shared special-hours persistence will depend on the next slice's D1 service and verified activation. It is not available merely because the foundation passes locally.

Stop here for owner review before implementing the next slice.

Subsequent authorization: the user requested completion of items 1–6 together. See
the [dated hours completion checkpoint](special-hours.md); this historical
foundation handoff no longer describes the current stopping point.
