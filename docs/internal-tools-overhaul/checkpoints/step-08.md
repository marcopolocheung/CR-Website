# Step 08 checkpoint: staged daily sales import

November 18, 2026 / Codex. Independent branch `feat/overhaul-step-08-sales` starts at `origin/main` `5dfb017`. The original `/home/unusn/CR` checkout and its uncommitted work remain untouched. Approved Night shift bank v1.0 reused through InternalTheme, Paper and Button. The approved request authorizes completing and opening all four independent PRs in order; none may be merged or deployed.

Files → Review → Report retains `/internal/bookkeeping#sales`, mounted native uploads, individual validation, selected context and derived weekday. Only matching recognized content metadata across all three valid sources may fill empty context fields. Filenames confer no authority. Review leads with headline figures, reconciliation, unmapped values, context explanation and acknowledgement before source details. Manual cash and saved-cash fill recompute without discarding files. Invalid values block acceptance; late and failed fills preserve input. Details identify raw values, source locations and workbook destinations, distinguishing comparison totals from copied cells.

Acceptance generates a cached report; download is a subsequent action. Generated, download-started, device-copy and acknowledged shared-save states remain separate. Back navigation preserves acceptance until actual edits; edits invalidate stale output. Restored primitive values enter Review without original uploads or acknowledgement, remain editable and preserve original device/shared records.

## Gates and actual checks

| Gate | Result | Evidence / limitations |
| --- | --- | --- |
| Local implementation and focused scenarios | pass | [Evidence](../evidence/step-08/README.md), synthetic fixtures only |
| TypeScript, production build, SEO | pass | Loopback API compiled into static export; checks directory |
| Import domain | pass | 54 import tests including independent expected template cells, styles, formulas and print setup |
| Recovery/session domain and dictionaries/contracts | pass | Existing suites; stable keys and placeholder parity |
| Sales validation/review/retention browser | pass | Real exported XLSX cells, cached repeat digest, template retry, raw cash/zero/blank, stale response, native replacement cancellation, reload copies |
| Hours/mapping/history/comparison browser | pass | Existing synthetic suites; comparison lock selector repaired for current shell |
| Navigation/recovery browser | pass | Shell 11 scenarios and recovery suite; shell manifest path updated for current route group |
| Feedback browser | pass | Source/context validation now exercised in Files; field-focus/modal/save-state regressions retained |
| Older session/language browser suites | limited | Session stops at Forms “New write-up”; language expects outdated Spanish unlock label “Acceder”. Do not claim these full suites passed |
| Tracker consistency audit | pre-existing failure | Stops at SCH-05 metadata/row mismatch; this PR does not change scheduler milestones |
| Visual/task emulation | pass | Desktop 1440, tablet 768, phone 390 and 320px enlarged Spanish, keyboard, reduced motion, English PDF; screenshots inspected |
| Physical-device/software keyboard, owner/staff review | pending | Emulation does not establish device or staff acceptance |
| Shared service activation and live release | pending | No Worker deployment, migration, production data or retention operation; unavailable service remains explicit |

Commands from `/home/unusn/CR-step08`: `npm ci --no-audit --no-fund`; `npm run imports:test`; `npm run recovery:test`; `npm run internal:session:test`; `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts`; `npm exec tsc -- --noEmit`; `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`; `npm run seo:check`.

Browser commands: `/tmp/cr-overhaul-venv/bin/python scripts/test-import-review.py http://127.0.0.1:3043` and `scripts/overhaul-baseline/run-existing.py scripts/test-<suite>.py http://127.0.0.1:3043`, with `LD_LIBRARY_PATH=/tmp/cr-browser-libs/root/usr/lib/x86_64-linux-gnu`. Suites and logs are in evidence/checks. Chromium 158.0.8127.18; loopback static server; intercepted loopback APIs; external requests blocked. Passive REA and emitted-artifact identities/limitations are in the [investigation](../../investigations/internal-sales-stages-2026-11-18.md).

## Review, overlap and rollback

Review known/missing/mismatched context, a payment/category warning, blank and zero cash, edit after acceptance, failed template/retry, canceled replacement and restored copy without uploads. Preserve the current reviewable-warning export policy; no new override or financial rule was introduced.

Recommended merge order: 08 → 09 → 10 → 11. Shared overlap with later PRs: dictionaries, browser helper/validation/retention scenarios, guide/tracker and affected briefs; Step 10 also integrates history. Each branch independently builds from main. Keep each converter's stage composition local when resolving overlap.

Rollback: revert this UI/computation-helper slice while preserving all draft keys, unreadable recovery bytes and server records. No business formulas, parser mapping, workbook layouts, server APIs or history identity changed. PR review is pending; continuation is authorized by the approved plan. No merge, deployment or production verification is claimed.
