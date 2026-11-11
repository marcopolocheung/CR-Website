# Step 02 checkpoint: shared Night shift primitives and component gallery

## Scope and baseline

- Step / substep: **02 only — Build the shared design primitives**. The gallery is a synthetic review surface; Step 03 routing/shell adoption is not started.
- Date / owner: November 11, 2026 / Codex; owner review pending.
- Source commit / branch: fetched main `b800af4863f88d2f0e86e9de6f21b6bebc3ba867`, branch `feat/overhaul-step-02-primitives`, isolated worktree `/home/unusn/CR-step02`. Original `/home/unusn/CR` and Step 01 worktree preserved; no uncommitted work was displaced.
- Prior checkpoint: [Step 01](step-01.md); owner merged PR #174 and explicitly requested Step 02. Prior live-service/device/encrypted-link verification gaps remain unchanged.
- Approved design bank: v1.0 Night shift / Layered paper / Patina teal / moving red navigation highlight. All 15 bank hashes match; no bank asset/rule changed.
- Frontend API / Worker / optional services: static export built with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`, assistant/analytics/base path empty. Served on `http://127.0.0.1:3029`; browser requests externally guarded. Gallery makes zero API requests and has no record/auth/draft adapters. No persistent Worker, assistant, seed, migration or production access.
- Changes: scoped `src/components/internal/ui/` module, unlinked/noindex `/internal/ui-gallery`, opt-in paper variants of existing Feedback/EntryWorkspace, seven scheduler icons delegated to the bank family, and language-button wrapping needed for 320px/200% text. Existing tool layouts retain their default appearance. Business formulas, record schemas, readers, access boundaries, dependency locks, public pages and shared links are unchanged.
- Identity: [results manifest](../evidence/step-02/results.json) records the base commit and SHA-256 of 13 source/test files used for the screenshots. The base SHA alone is not presented as the implementation artifact; the source hashes identify the worktree changes.

## Gates

| Gate | State | Evidence or reason |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Reusable tokens/fonts/icons/buttons/fields/paper/save states/navigation; existing behavior adapters retained; synthetic gallery |
| Local automated checks | pass | 203 relevant domain/contract tests; six existing browser regressions; 11 new gallery scenarios; type/build/SEO and gallery noindex check |
| Visual and task review | pass | Agent compared actual desktop, phone, error and navigation captures with the approved bank; 320px/200% Spanish reflow and print preview checked. Local review only. |
| Owner review for next staged step | pending | Review PR and gallery/checkpoint before separately requesting Step 03 |
| Required backend/policy/compatibility readiness | not applicable | No backend/policy contract changed. Existing mock-based compatibility checks pass; no new live activation claim. Step 01 live-service gaps still apply. |
| Authorized release and live verification | not applicable | Deployment and merging are outside this request; PR remains open for review |

## Scenario evidence

