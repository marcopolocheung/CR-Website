# Step 12a checkpoint: separate CR3 inventory views

## Scope and baseline

November 23, 2026 / Codex. Branch `feat/overhaul-step-12a-inventory-views`, isolated worktree `/home/unusn/CR-step12a`, from freshly fetched `origin/main` **`88098c0`**. The original `/home/unusn/CR` checkout and its untracked work are preserved. Step 11 merged in [PR #197](https://github.com/marcopolocheung/CR-Website/pull/197), merge `00e0c63`; its device/staff/live gates remain separate. The approved Night shift bank v1.0, Layered paper, Patina teal and moving red shell highlight are retained.

The [approved plan](../evidence/step-12a/approved-plan.md) defines this frontend slice. One controller now retains Count, Order checklist, Catalog and History behind `#count`, `#orders`, `#catalog` and `#history`. Local view changes retain working date, raw values, skips, filters, captured IDs and catalog draft. Count has no embedded editor/checklist/historical tables; catalog changes link to Catalog. Checklist supplier selection is independent, quantities use existing handlers, checked lines remain in clipboard output, and Marked ordered is explicitly manual. Save count & checklist acknowledges existing `inv`, `order` and `done` fields only.

Catalog defaults to the shared read-only list; Edit catalog exposes existing validation/recovery/conflict handling. Saving the shared list does not adopt it into the working count. Explicit reviewed adoption archives previous bytes and preserves removed identities. History browsing has its own date, results, selection and request generation. It does not initialize or modify the working count/comparison. Historical labels use a validated matching-date device catalog, otherwise the available current shared catalog; failed source loading leaves raw-ID fallback rather than claiming built-in labels are current. Reports expose saved IDs and catalog provenance. Server historical catalog versions remain unavailable.

No persisted purchase order, receiving, supplier delivery, structured unit/conversion, CR2 inventory or durable count-session work is included. Original supplier/Use notation, suggestions, raw fractions/text and blank-versus-zero behavior remain. Existing routes, count/catalog/history API and strict Step 11 envelope are retained; navigation state is outside that envelope. Step 12b has not begun.

## Gates

| Gate | State | Evidence or boundary |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Four-view controller, independent history/report helpers and existing API/storage boundaries implemented. |
| Automated checks, production build and SEO | pass | Aggregate 405 tests, dictionary/contracts 9, production export and SEO pass with explicit loopback APIs. |
| Browser visual, task and output verification | pass | Views 11 scenario groups, counting 10, recovery, shell 11 and session 14 pass; PDFs and four-view responsive screenshots retained. Synthetic/local emulation only. |
| Owner review before the next staged step | pending | Non-draft [PR #202](https://github.com/marcopolocheung/CR-Website/pull/202) targets main. Stop without merging or beginning Step 12b. |
| Backend/schema/unit-policy readiness | not applicable to this slice | Existing count PUT, revisioned catalog PUT and bounded history GET retained; broader INV/DEC-05 milestones stay open. |
| Physical-device/software-keyboard/staff acceptance | pending | Browser emulation does not establish these checks. |
| Release and live-service verification | pending | No deployment, migration or production mutation performed. |

## Scenario evidence

The observed browser runs use synthetic local APIs. [Views results](../evidence/step-12a/screens/results.json), [counting results](../evidence/step-12a/counting/results.json) and [command logs](../evidence/step-12a/checks/) retain the observations. The final-source runs below pass; physical-device and live-service checks remain separate.

| Scenario / fixture | Observed result / evidence |
| --- | --- |
| Four views and compatibility entry points | Views suite passes direct hashes, absent/unknown hash fallback and extensionless/slash/`.html` routes without writes. Back/Forward and keyboard heading focus pass; the local navigation preserves Next history state so same-page traversal does not restore an earlier workspace. |
| Partial count and catalog draft | Raw partial counts, skips, filters and catalog draft survive local view/language changes. Lock/unlock/reload retain exact count/catalog work and captured section; transient search/supplier filters can reset through the existing local reader. Navigation/filter state is not added to the device envelope. Cancellation remains explicit; count progress remains independent of checklist filters. |
| Checklist | Independent supplier grouping/filter, raw `9/10 box` override and manual marks save/reload using only existing fields. Clipboard retains checked displayed lines with original format. |
| Catalog lifecycle | Existing recovery suite passes offline/auth retention, denied storage, one in-flight save and original-base 409 recovery. Counting suite passes rename/removal/adoption archives, retained removed IDs and fresh IDs for same-name replacements; Count stays unavailable after failed baseline until retry. |
| Saved-day lookup | Fourteen-calendar-date windows, boundary/gap handling, newest-first saved timestamp/selection, empty/error results and stale original context pass. Late, invalidated and expired-session results cannot replace a newer lookup; lock/401 hides records. |
| Historical identity | Matching-date validated device labels supply labels only; invalid metadata falls back. Server fields remain distinct from device `LOCAL-UNSAVED` values/skips. Unknown/removed IDs and raw values remain visible. Helpers cover failed/denied metadata, raw-ID report fallback and blank/false field equality. Browser fixtures also pass failed shared-source raw-ID/device-label fallback and correct saved labels when the Worker omits `done:false`. |
| Browse isolation | Assertions verify no history-browsing PUT, identical device count bytes and unchanged working date, count/checklist/skip values and comparison. |
| English full report | Full PDF contains all catalog/unknown rows and five date pairs, November 14–18, despite Count filters and Spanish screen language. Independent Zero row is `14 / 114`, `15 / 115`, `16 / 116`, `17 / 117`, `0 / 2`; Fraction stays `1 1/2 / 9/10 box`. |
| Checklist-only / saved reports | Checklist PDF follows supplier D and includes checked lines while excluding Beverage and count columns. Saved PDF contains server `saved03`, `2/3`, `raw3/4`, explicit IDs and catalog provenance, with preceding saved fields; it excludes working `1 1/2`, `9/10 box` and device unsaved values. Print state and language restore. |
| Responsive/accessibility | Sixteen screenshots cover four views at 1440/768/390/320px, with enlarged Spanish at 320px and reduced motion. No page overflow; narrow catalog/history tables have bounded keyboard-focusable scrolling. |

## Checks actually run

| Command / evidence | Observed result | Scope |
| --- | --- | --- |
| `npm run check` — [log](../evidence/step-12a/checks/check.txt) | 405 tests pass; type/tracker pass. | Type/tracker, scheduler 246, cashout/inventory 54, session 7, recovery 7, imports 57, forms 15, requests 5, agent 14. Nine new history/helper tests are included in inventory. |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` — [log](../evidence/step-12a/checks/i18n-contracts.txt) | 9 pass | Dictionary/placeholder parity and shared contracts. |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` — [log](../evidence/step-12a/checks/build.txt) | pass; final inventory chunk `4e069c84a111834e.js`. | Explicit loopback API; no production fallback. |
| `npm run seo:check` — [log](../evidence/step-12a/checks/seo.txt) | pass. | Production static export/compatibility output. |
| `scripts/test-inventory-views.py` — [log](../evidence/step-12a/checks/browser-views.txt) | Latest 11 scenario groups pass. | Independent values/requests, history isolation, navigation, 16 view screenshots and three PDFs; no page errors/external attempts. |
| `scripts/test-inventory-counting.py` — [log](../evidence/step-12a/checks/browser-counting.txt) | 10 scenario groups pass | Existing count/progress/catalog/recovery/wire/print scenarios adapted to local views and manual checklist wording. |
| `scripts/overhaul-baseline/run-existing.py scripts/test-internal-recovery.py` — [log](../evidence/step-12a/checks/browser-recovery.txt) | pass; zero external attempts | Existing catalog recovery/conflict and cash authorization protection. |
| `scripts/test-internal-shell.py` — [log](../evidence/step-12a/checks/browser-shell.txt) | 11 scenarios pass; zero page errors/external attempts | Existing shell/navigation and moving highlight, retained global Inventory item. |
| `scripts/overhaul-baseline/run-existing.py scripts/test-internal-session.py` — [log](../evidence/step-12a/checks/browser-session.txt) | 14 scenarios pass; zero page errors/external attempts. | Shared access/recovery retained; selectors now scope visible local views and active import summaries. |

Browser runner: `LD_LIBRARY_PATH=/tmp/cr-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step12a-venv/bin/python`, Playwright 1.65.0 / Chromium 158.0.8127.18, with `scripts/overhaul-baseline/serve.py --port 3048`. Direct browser commands use `http://127.0.0.1:3048`; the shell command adds `--artifacts docs/internal-tools-overhaul/evidence/step-12a/shell`, and the view command retains its default `screens/` destination. Recovery/session commands run through the external-guard wrapper above. All API calls are mocked at explicit loopback port 8787.

Initial view-run failures and diagnostics are retained separately as `browser-views-initial-hash-history.txt` and `browser-views-diagnostic.txt`; they are not passing evidence. The final source corrects same-page Next Back/Forward history state, bounded keyboard scrolling for narrow tables, failed-current-catalog raw-ID fallback and explicit saved report IDs. Existing session/recovery selectors were updated for the separated local views and active import summaries; the final suites pass.

The [REA investigation](../../investigations/internal-inventory-views-2026-11-23.md), [hash manifest](../evidence/step-12a/source-hashes.json), [artifact summary](../evidence/step-12a/rea/artifact-summary.json) and passive Count/History captures retain identities and limits. Raw final static run: `.rea/runs/20261124T012803.397531Z-2263222f/`, parent Evidence `ev_579279b31d25c8abf84a068ce3cb605637c019d90cedaf0ed6cc90edffef34a8`. One selected emitted inventory chunk parsed with zero failures; 79 other inventoried files and 4306 semantic unknowns remain outside complete analysis. Passive REA snapshots did not perform the Playwright actions or prove live persistence.

## Review and rollback

Review these tasks in the PR before advancing the staged overhaul:

1. Open a partial Count, apply Remaining/search/section filters, visit the other three views and return using browser Back/Forward. Verify date, filters and progress stay put.
2. Override an order with raw text, filter the checklist by supplier, mark a line ordered, copy, save/reload and print checklist-only. Verify copy includes checked lines and that the acknowledgement does not claim supplier receipt.
3. Start a catalog draft, visit Count/History and switch language; lock/unlock/reload and resume it. Cancel deliberately, then exercise a conflict and reviewed adoption. Verify prior-byte archive and retained removed IDs.
4. Browse a saved window with gaps, change the end date, fail/retry a load, and compare server fields with a deliberately different working draft. Review provenance and unknown IDs, then print saved/full reports and check language/print-state restoration.
5. Inspect four views at phone/tablet width and enlarged Spanish, including keyboard focus and horizontally scrolling catalog/comparison tables. Physical touch/software keyboard and staff acceptance remain separate.

Rollback the Step 12a frontend commit through reviewed Git history. Retain all legacy keys, strict Step 11 device envelopes, captured catalogs, archives, unreadable recovery bytes, stable item IDs and server count/catalog records. Do not clear device storage or delete shared records to roll back navigation or reports. Backend order/receiving/session and unit-policy tasks remain open. Stop here for review; do not merge or begin Step 12b.
