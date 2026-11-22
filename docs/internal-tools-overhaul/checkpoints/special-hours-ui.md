# Inline and multi-day Hours checkpoint

## Scope and baseline

- Requested addition to PR #200: edit Hours beside the clicked control, select multiple days, and avoid a window for each date. Confirmed preferences: displayed week only; explicit Apply.
- Baseline: initial PR commit `3f5aeae` on `codex/scheduler-hours-ui`, based on merged main `b85671c`. Existing diagnostic notes and dashboard SQL helpers remain outside this PR.
- Design: Night shift bank v1.0, Layered paper and Patina teal. Shared navigation and backend contracts remain unchanged.
- Result: a nonmodal anchored editor with Normal / Closed all day / Close early, conditional closing time and Apply. Apply to more days reveals seven date checkboxes with current hours, All week and Clear selection. Set hours beside the week controls opens the multi-day version without preselecting dates or a setting.
- More options retains optional labels and individual-date cleanup adjustments. Bulk operations preserve existing labels unless explicitly changed, and preserve valid custom finishes for unchanged hours. Changing a closing time uses existing defaults and identifies affected custom cleanup finishes before Apply.

## Save and recovery behavior

- A frontend coordinator saves dates sequentially using existing event/review endpoints. Each write retains its operation identity; retries skip acknowledged writes, including already completed dates. Normal dates without exceptions need no records.
- The entire group is verified against a final read and the current local shift layout before one parent update merges reviews/assignments and creates one Undo entry. The current parent callback is used after asynchronous work to avoid applying an old render's draft state.
- Partial progress names saved and unconfirmed dates. The draft remains unchanged until verification succeeds. Reload latest preserves choices and requires explicit Apply; accepted shared records are never rolled back automatically.
- The rest of the scheduler is inert during active/uncertain saves; pending generation/adjustment is canceled and keyboard Undo is blocked. A background refresh cannot release that lock. Editing context cannot switch with unapplied hours choices.
- Escape/Cancel discard unapplied choices. Outside clicks dismiss only an unchanged editor; focus returns for explicit dismissal/application without stealing focus from an outside click. Dates and scope survive existing deep links, with data loading checked before showing the editor.
- Dining/kitchen review and publication remain independent. Undo restores the draft, not shared hours. Staff schedules change only on Publish.

## Gates

| Gate | State | Evidence |
| --- | --- | --- |
| Local implementation | Pass | Single/multi-date editor and batch coordinator implemented |
| Automated checks | Pass | 246 scheduler tests, 3 dictionary tests, TypeScript, build, browser workflow, SEO, tracker and whitespace checks |
| Visual/task check | Pass locally | Inspected desktop/phone inline editor and bulk selections; keyboard/focus, viewport edges, and enlarged Spanish single/bulk checks pass |
| Owner/device review | Pending | Physical touch, browser zoom and software keyboard not tested on a real device |
| Backend compatibility | Existing contract | No Worker, schema, binding or public API change |
| Release/live verification | Pending | Update existing PR #200; no merge, deployment or live data entry |

## Scenarios and checks

- New batch unit tests cover full-week closure, calendar ordering, per-date labels/cleanup, no-op normal dates, accepted-but-lost review responses, retry identities, changed source/layout rejection, unchanged records after Undo, and stale-context interruption.
- Expanded browser coverage exercises nonconsecutive selections, two groups with different hours, All week/Clear selection, one grouped Undo, partial review/event writes, failed final reads, background refresh during uncertainty, label replacement/clearing, automatic defaults and custom cleanup preservation.
- Existing coverage retains all three layouts, kitchen access, deep links, source reload, conflict input preservation, copying/normal cancellation, separate station publication, staff desktop/phone and print. Keyboard focus, nonmodal dismissal, viewport edges, 320px reflow and enlarged Spanish single/bulk forms are included.

## Checks actually run

- `npm run scheduler:test`: 246/246 pass, including 8 new batch tests. The new tests are included in the existing CI scheduler command.
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`: 3/3 pass.
- `npx tsc --noEmit`: pass.
- `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:3064 NEXT_PUBLIC_API_BASE=http://127.0.0.1:3064 npm run build`: pass. Restored Next's unrelated generated `next-env.d.ts` change afterward.
- `LD_LIBRARY_PATH=/home/unusn/.local/chromium-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-scheduler-checks/bin/python scripts/test-special-hours.py --url http://127.0.0.1:3064 --artifacts /tmp/cr-inline-hours`: pass with Playwright 1.65.0 and cached Chromium 1254. Synthetic intercepted APIs only; no production data or paid assistant used.
- `npm run seo:check`, `python3 scripts/check-overhaul-tracker.py`, `git diff --check`: pass.

Small retained screenshots: [single-day editor](../evidence/special-hours-ui/early-desktop.png), [phone editor](../evidence/special-hours-ui/early-phone.png), [closed day](../evidence/special-hours-ui/closed-desktop.png), [bulk editing on the board](../evidence/special-hours-ui/bulk-on-board.png), [phone selection](../evidence/special-hours-ui/bulk-phone.png). Raw logs stay in `/tmp/cr-inline-hours-*.log`; remaining browser artifacts and print PDF stay in `/tmp/cr-inline-hours/`. Those temporary outputs are not committed evidence.

This release requires a website deployment against the activated special-hours service. No additional Worker deployment or D1 setup is introduced. Broader scheduler overhaul steps were not started.