| Scenario / fixture | Expected result | Observed result | Evidence path / limitation |
| --- | --- | --- | --- |
| Bank palette/type/surfaces | Exact public red, separate light/dark Patina roles, square active/supporting hierarchy | Actual red and reference both RGBA `[159,7,18,255]`; Patina `#7bc5be` on `#171717`, `#1b6460` on white; Archivo/Grenze loaded; active paper has three approved offsets, supporting paper lighter | [Gallery manifest](../evidence/step-02/results.json), desktop/phone images; CSS optimizer serializes equivalent red as Lab |
| Hover / rapid changes | One surface retargets without selecting/navigating; selected marker stays | Forms hover leaves Cash selected and URL unchanged; rapid Home/Reports/Inventory/Schedule/Forms movement ends aligned; pointer exit restores selected Cash; independent white 3px marker retained | [Navigation capture](../evidence/step-02/navigation-hover-desktop.png); measured 220ms transition |
| Keyboard | Focus visible, surface follows focus, selection only on activation | Native Tab focus moves surface; Enter selects; blur restores selected item; 3px focus independent of surface | New gallery script; no roving tablist or route integration introduced |
| Disabled / busy | Native disabled semantics; busy label and status; no duplicate save | Disabled action inactive; preview button disabled with `aria-busy=true`; completion explicitly says no record was saved; zero remains entered | Local React state only, zero API requests |
| Field error / correction | Error linked to field, raw input retained, persistent boundary/icon | `-3` retained, field focused, hint/error IDs linked, 2px error border/warning; correcting to `0` completes preview | [Error capture](../evidence/step-02/field-error-desktop.png); fixture validation is not a financial-engine replacement |
| Entry / confirmation | Existing Enter/Shift+Enter/Tab behavior, no implicit save, Escape retains work | Enter moves name → amount → Save focus; native Tab includes readonly context; Escape cancels clear, restores trigger and retains name | Existing EntryWorkspace/useConfirmation reused; six legacy browser regressions pass |
| Language / long labels / resize | Same inputs through EN/ES, wrapped labels, aligned surface | Name and zero amount retained; Spanish long action wraps; no page overflow; surface aligned at 1440/768/375/320px | [Spanish phone](../evidence/step-02/gallery-es-375.png), [320px](../evidence/step-02/gallery-es-320.png) |
| Enlarged text | 320px at 200% text without clipped labels or horizontal page scroll | Pass after existing language group gained wrapping; nav and labels reflow, surface still aligned | [Enlarged text](../evidence/step-02/gallery-es-large-text-320.png); initial failure preserved locally as a diagnostic |
| Touch / reduced motion | Touch leaves no phantom hover; motion preference removes slides/press transforms | Touch-emulated Forms tap and outside tap keep selection/surface; frequent targets ≥44px; transition duration 0s and no hover translation under reduced motion | [Reduced motion phone](../evidence/step-02/gallery-reduced-motion-phone.png); physical device/keyboard unverified |
| Print / preview scope | Usable sample values and clear preview label, no controls/navigation/framing | PDF retains “Synthetic preview”, Ana López and 300.00; controls/navigation/shadows hidden | [Sample PDF](../evidence/step-02/gallery-print.pdf); not official-form language/pagination approval |
| Preservation | Existing drafts, formulas, links and access behavior remain intact | Cash, forms, recovery, scheduler/contracts and existing browser suites pass; bank hashes unchanged; domain/backend/record-reader files untouched | Actual command outputs below; production/staff acceptance not claimed |

## Checks actually run

Worktree: `/home/unusn/CR-step02`. Raw logs are retained in `.rea/step02-checks/`;
portable outputs/summary JSON are in [evidence/step-02/checks](../evidence/step-02/checks).
Browser commands used `LD_LIBRARY_PATH=/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu`
for this host's disposable Playwright libraries, with the pinned Step 01 Python
requirements. No system install or real browser profile was changed.

