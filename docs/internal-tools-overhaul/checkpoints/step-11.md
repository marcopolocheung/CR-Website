# Step 11 checkpoint: focused inventory counting

November 18, 2026 / Codex. Independent branch `feat/overhaul-step-11-inventory` from main `5dfb017`, worktree `/home/unusn/CR-step11`. Steps [08 #194](https://github.com/marcopolocheung/CR-Website/pull/194), [09 #195](https://github.com/marcopolocheung/CR-Website/pull/195) and [10 #196](https://github.com/marcopolocheung/CR-Website/pull/196) were opened first and remain unmerged; this branch needs none of them. Original checkout/uncommitted work preserved. Night shift bank v1.0, moving navigation, shared theme/paper/buttons and in-memory access retained.

The CR3 count workspace uses existing catalog sheets as sections. Generous On hand rows expose supplier/catalog notation, Enough, explicit Skip/Undo skip and manual order overrides. Untouched, entered zero, measured quantity, free text, Enough and skipped are distinct. An order alone remains untouched. Search, section, Remaining, Needs ordering and supplier controls preserve raw values and stable overall entered/Enough/skipped/remaining/total counts. A focused row stays mounted while typing a fraction under Remaining. Previous-date pairs live in a named comparison disclosure. Catalog editing/conflicts, supplier checklist, copy and familiar English print remain available.

Progress/skips and captured catalogs are device-only. A versioned CR3/date envelope supplements unchanged `cr-inventory` and exact-day readers. Unsupported/corrupt progress or legacy bytes are preserved in place and downloadable. Storage denial preserves current text and refuses an unprotected handoff. Reload uses the captured catalog, section and stable IDs. Current catalog differences require explicit review/adoption; adoption first archives the prior exact envelope, retains removed IDs and leaves same-name new IDs blank. New catalog rows get fresh IDs so deleted name slugs cannot inherit historical counts. No physical shelf assignment, unit conversion or shared Complete action is invented.

A first unknown server day keeps editing/save/clear unavailable until its baseline loads; failure has an explicit retry. It does not manufacture an empty ready envelope or let catalog editing bypass this guard. Existing local work stays authoritative during late reads. Date/session/generation/mutation guards suppress stale results. A save sends only the original `{counts}` with `inv`, `order`, `done`; acknowledgement says only count fields were saved. Edits during PUT or post-save refresh remain local and receive an earlier-save message. A failed refresh after an acknowledged PUT is distinct from a failed save. Count saves remain the existing last-write API, without new concurrency guarantees.

| Gate | State | Evidence / boundary |
| --- | --- | --- |
| Local count/progress implementation | pass | Five new state/filter/recovery/catalog tests plus existing suggestions, 45 total cashout/inventory tests |
| Types, production build, SEO | pass | Explicit loopback static export; no dependency/API/Worker/schema change |
| Dictionary/contracts/recovery/session | pass | Existing domain suites and bilingual placeholder parity |
| Browser count/recovery | pass | Synthetic count states, stable denominator, raw notation, interruption, date cancel/return, denied storage, unsupported bytes, first-read retry, late save/read, new-device restore and remove/re-add identity |
| Existing catalog recovery/navigation | pass | Offline/auth/conflict retention, original-base retry, compare/copy/download and one in-flight save; shell scenarios recorded in evidence |
| Visual/output emulation | pass | 1440/768/390/320px, enlarged Spanish, keyboard/focus, reduced motion; English PDF preserves all rows and five INV/ORDER pairs despite filters |
| Physical device/software keyboard and staff review | pending | Browser emulation is not staff/device acceptance |
| Durable inventory session/skip/completion backend | not applicable | Explicitly excluded from approved device-only slice; wider INV-01/10 milestones remain pending |
| Release and live verification | pending | No merge, deployment, migration or production mutation |

## Checks and evidence

From this worktree: `npm run cashout:test`; `npm run recovery:test`; `npm run internal:session:test`; `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts`; `npm exec tsc -- --noEmit`; `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`; `npm run seo:check`.

Browser: Chromium 158.0.8127.18, `/tmp/cr-overhaul-venv/bin/python`, `LD_LIBRARY_PATH=/tmp/cr-browser-libs/root/usr/lib/x86_64-linux-gnu`; `scripts/overhaul-baseline/serve.py --port 3046`; `scripts/test-inventory-counting.py http://127.0.0.1:3046`, `scripts/overhaul-baseline/run-existing.py scripts/test-internal-recovery.py http://127.0.0.1:3046`, `scripts/test-internal-shell.py http://127.0.0.1:3046 --artifacts docs/internal-tools-overhaul/evidence/step-11/shell`. All APIs intercepted at loopback port 8787; no external requests or real records. The shell regression uses the new labeled On hand rows and correct scheduler source path. Initial cash quota/lock timing and obsolete row-selector failures are retained separately. The shell also caught optional `note: undefined` fields in the built-in catalog being rejected during checkpointing; the compatible validator now accepts absent/undefined optional notes, with a default-catalog round-trip regression. Five-pair print uses compact headings without truncating raw values.

[Evidence](../evidence/step-11/README.md) retains logs, hashes, synthetic request assertions, screenshots and English PDF. [REA investigation](../../investigations/internal-inventory-counting-2026-11-18.md) identifies emitted artifacts and passive observations with their coverage limits. Source inspection establishes the unchanged adapter/Worker contract; mocked acknowledgements do not prove live persistence.

## Review, overlap and rollback

Review a partial section then reload; Remaining versus order-only input; skip/undo/zero/fractions/text; storage failure and date cancellation; changed/removed catalog IDs and same-name replacement; failed first load; late save and refresh; new-device restore without skips; supplier copy and filtered-screen/full print. Owner review remains open.

Merge 08 → 09 → 10 → 11. Overlap: shared dictionaries, package test commands, tracker/guide/briefs and shell evidence/test helpers. Each branch builds independently from main; preserve all prior keys/scripts when resolving overlaps. Inventory composition stays local. No Step 12 ordering persistence or multi-store inventory work is included.

Rollback: revert this UI/additive-device slice while retaining all legacy count keys, new envelopes, archives, original recovery bytes and stable IDs. Existing readers still read the unchanged count shapes. Do not delete device copies or server records. Wider INV unit, historical server-snapshot and durable-session tasks stay open. Four PRs open ends the approved work; no merge or deployment.
