# Step 03 checkpoint: shared internal shell and compatible navigation

## Scope and baseline

- Step: **03 only — Add the internal shell and navigation**. No Step 04 shared access session/context lifecycle or Step 05 Home/Reports separation.
- Date / owner: November 11, 2026 / Codex; owner review pending.
- Source / branch: fetched main `6281dee` (merge of PR #175), new `feat/overhaul-step-03-shell`, isolated `/home/unusn/CR-step03`. Original `/home/unusn/CR` and earlier worktrees remain intact; no uncommitted work displaced.
- Prior checkpoint: [Step 02](step-02.md), merged by owner before this explicit Step 03 request. Prior live/device/encrypted-link gaps remain open.
- Design bank: Night shift / Layered paper / Patina teal v1.0, shared icons and 220ms moving highlight; bank unchanged.
- Frontend/API/Worker: static export at `http://127.0.0.1:3031`, built with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`, empty assistant/analytics/base path. All task API responses synthetic/intercepted; no persistent Worker, assistant or real profile opened. Separate local Next dev preview at port 3033 verified `/review` base-path behavior.
- Changed behavior: quiet identity header, stable language/help/local-lock positions, read-only task context, six real destinations with current-page semantics, responsive rail/grid, print exclusion and scheduler return adapter. Existing work surfaces keep their typography and task layout. Cash/Reports reuse mounted Bookkeeping panels and exact current path aliases. Metadata registration stores labels and existing callbacks, never credentials or a mutable global store.
- Preservation: formulas, schemas, API adapters, draft keys, records, backend permissions, public staff viewer and dependency locks unchanged. Cash handoff moved to one header action, preserving its original persistence guard. Other locks delegate current tool callbacks. They do not share manager authority across tools.

## Gates

| Gate | State | Evidence or reason |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Shell adapters, six destinations, read-only context, native links, retained panels and scheduler adapter |
| Local automated checks | pass | 255 domain/contract tests; ten existing browser suites; eleven shell scenarios; type/build/SEO; base-path preview |
| Visual and task review | pass | Agent inspected actual desktop Dashboard and Cash, Spanish phone Cash, Forms/inventory and enlarged shell captures; owner/staff acceptance separate |
| Owner review for next staged step | pending | Review this PR/checkpoint before requesting Step 04 |
| Required backend/policy/compatibility readiness | pass | No new backend/policy dependency; route/hash/API compatibility verified locally. Live services and old encrypted-link browser opening remain unverified. |
| Authorized release and live verification | not applicable | No deploy/merge authorized by this step; PR remains open |

## Scenario evidence

| Scenario / fixture | Expected result | Observed result | Evidence / limit |
| --- | --- | --- | --- |
| All destinations | Mouse and keyboard reach usable screens, with a way home | Dashboard/Cash/Reports/Inventory/Forms traversed both ways; Schedule reaches original gate and return link; QR/gallery direct routes include home | New [shell result manifest](../evidence/step-03/results.json); nine direct route/hash/HTML/slash cases |
| Active navigation | Real links, current page independent of red hover surface | Six labelled anchors; `aria-current=page`; hover moves one surface without selecting; QR/gallery have no false primary selection | Existing primitive interaction suite plus shell geometry checks |
| Bookkeeping compatibility | Preserve `/bookkeeping`, slash and `.html`, all four hashes | Shell hash links retain exact pathname; #cash-out/#sales/#hours/#comparison select correct mounted panel; fields, exact File object and window sentinel retained | Three path-variant scenarios; no route remount for Cash/Reports |
| History/skip/cancel | No selected-tab drift or lost entered work | Back/Forward synchronize panel/current item; skip focuses workspace without changing task hash; canceled cross-route navigation retains cash/sales/hours/file inputs | Synthetic CR2 cash and CR3/CR2 report contexts |
| Context truth | Actual task scope, no fabricated global store | Cash CR2/date, sales CR3/date, hours CR2/period, form CR2/date and CR3-only inventory shown from existing state; empty tasks prompt for their own context | No global selector or context writer introduced; legacy saved write-up without store displays date only |
| Cash local lock | Original save-and-lock guard retained | Quota failure leaves active editor/access and count intact; successful handoff preserves draft; explicit resume restores count; original legacy bytes unchanged | Existing `leave(true)` callback; no shared session or server write |
| Forms/inventory local lock | Mounted entered values survive current tool lock | Form narrative retained through lock/unlock; raw inventory `3B/2T` retained; local access stays scoped | Existing per-tool state and API authorization remain authoritative |
| Language/responsive/motion | Labels and input survive, surface realigns | EN/ES retains values; 768/375/320px Cash reflow; 320px/200% Spanish shell reflow; reduced motion 0s | Headless touch emulation only; desktop header sticky, phone/tablet header scrolls away, existing entry summary remains sticky |
| Print | Shell absent, existing paper values usable | Header/rail/skip controls hidden; Cash PDF retains synthetic cashier and $300 drawer; existing cash/entry/print regressions retained | [Cash sample PDF](../evidence/step-03/cash-print.pdf); no official output-policy change |
| Scheduler/public links | Keep separate adapter and staff reader | Four manager station URLs still gated, four public staff station URLs reachable; internal return link added outside gate; no shell/session imposed on staff reader | `/scheduler-demo` integration remains for Step 14; encrypted legacy handler untouched |
| Base path | Native links and fonts/routes honor configured prefix | `/review` preview: six prefixed destinations; same-document Cash/Reports sentinel retained; Inventory route resolves; no external attempts/page errors | Local dev compilation, not deployed GitHub Pages redirects |

## Checks actually run

Worktree `/home/unusn/CR-step03`. Browser commands used the Step 01 pinned Python
requirements and `LD_LIBRARY_PATH=/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu`
for already-extracted host libraries. Fresh profiles and external-request guards
were used. Portable outputs are in [evidence/step-03/checks](../evidence/step-03/checks);
raw diagnostics remain in ignored `.rea/step03-checks/`.

| Exact command | Result / counts | Scope / exclusions |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | exit 0 | Locked dependencies |
| `npm run cashout:test` | 27 pass | Existing cash/dashboard/inventory/draft math |
| `npm run imports:test` | 52 pass | Existing parser/review/context/mapping/history/comparison |
| `npm run forms:test` | 15 pass | Forms and shared drafts |
| `npm run recovery:test` | 7 pass | Recovery |
| `npm run scheduler:test` | 145 pass | Domain/store/Worker compatibility, existing encrypted-record lifecycle |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass | Dictionary parity and lossless contracts; total 255 |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | exit 0 | Static export; generated next-env change restored |
| `npm exec tsc -- --noEmit` | exit 0 | Types after build |
| `npm run seo:check` | exit 0 | Existing SEO/noindex guarantees |
| `/tmp/cr-step01-venv/bin/python scripts/test-internal-shell.py http://127.0.0.1:3031 --artifacts .rea/step03-checks/shell --rea` | 11 scenarios / 7 screenshots; GET/OPTIONS mocks only; 0 page errors/external attempts | New navigation/context/lock/print scenarios; passive REA attach separately retained |
| `rea-project analyze /home/unusn/CR-step03/out --project /home/unusn/CR-step03 --source-path _next/static/chunks/1d12c6e9350a620b.js` | exit 0; one parsed emitted shell module | [Investigation](../../investigations/internal-shell-2026-11-11.md) records identities and partial graph coverage; 67 files unselected |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-language.py http://127.0.0.1:3031` | pass | Mid-entry EN/ES, mounted input/files, print and credential isolation |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-feedback.py http://127.0.0.1:3031` | pass | Errors, modal/focus and save outcomes |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-entry-workspace.py http://127.0.0.1:3031` | pass | Native entry/visual viewport/reflow/print; assertions account for actual sticky obstruction |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-entry.py http://127.0.0.1:3031` | pass | Count/Amount/Extra money, PDF, retry/storage, keypad; actual sticky obstruction |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-drafts.py http://127.0.0.1:3031` | pass | Context/fork/handoff/legacy/corrupt data |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-recovery.py http://127.0.0.1:3031` | pass | Departure cancellation, auth/offline/conflict/stale writes |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-forms-drafts.py http://127.0.0.1:3031` | pass | Scoped drafts, reauthentication, immutable save and retained Saved feedback |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-import-review.py http://127.0.0.1:3031` | pass | Mounted files/review, outputs, stale cash-fill, EN/ES/phone/print |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-primitives.py http://127.0.0.1:3031 --artifacts .rea/step03-checks/primitives` | pass | Eleven shared-primitive scenarios now scoped to gallery specimen within the shell |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-scheduler-views.py --url http://127.0.0.1:3031 --artifacts .rea/step03-checks/scheduler-browser` | pass | Existing manager/staff/publication behavior and adapter |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH=/review npm run dev -- --webpack --hostname 127.0.0.1 --port 3033` | ready; browser prefix scenario pass | Six links, preserved hash navigation and Inventory prefix; [result](../evidence/step-03/checks/basepath-results.json) |

- Primary navigation has a distinct bilingual landmark name from the existing Dashboard task launcher.
- Final integrity: all 15 approved-bank manifest hashes pass, all 28 tracked bank files match fetched main, 40 source/test and seven screenshot hashes match the manifest, 42 local documentation links resolve, and `git diff --check` passes. [Recorded result](../evidence/step-03/checks/integrity.json). Original main workspace remains clean and preserved.
- Screenshots: seven shell captures at 1440×1000, 375×1000 and 320×1000; metadata and source/screenshot hashes in result manifest.
- Keyboard/focus/reduced motion: mouse/Tab/Enter, skip, Escape/help/cancel, native links/current marker; reduced motion 0s. Navigation padding preserves the focus halo while containing animated decoration on resize.
- Real touch/software keyboard: **unverified**; touch and keyboard-sized VisualViewport are emulated.
- English/Spanish/enlargement: new shell labels have matching dictionary keys; values retained; 320px/200% shell and locked entry reflow checked. Full enlarged-text review of every legacy editor remains separate.
- Print/output: shell removed, existing cash values preserved; no printed form wording/retention/signature policy changed.
- Save/reload/conflict: existing synthetic regressions pass; new shell test performs no API mutations. No live save/persistence claim.

## Recovery and remaining work

- Rollback: revert this review unit's layout/shell/metadata adapters, link extension, label keys, scheduler return adapter, tests and documentation. Original routes, task components, serialized drafts and API contracts remain readable. Never clear user storage to roll back.
- Preservation: original workspace and ignored local databases/drafts untouched; no migration, seed, record deletion, production write, merge or deploy.
- Resolved during development: duplicate cash handoff moved to one header action; metadata propagation stabilized so forms Saved feedback is not cleared by a refresh; viewport tests now measure actual sticky obstruction; skip/Back/Forward retain active-panel semantics; long legacy heading wraps at enlarged text; moving decoration contained during resize. Test harness waits for hydration and wraps its quota injection correctly. Raw diagnostics retained.
- Unverified: owner/staff acceptance, physical touch/software keyboard, full accessibility conformance, actual deployed services/bindings/retention, production redirects/base path, and opening/decrypting a historical encrypted browser link. Prior checkpoint limits remain.
- External activation/policy dependencies: none introduced. Existing main-push Pages workflow may deploy on merge; this PR stays unmerged for review.
- Reviewer decision: approve shell placement/labels/context display, preserved entry/hash behavior and the separate scheduler adapter.
- Next requested step may be **04** after review. Shared manager session, cross-tool context lifecycle and new draft-safe navigation policy have not been implemented here. The broader legacy UX-02 context checklist is not retroactively closed by this shell slice.

Stop here for staged review.