| Exact command | Result / counts | Scope and exclusions |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | exit 0 | Locked dependencies; no package/lock changes |
| `npm run cashout:test` | 27 pass | Existing cash/dashboard/inventory/draft math |
| `npm run recovery:test` | 7 pass | Recovery behavior |
| `npm run forms:test` | 15 pass | Forms and shared drafts |
| `npm run scheduler:test` | 145 pass | Scheduler/store/Worker handler compatibility |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass | Dictionary parity and lossless contracts |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | exit 0 | Static export; generated next-env change restored |
| `npm exec tsc -- --noEmit` | exit 0 | Relevant generated types available after build |
| `npm run seo:check` | exit 0 | Existing SEO guarantees; new script separately asserts gallery noindex/nofollow |
| `/tmp/cr-step01-venv/bin/python scripts/test-internal-primitives.py http://127.0.0.1:3029 --artifacts .rea/step02-checks/gallery` | 11 scenarios, 7 screenshots, 0 API/external requests, 0 page errors | Geometry/semantics/reflow/error/busy/color/print assertions; local synthetic fixture |
| `/tmp/cr-step01-venv/bin/python scripts/test-internal-primitives.py http://127.0.0.1:3029 --artifacts .rea/step02-checks/gallery --rea` | pass plus passive attach exit 0 | REA page snapshot is attach-window evidence, separate from Playwright actions |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-feedback.py http://127.0.0.1:3029` | pass | Existing errors/statuses/modal/access/stale acknowledgements |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-entry-workspace.py http://127.0.0.1:3029` | pass | Native Tab/Enter, IME-safe pattern, VisualViewport/44px/phone/print |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-language.py http://127.0.0.1:3029` | pass | Mid-entry EN/ES, mounted inputs/files, print and credential isolation |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-internal-drafts.py http://127.0.0.1:3029` | pass | Context, forked resume, legacy/corrupt/future source preservation |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-entry.py http://127.0.0.1:3029` | pass | Count/Amount/Extra money, saved reload, PDF, retry/denied storage |
| `/tmp/cr-step01-venv/bin/python scripts/overhaul-baseline/run-existing.py scripts/test-scheduler-views.py --url http://127.0.0.1:3029 --artifacts .rea/step02-checks/scheduler-browser` | pass | Existing station/editor/publication/staff views; shared icons retain size |
| `rea-project analyze /home/unusn/CR-step02/out --project /home/unusn/CR-step02 --source-path _next/static/chunks/713935395819ca43.js` | exit 0, summary exit 0 | Focused emitted gallery module only; see investigation for artifact identity and partial graph limits |

- Evidence integrity: 13 source/test hashes, seven screenshot hashes and all 15 approved-bank hashes match; 41 local evidence/module links resolve; Git whitespace check passes.
- Screenshots/rendered states: seven gallery captures at 1440×1000, 375×1000 and 320×1000; automated geometry also at 768×1000. Compared with bank desktop, phone, error anatomy and navigation examples. Captures scroll to the top to avoid full-page sticky-banner capture artifacts.
- Keyboard/focus/reduced motion: native focus/activation, entry and Escape tested; 220ms normal transition, 0s reduced motion, independent marker/focus retained.
- Real touch/software keyboard: **unverified**. Headless touch emulation and existing VisualViewport scenarios are not a physical device.
- English/Spanish and enlarged/long text: EN/ES retain values, long Spanish action wraps; 320px / 200% text passes. Local gallery copy does not change existing record text or global business translations.
- Print/output: synthetic preview PDF checked for label/values; existing cash PDF/print regressions pass. No official output-policy change.
- Save/reload/conflict: gallery uses no persistence service; existing draft/recovery/cash checks retain mocked compatibility evidence. No production save or live conflict claim.

## Recovery and remaining work

- Rollback: revert this step's UI module/gallery, opt-in adapters, shared icon delegation, one wrapping class, test/evidence and documentation pointers. Default adapters preserve legacy appearance; no data migration or draft-key changes need undoing.
- Existing drafts/history/accepted writes: original checkout untouched; browser scenarios use fresh disposable contexts; no business/domain/schema/reader/Worker change or production write.
- Known failures resolved: initial 320px/200% language-control overflow fixed by wrapping. Initial red test assumed optimizer serialization; corrected to browser color equivalence. No unexplained failing local check remains. Raw development diagnostics are retained locally.
- Remaining unverified: owner/staff acceptance; real touch/software keyboard; full accessibility conformance; live service activation/persistence and historical encrypted-link browser behavior from Step 01. Gallery verification does not close those gates.
- External dependencies: none introduced. No deployment, migration, policy or access change is needed to review these primitives. Main pushes can automatically deploy through the existing Pages workflow; PR remains unmerged.
- Reviewer decision: approve component anatomy, scoped adoption API, icon family, motion and demonstrated interaction states against the bank.
- Next step that may be requested: **03**, after review. Shared primitives and the baseline are available; route/shell integration has not begun.

Stop here for staged review. Related UX-01/03/04 briefs link this evidence without
changing their existing external/live milestones; unrelated tracker statuses remain
unchanged.
