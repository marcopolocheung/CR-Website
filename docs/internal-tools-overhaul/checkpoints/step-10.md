# Step 10 checkpoint: readable import history and comparisons

November 18, 2026 / Codex. Independent `feat/overhaul-step-10-import-history` from main `5dfb017`, worktree `/home/unusn/CR-step10`. Steps [08 #194](https://github.com/marcopolocheung/CR-Website/pull/194) and [09 #195](https://github.com/marcopolocheung/CR-Website/pull/195) were opened first, remain unmerged and are not branch dependencies. Original checkout/uncommitted work preserved. Night shift bank v1.0 and moving navigation retained; reuses shared theme, paper, buttons, manager session and navigation transitions.

`/internal/import-history` is reachable from Reports and converter history controls. Filters use one store, import kind, exact sales date or exact inclusive hours period with existing cursor pagination. No cross-period search is implied. Invalid links do not load; failed reloads keep records labeled with their original context. Changes mark prior results stale. Records lead with store/period/preparer/saved time/output and reprocessing relationship. Details holds source fingerprints, parser/mapping versions, identity/record IDs and JSON export.

Resume travels only in memory to the matching converter, clears acknowledgement and leaves immutable source records untouched. Replacement first confirms and checkpoints existing valid reviewed work as a new compatible device draft, including cached output. Quota denial, incomplete/unlabeled work, pending operations or unsaved directory choices refuse replacement. Original recovery bytes are not overwritten. This safely unavailable case requires completing/preparing the working import or saving its pending mappings; no raw-upload storage or new recovery schema is invented. Inline history uses the same scoped transition and keeps retry, deterministic duplicate and deliberate-reprocessing behavior.

Session-generation guards suppress old reads/acknowledgements and prevent reprocessing POSTs after confirmation/hash waits when access expires or is replaced, including the same code. A restore epoch also protects the independent main-based Hours editor against same-context directory completions. The hub uses a unique manager-code field ID; existing cash field IDs remain compatible.

Comparison retains `/internal/bookkeeping#comparison`. Store/employee summaries and coverage precede grouped exceptions; each notice exposes its affected source contexts. Source selection/mapping controls are in a named disclosure and remain mounted. Loading/mapping operations freeze replacement controls. Historical actual mappings stay bound to imports; current schedule mappings apply only to estimates. Actual regular/overtime is not recomputed. Missing whole-source imports/publications show unavailable; explicitly mapped OFF remains zero. Duplicate/overlap quarantine, raw source evidence and evidence JSON remain unchanged. Failed reload retains the old report/context; changed requested filters mark it stale; locking hides private results. English print retains per-store employee values and every coverage notice. No report persistence or immutable historical schedule-time claim.

| Gate | State | Evidence / limitation |
| --- | --- | --- |
| Local domain/checkpoint correctness | pass | 54 import tests, including independent new-device-copy/storage-failure checkpoints; 5 Worker tests |
| TypeScript, production build, SEO | pass | Explicit loopback static export, new noindex internal route |
| Dictionary/contracts/recovery/session | pass | Existing domain suites and bilingual placeholder parity |
| History hub and inline history browser | pass | Exact context/pagination, duplicate/reprocess/retry, source immutability, checkpoint/cancel/quota denial, independent XLSX cells/cache, stale reads and same-code confirmation/hash races |
| Comparison browser | pass | Independent 48 total / 34 mapped / 14 unmatched hours, changed mappings/publications, OFF zero, missing/incomplete sources, duplicate quarantine, stale/failed reload and lock |
| Other import and recovery/navigation regressions | pass | Validation, sales review, hours preview, mapping, retention, recovery and shell |
| Local visual/task emulation | pass | Desktop 1440, tablet 768, phone 390, 320px enlarged Spanish; keyboard, reduced motion; English PDF with bounds assertions |
| Physical device/software keyboard, owner/staff review | pending | Emulation is not physical/staff acceptance |
| Shared history/directory/publication backend activation | pending | Source/contracts and local intercepted APIs only; no live availability assertion |
| Release/live verification | pending | No merge, deploy, migration or production mutation |

## Actual verification

From `/home/unusn/CR-step10`: `npm run imports:test`; `npm run imports:worker:test`; `npm run recovery:test`; `npm run internal:session:test`; `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts`; `npm exec tsc -- --noEmit`; `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`; `npm run seo:check`.

Browser: Chromium 158.0.8127.18, `/tmp/cr-overhaul-venv/bin/python`, `LD_LIBRARY_PATH=/tmp/cr-browser-libs/root/usr/lib/x86_64-linux-gnu`; `scripts/overhaul-baseline/serve.py --port 3045`. New `scripts/test-import-history-hub.py` plus existing suites through the external-network guard. All API fixtures intercepted at `http://127.0.0.1:8787`; no external requests or real staff records. The shell test was rerun after an initial run overlapped export rebuilding; only the completed-export run is final evidence. [Evidence](../evidence/step-10/README.md) retains logs, source hashes, screenshots, PDFs and JSON. [REA investigation](../../investigations/internal-import-history-2026-11-18.md) records artifact/observation identities, partial coverage and limits.

Workbook cells F2/F3/F4/G4/H4/F9 independently expected 9/8/17/15.5/1.5/7 after reviewed history resume. Cached repeat bytes match exactly. Shared history still stores reviewed values and reported output metadata without original uploads or workbook bytes.

## Review, overlap and rollback

Review exact-period filters/pagination; canceled, failed-checkpoint and successful resume; save failure after download; unchanged retry/duplicate versus deliberate reprocessing; stale confirmation/hash across reauthentication; missing two-store coverage, mapped OFF and hidden publications; historical actual mapping independence; lock and failed reload preserving context.

Merge 08 → 09 → 10 → 11. Overlap: both converter restore/hooks/checkpoint registration, Hours directory restore epoch (preserve Step 09’s stage reset and local epoch), inline history, shared dictionaries, Reports links/shell/workspace/layout, browser helpers/scenarios and tracker/briefs. Each branch independently builds from main; retain each converter's local stage composition when integrating the transition hook. Step 09 separately received the same directory session guard after review.

Rollback: revert this UI/transition/checkpoint slice, keep all existing device drafts, original recovery bytes, history records and existing readers. No server schema or persistence contract changed. Owner review, physical staff/device checks and backend activation remain open. The approved plan authorizes Step 11 after this PR opens; no merge or deployment.
