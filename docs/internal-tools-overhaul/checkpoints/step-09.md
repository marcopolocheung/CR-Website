# Step 09 checkpoint: hours stages and identity review

November 18, 2026 / Codex. Independent branch `feat/overhaul-step-09-hours`, worktree `/home/unusn/CR-step09`, baseline main `5dfb017`. [Step 08 PR #194](https://github.com/marcopolocheung/CR-Website/pull/194) was opened before this implementation began; it is not a branch dependency. Original checkout/uncommitted work preserved. Night shift v1.0 reused through InternalTheme, Paper, Button and converter-local stage styling.

Files holds store, inclusive period, preparer and CSV validation. Review leads with source/included/excluded counts and separate total/regular/overtime source hours, followed by employee totals and a focused excluded/missing/ambiguous/unmatched queue. Explicit source/shared IDs group people; names never establish identity. Details preserve physical row numbers and all raw columns. Queue actions focus the source row or existing directory controls. Existing export-blocking identity rules remain distinct from unmatched shared identities with complete source IDs.

Directory loading, saving, unavailable service, authorization failure and revision conflict retain distinct messages. Failed directory requests retain working choices and existing eligibility. Stage navigation alone preserves mounted files, rows, mapping choices and acknowledgement. Actual preparer/period/source/mapping edits clear approval/output. Context confirmation is retained. A restore epoch resets only the replaced directory editor and suppresses its old responses, including when restoring the same fingerprint/period.

Acceptance generates a report before the separate Download workbook action. Generated, download-started, device and shared-save outcomes remain separate. Restored values enter Review without acknowledgement or original uploads; fields remain editable. Existing readers, workbook cells, source regular/overtime values, payroll rules and record identities remain unchanged.

| Gate | State | Evidence / limitation |
| --- | --- | --- |
| Local implementation and domain checks | pass | 52 import tests, recovery/session tests, dictionary/contracts |
| TypeScript, production build, SEO | pass | Static production export compiled with explicit loopback API |
| Hours staging/preview/mapping/history/retention/validation browser | pass | Independent workbook cells and cached-repeat digest; overnight boundaries, excluded rows, identity mappings, conflict/retry, restored copies |
| Sales compatibility browser | pass | Original review/validation flow still works on this independent branch |
| Navigation/recovery/comparison browser | pass | Current shell route/lock fixture references; synthetic APIs only |
| Local visual/task review | pass for emulation | Desktop 1440, tablet 768, phone 390, 320px/200% Spanish, keyboard, reduced motion, English PDF |
| Physical device/software keyboard, owner and staff review | pending | Emulation is not physical or staff acceptance |
| Shared service activation/live release | pending | No deployment, migration, real-data mutation or production verification |

## Actual verification

From `/home/unusn/CR-step09`: `npm run imports:test`; `npm run recovery:test`; `npm run internal:session:test`; `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts`; `npm exec tsc -- --noEmit`; `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`; `npm run seo:check`.

Browser: Chromium 158.0.8127.18, `/tmp/cr-overhaul-venv/bin/python`, `LD_LIBRARY_PATH=/tmp/cr-browser-libs/root/usr/lib/x86_64-linux-gnu`, `scripts/overhaul-baseline/serve.py --port 3044`. Run `scripts/test-import-hours-stages.py http://127.0.0.1:3044`; other scripts through `scripts/overhaul-baseline/run-existing.py`. [Evidence/checks](../evidence/step-09/README.md) retains exact outputs. The full shell suite passed on retry after an initial cash-only quota-lock timing failure; no cash implementation changed in this branch. All fixtures are synthetic and APIs intercepted at `http://127.0.0.1:8787`; external requests blocked. No dependency or lock changes. REA identities, partial coverage and observation limits are in the [investigation](../../investigations/internal-hours-stages-2026-11-18.md).

Independent hours fixture: Chicago-start-date overnight 3 hours (2.5 regular/.5 overtime) plus daytime 8 (7/1) produces included 11, regular 9.5, overtime 1.5. Later-day/open/ambiguous source rows stay excluded and visible. Read actual F2:H4 workbook cells against literal expectations, not parser-derived expectations. Repeat download reuses exactly the same cached bytes. Resume preserves original draft bytes; preparer edits intentionally require regeneration, so an edited copy is not asserted byte-identical to the original.

## Review and rollback

Review the missing-ID/same-name queue, explicit UUID choices, unavailable/conflicting directory requests, canceled context change, Files ↔ Review navigation, report retry, same-context restore during a pending request and resume without uploads. The shared directory/backend is not activated by this PR.

Recommended merge order 08 → 09 → 10 → 11. Overlap: en/es dictionaries, browser helper/validation/retention/history scenarios, guide/tracker and briefs. Stage composition and CSS remain local to the hours converter. Preserve both converters' scenario adaptations when merging.

Rollback: revert this UI slice while retaining all original draft keys, snapshots, unreadable recovery bytes and server records. No API or financial/payroll migration. Owner/physical/staff review and release are pending; the approved plan authorizes continuing to Step 10 after this PR opens, with no merging or deployment.

## Session-generation follow-up

Review while implementing Step 10 found that a directory reload confirmation could outlive its manager session. The directory editor now captures its operation generation before confirmation, rechecks it before reading, and invalidates old operations even when the same code is entered again. Old completion cleanup cannot clear a newer operation. This same small guard is present independently in Step 10. TypeScript, loopback production build/SEO, mapping and staged-hours browser scenarios passed again; `checks/session-followup-*` retains results. Source hashes and visual evidence were refreshed. Earlier static REA describes the pre-guard build; a final passive observation records this build, without claiming static/runtime equivalence.
