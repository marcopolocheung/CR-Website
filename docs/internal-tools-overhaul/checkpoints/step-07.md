# Step 07 checkpoint: saved cash lookup and save recovery

## Scope and baseline

- **Step 07 only**, November 14, 2026 / Codex. Implements the [approved plan](../evidence/step-07/approved-plan.md); Step 07b has not begun.
- Baseline: merged main `68810bf` (PR #179) and the [Step 06 checkpoint](step-06.md). Final branch `feat/overhaul-step-07-saved-cash`, isolated worktree `/home/unusn/CR-step07`. The original `/home/unusn/CR` checkout, including concurrently appearing scheduler-prototype work, is preserved and excluded from this PR.
- Approved bank: unchanged Night shift / Layered paper / Patina teal v1.0. Reuses shared fonts, controls, paper treatment, outline icons and the single moving red navigation highlight.
- Target: static production export on `http://127.0.0.1:3042`, compiled with API `http://127.0.0.1:8787`, empty assistant/analytics/basePath. APIs are intercepted synthetic fixtures; external browser requests are blocked. No live records, Worker deployment, migration, policy activation or retention change.
- Final implementation, test and emitted-chunk identities: [source manifest](../evidence/step-07/checks/source-hashes.json). Runtime and static REA evidence: [investigation](../../investigations/internal-cash-history-2026-11-14.md).

## Result and interfaces

`/internal/cash-history` is a separate retained workspace, selected under Cash, linked from entry and Reports. Existing Bookkeeping cash/sales/hours/comparison links remain compatible. Store, 30-date lookup end date and exact-day controls distinguish loading, populated, empty-window, missing-record and failed/malformed-request states. Retry retains the filters. Copy states explain that expiry is 31 days **after saving**, a 404 cannot distinguish never-saved from expired, and direct links identify the current saved store/day rather than an immutable revision.

Record detail opens read-only and reuses Step 06's cash renderer/calculations with every drawer visible. It includes store/date, saved timestamp, all denominations, fixed-$100 drawer turn-in, Toast/Z comparisons, Extra money and stored day/difference totals. A blank read-only money field displays a dash. No saved preparer is inferred. English print remains the existing all-drawer paper output, even from Spanish UI.

Browsing does not close, checkpoint or replace an active cash draft. Explicit “Edit a copy” identifies its destination, asks for a new preparer, confirms replacement, and checkpoints cash work even when its editor is hidden. Cancel or failed checkpoint retains the prior editor. The copied server sheet becomes a new device draft with unknown original Count/Amount entry status; no PUT occurs until explicit Save.

Every save reads the current day first. Existing records are presented beside the retained editor and frozen attempt; Review replacement performs another read before the timestamped confirmation. A changed fingerprint forces fresh review. Failed preflight reads block writes. Each request owns a detached sheet/totals/raw-metadata snapshot. Acknowledgment cannot mark later input or a newer manager session saved. Acknowledged saves and subsequent history/read-back failures have distinct feedback.

An additive `cr-cash-save:{store}:{date}:{draftId}` envelope holds the comparison baseline and uncertain frozen attempt without credentials. Existing draft schemas and keys remain unchanged. Resuming as a copy carries recovery from the exact source draft into the new ID while preserving original bytes. Corrupt, unsupported or mismatched envelopes are retained and downloadable; they block a new write until recoverability is resolved. A failed device checkpoint never permits replacing the active editor.

A retry always reads first: a matching saved payload reports the match without another PUT; a divergent record is retained for explicit comparison/replacement; a missing record permits explicit retry of the frozen attempt. Newer input stays in the editor. The legacy service **still permits concurrent overwrites**. Fingerprints are comparison identities, and none of this is atomic conflict protection or server-side idempotency.

`fetchSavedCashoutRecord` validates store/date/sheet/stored totals/timestamp and returns a comparison fingerprint. Existing `fetchCashoutDay`, history, save and sales-link exports/wire shapes remain compatible. `fetchCashoutSnapshot` retains its legacy sales-link digest. No financial arithmetic or Worker code changed.

## Gates

| Gate | State | Evidence / limitation |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Exact lookup, hidden-draft transition protection, replacement review and uncertain-save recovery |
| Local automated checks | pass | Domain/draft/recovery/session/contract/i18n, saved-history and focused-entry browser suites, existing regressions, TypeScript/build/SEO; commands below |
| Local visual/task review | pass for emulation | Actual desktop, Spanish phone/enlarged, comparison and full-drawer PDFs inspected |
| Physical touch/software keyboard and staff review | pending | Step 06 limitation remains; headless emulation is not a physical device |
| Owner review before any next step | pending | PR and this checkpoint are the review unit; stop here |
| New backend/policy activation | not applicable to Step 07 | Existing HTTP contract only; no deployment or activation requested/performed |
| Durable revisions/retention/atomic conflict protection | pending | Step 07b and broader CASH-08 backend milestones remain open |
| Authorized release and live verification | pending | PR only; no merge, production persistence/retention claim or deployment |

## Scenario evidence

| Scenario / fixture | Expected and observed result | Evidence / boundary |
| --- | --- | --- |
| CR2/CR3 lookup and direct links | Correct current day; Cash selected; invalid real-date/store/duplicate links reject before record fetching | Saved-history browser suite + record reader tests |
| Loading/empty/missing/failed/malformed | Distinct states; 404 ambiguity disclosed; retry preserves store/end/exact dates | Synthetic responses, not live retention |
| Stale/out-of-order exact and window reads | Delayed CR2 or prior-window responses cannot replace current CR3/current-window results | Held synthetic reads |
| Draft browsing and canceled copy | Exact original local draft bytes, raw Amount/Count strings and selected PM drawer retained; lookup filters/detail also retained on return | Browser storage equality and visible editor assertions |
| Hidden editor / denied storage | Confirmed copy cannot replace editor when its checkpoint fails; no automatic PUT | Synthetic quota denial, original metadata retained |
| Copy editing / changed saved baseline | New labeled device draft; server entry metadata remains unknown; all saved and attempted drawers reviewable before confirmation; cancel sends no PUT | Comparison screenshot + request assertions |
| Save acknowledgment / read-back / history failure | Explicit replacement matches read-back; history refresh failure retains server-saved acknowledgment | Synthetic store/day documents and independent money oracle |
| Lost acknowledgment + reload | Additive envelope follows explicit source-draft resume; matching read-back sends no second PUT | Original source bytes and write count checked |
| Divergent/missing retry | Failed read blocks retry; divergent copies require review/confirmation; missing record permits explicit frozen retry | Payload equality across attempts; newer Count stays device-only |
| Pending edits / same-code new session / lock/expiry | Old acknowledgments never mark newer input or reauthenticated session saved; forced expiry retains current draft despite denied storage | Saved-history, focused-entry and retained-session regressions |
| Arithmetic / paper / locale / layout | Blank vs 0, all 11 denominations, negative turn-in, independent $100 per drawer, Toast/Z/Extra, legacy metadata, EN/ES, keyboard, 375px and 320px/200% text, all-drawer English print preserved | Independent browser oracle, PDFs and focused-entry suite; no physical keyboard claim |

## Checks actually run

Commands run from `/home/unusn/CR-step07`; portable output is in [checks](../evidence/step-07/checks). Browser environment: Chromium 158.0.8127.18, Python venv `/tmp/cr-step07-venv`, pinned [baseline requirements](../../../scripts/overhaul-baseline/requirements.txt), `LD_LIBRARY_PATH=/tmp/cr-step07-browser-libs/root/usr/lib/x86_64-linux-gnu`. Install uses existing lock; no dependency changes.

| Exact command | Result | Scope / exclusions |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | pass | Isolated dependencies; lock unchanged |
| `npm run cashout:test` | 36 pass | Existing cash/dashboard/inventory/draft tests + validated record/recovery tests |
| `npm run recovery:test` | 7 pass | Existing recovery semantics |
| `npm run forms:test` | 15 pass | Existing draft schema/context compatibility |
| `npm run internal:session:test` | 6 pass | Manager generation and checkpoint behavior |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass | Dictionary keys/placeholders and contracts |
| `npm exec tsc -- --noEmit` | pass | Touched application and tests |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | pass | Static export with new saved-history route |
| `npm run seo:check` | pass | Export SEO compatibility |
| `python scripts/test-cashout-history.py http://127.0.0.1:3042 --artifacts docs/internal-tools-overhaul/evidence/step-07/screens --rea` | 16 scenarios, 4 screenshots, PDF | Synthetic intercepted service, zero page errors/external attempts; passive REA final attach |
| `python scripts/test-cashout-focused.py http://127.0.0.1:3042 --artifacts /tmp/cr-step07-final-focused` | 10 scenarios, 6 screenshots, PDF | Existing focused-entry arithmetic, raw entry, keypad, reload, print and layout |
| `python scripts/overhaul-baseline/run-existing.py scripts/<suite>.py http://127.0.0.1:3042` | 10 suites pass | cashout-entry, cashout-context, entry-workspace, internal-drafts, internal-language, internal-recovery, internal-feedback, internal-session (14 scenarios), internal-home-reports (11), internal-shell (11) |
| `rea-project analyze …/out/_next/static/chunks --project /home/unusn/CR-step07 --source-path …` | pass with partial graph coverage | Exact final selection/identity and limitations in investigation; static syntax does not prove execution |

Legacy browser fixtures now supply real-shaped saved documents and exercise explicit review/copy controls. They retain their money, draft, focus, language, expiry and stale-response assertions. An initial regression caught storage-failure feedback being hidden by the uncertain-attempt message; the final copy explicitly reports both. Development-only failed runs and earlier artifact identities remain under private/temporary evidence and are not presented as final passing checks.

## Recovery and remaining work

- Rollback: revert this PR's UI/reader/recovery slice; retain all existing device drafts, original recovery bytes, server days and sales links. Earlier clients ignore the new additive envelope. No schema migration, record deletion or accepted-write reversal is necessary or authorized.
- Current limitations: local mocked writes do not establish live persistence, expiry timing, KV consistency, atomic replacement, historical retention or idempotency. No immutable revision can be linked or restored through this legacy endpoint.
- Physical-device/software-keyboard/staff review and broader accessibility conformance remain unverified. The headless enlarged/short-viewport checks do not close Step 06's review limitation.
- CASH-08's broader implementation/activation/live milestones remain open. Step 07b requires its own backend/retention scope and review. No next staged step has been started.
