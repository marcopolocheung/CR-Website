# Step 04 checkpoint: shared access and draft-safe navigation

## Scope and baseline

- Step: **04 only**. Home/Reports restructuring and scheduler integration remain Steps 05 and 14.
- Date / owner: November 12, 2026 (America/Chicago) / Codex. Owner review pending.
- Base: merged main `61deb6a056863187ba199fda891d73236259103b` (PR #176), isolated branch `feat/overhaul-step-04-session` in `/home/unusn/CR-step04`. Original checkout and earlier worktrees preserved.
- Prior evidence: [Step 03](step-03.md); the user reported its merge and requested Step 04. Its device/live/encrypted-link limitations remain separate. The old checkpoint's pre-merge gate table is historical.
- Design: unchanged Night shift / Layered paper / Patina teal v1.0, shared controls and moving navigation. No bank asset/rule changed.
- Services: `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`; assistant and analytics empty. Dev preview on 3035, production static export on 3036, separate `/review` prefix dev preview on 3037. Every API response is intercepted synthetic data; external requests are rejected. No Worker, seed, migration or live service activation.
- Identity: [production manifest](../evidence/step-04/session/results.json) identifies runtime source and screenshots; [additional source/test hashes](../evidence/step-04/checks/source-hashes.json) identify the implementation diff. The base commit alone is not presented as the implementation artifact.

## Result and interfaces

The internal layout owns a memory-only manager session and lazy visited-workspace host. One verified unlock works across Dashboard, Cash/Reports, Inventory and Forms. Internal navigation retains exact React editor state and File objects; inactive workspaces are hidden from focus/accessibility/print and suspend automatic reads. Native mounted Bookkeeping hashes, route aliases, Back/Forward, modified clicks and Schedule's separate adapter are preserved.

The header's **Save drafts & lock** checkpoints every visited task before leaving any editor or clearing access. Denied storage, pending work and unsupported unsaved snapshots/mappings refuse manual lock with actionable feedback. Cash/Form drafts return to chooser/list views after a successful handoff; explicit resume restores their independent context and values. Incomplete import Files stay in memory; prepare/save the existing supported snapshot before manual lock. The slice adds no partial-import persistence format or new parser.

Context/draft replacement and Forms Back to list use localized confirmation and successful device checkpoints; Cancel keeps the original fields and focus. Inventory retains the legacy count format and adds exact-day device copies plus a validated catalog recovery envelope containing original revision/sheets. Catalog recovery requires explicit Resume and preserves a newer-server conflict. Resolving recovery archives its original bytes under unique keys; it does not rewrite historical records.

Authorization failures clear the matching session immediately, even if storage fails, retaining protected work behind the gate. API response leases reject stale session generations, including reauthentication with the same code. Consumers apply task/context guards before expiring access; an old closed-editor 401 cannot lock a newer record. Pending request counts avoid enabling saves while another request is still outstanding. An in-flight verification cannot revive access after the internal layout exits. No write is automatically retried. Reload/another tab require authentication; a preparer label never grants authority.

New interfaces are internal session/transition hooks and the `internal:session:test` command. Existing HTTP contracts, draft readers/keys and scheduler/public access remain compatible. The existing deployment build now runs the six new session/transition tests; deployment triggers are unchanged.

## Gates

| Gate | State | Evidence or limitation |
| --- | --- | --- |
| Local implementation and behavior | pass | Shared access, retained navigation, explicit context and coordinated device handoff |
| Local automated checks | pass | 255 existing domain/contract/i18n tests + 6 new session/transition tests; nine relevant regressions; production shell and session scenarios; prefix replay; type/build/SEO |
| Visual/task review | pass for local review | Agent inspected desktop Forms, catalog conflict and narrow enlarged cash captures; shared bank preserved; physical-device/staff review remains unverified |
| Owner review for next step | pending | Review PR, changed transitions and the evidence package before Step 05 |
| Required backend/policy readiness | not applicable to this local slice | No service contract/migration/retention change or activation claim |
| Release/live verification | pending | PR only; merge/main pushes can trigger the existing Pages deployment |

## Scenario evidence

| Scenario / fixture | Observed result | Evidence / boundary |
| --- | --- | --- |
| Shared unlock, mouse/keyboard, history | One verification across tools; document sentinel, original File object, CR2 cash and CR3 form values/context retained; Back/Forward correct | Production session scenarios; disposable contexts |
| Context cancellation | Cash chooser Cancel retains identity/values; Inventory date Cancel retains raw count, confirmed switch and return restore exact-date copy | Session suite plus cash-context/draft regressions |
| Partial import | Incomplete File work blocks manual lock; access/File remain intact | Supported existing snapshot is required; no invented recovery guarantee |
| All-workspace handoff | Quota failure leaves every editor/access open; recovered storage permits lock; both cash/form original copies resume explicitly | Device saves, not shared-server saves |
| Expiry during cash save | 401 with denied storage locks immediately; reauthentication restores values, explicit retry acknowledges synthetic success | No live persistence claim |
| Old session acknowledgment | Held PUT released after another tool expires access and the same code unlocks cannot mark current work saved, revoke new access or replay write | Production browser plus transport unit case |
| Import authorization | 403 from retained-import history expires shared access | Synthetic existing endpoint contract |
| Inventory catalog | Cross-tool handoff leaves counting view; explicit Resume restores name and base revision 7 against server revision 9; save remains conflict-blocked | Existing revision behavior retained |
| Language/reflow/print | EN/ES retains input; 320px/200% reflow has no horizontal overflow; printing Cash excludes retained Forms and shell | Physical keyboard/touch and full accessibility not established |
| Fresh lifetime/scheduler | Reload starts locked; internal manager unlock does not unlock scheduler | Existing public/crew adapters remain independent |
| Compatibility routes | Nine route/hash/slash/HTML destinations, keyboard/pointer links, navigation highlight, help focus, print and four scheduler/public station adapters pass | Production shell suite; production hosting redirects remain unverified |

## Checks actually run

Commands run in `/home/unusn/CR-step04`; portable logs are under [checks](../evidence/step-04/checks).

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | pass; dependency lock unchanged |
| `npm run cashout:test` | 27 pass |
| `npm run forms:test` | 15 pass |
| `npm run recovery:test` | 7 pass |
| `npm run imports:test` | 52 pass |
| `npm run scheduler:test` | 145 pass |
| `node --import jiti/register --test src/lib/internal-tools/contracts.test.ts src/lib/internal-tools/i18n/i18n.test.ts` | 9 pass |
| `npm run internal:session:test` | 6 pass: stale epochs/transport, matching expiry, exited-layout unlock rejection, checkpoint failure/throw/busy/unsupported work |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | pass; static export |
| `npm exec tsc -- --noEmit` | pass |
| `npm run seo:check` | pass |
| Browser regressions through `scripts/overhaul-baseline/run-existing.py` | All nine pass: internal-drafts, forms-drafts, internal-recovery, internal-language, internal-feedback, cashout-context, cashout-entry, entry-workspace, import-review; Forms/recovery also pass against the production export |
| `python scripts/test-internal-session.py http://127.0.0.1:3036 --artifacts .rea/step04-checks/session-production` | 14 scenarios, four screenshots, active-only PDF, zero page errors/external attempts |
| Same session suite against `http://127.0.0.1:3037 --prefix /review --artifacts .rea/step04-checks/session-prefix` | All 14 pass |
| `python scripts/test-internal-shell.py http://127.0.0.1:3036 --artifacts .rea/step04-checks/shell` | 11 scenarios; zero errors/external attempts; GET/OPTIONS mocks only |
| REA focused artifact analysis and passive dev attach | pass with explicit partial coverage; [investigation](../../investigations/internal-session-2026-11-12.md) |

For every browser command, `python` above is `/tmp/cr-step04-venv/bin/python` and the environment is `LD_LIBRARY_PATH=/tmp/cr-step04-browser-libs/root/usr/lib/x86_64-linux-gnu`. The pinned baseline requirements and Chromium were installed into disposable paths; browser shared libraries were downloaded/extracted without a system installation. Full regression commands and server/replay instructions are in the [evidence README](../evidence/step-04/README.md).

Older tests now acknowledge the deliberate context confirmation and use an actual departure to Schedule to test cancellation; retained internal navigation is tested separately. Shell lock tests explicitly resume Forms and use a cash-only fixture for successful handoff, rather than pretending incomplete imports have device copies. Original formula, draft, recovery and conflict assertions remain. Initial diagnostics and interrupted development runs are retained under ignored `.rea/step04-checks/development-failures/`; stable-source reruns pass.

## Recovery and remaining work

- Rollback: revert this review unit's layout/session/host, transport lease, transition hooks, additive checkpoint adapters, tests and documentation. Keep existing draft readers and the old inventory count key. New recovery keys/archives may remain inert; never clear device storage as rollback.
- Existing records/formulas/output declarations, draft IDs/source bytes, service conflicts and encrypted-link adapters are preserved. Device checkpoint writes use only synthetic browser contexts. No deployment, migration, production write or deletion was performed.
- Unverified: owner/staff acceptance, physical touch/software keyboard, full accessibility, live persistence/bindings/retention, production redirects/base-path hosting and historical encrypted-link browser decryption. Local basePath replay does not close the hosting gate.
- Known limit: supported import snapshot/mapping recovery must exist before manual save-and-leave lock; incomplete File inputs cannot be represented as an existing recoverable snapshot. The UI refuses the handoff and retains them instead of claiming they were saved.
- Next: Step 05 may be separately requested after review. Stop here; do not merge/deploy or begin Home/Reports restructuring automatically.
