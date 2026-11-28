# Step 13 checkpoint: forms library and sectioned editors

## Scope and baseline

November 24–27, 2026 / Codex. Final verification November 27 (November 28 UTC). Branch `feat/overhaul-step-13-forms`, isolated worktree `/home/unusn/CR-step13`, from freshly fetched main `7c0aff9`. Step 12a merged in [PR #202](https://github.com/marcopolocheung/CR-Website/pull/202). The original checkout/untracked work is preserved. Night shift bank v1.0, Layered paper, Patina teal and moving global navigation remain intact.

The [approved contract](../evidence/step-13/approved-plan.md) is implemented: Saved forms default, one purpose-based New form chooser, dedicated device Drafts and public Blank forms views, one retained editor and sectioned bilingual entry followed by read-only review for all five existing types. Stored fields/options, immutable saved contents, original copied draft identities/savedId warnings, label-only editing, confirmed deletion, source recovery and English paper output remain compatible. Eleven blank files and URLs remain unchanged.

No new type, Worker route/schema/migration, attachment, amendment, signature/approval or retention service is added. The frontend label adapter now returns the existing acknowledgement's label/timestamp instead of discarding it; the request/response wire contract is unchanged. Legacy saved write-ups have no store metadata; none is inferred from device drafts. Staff terminology and broader DEC-07/UX-07 policy gates remain separate.

## Gates

| Gate | State | Evidence / boundary |
| --- | --- | --- |
| Local implementation | pass | Retained library/editor, strict draft discovery, bilingual sections/review, request/session/identity guards and existing paper renderers. |
| Local automated checks | pass | `npm run check`: 419 tests; dictionary/contracts: 9; type/build/SEO and tracker checks pass. |
| Browser visual/task/output verification | pass | New workspace: 14 groups; existing forms list/drafts/compatibility, local Worker digital suite, recovery, shell 11 and session 14 pass with zero page errors/external attempts. Synthetic/local only. |
| Owner review before Step 14 | pending | [PR #203](https://github.com/marcopolocheung/CR-Website/pull/203) is open for review into main; stop without merging. |
| Backend/policy readiness | outside this slice | Existing fields/APIs remain; staff language, verified signature/approval and wider policy/backend tasks are not advanced. |
| Physical device/software keyboard/staff acceptance | pending | Browser emulation does not establish these checks. |
| Release/live-service verification | pending | No deployment, migration or production mutation. |

## Scenario evidence

[Workspace results](../evidence/step-13/screens/results.json), [logs](../evidence/step-13/checks/), [screenshots/PDFs](../evidence/step-13/screens/), [source/emitted hashes](../evidence/step-13/source-hashes.json) and the [REA investigation](../../investigations/internal-forms-workspace-2026-11-27.md) retain actual results and limits.

- Saved-first/three hashes, direct URL variants, Back/Forward, same-view reselection and Return to draft preserve work and saved filters. Blank files remain available while locked.
- All five types preserve required/optional rules, raw text/money and canonical choices. Review sends no mutation; edit-section actions return focus to the matching section. Spanish/language changes leave draft bytes unchanged.
- Draft discovery isolates form namespaces and context; unreadable/future bytes are downloadable, denied storage is not an empty list, resume forks identities and saved copies never create another server record automatically.
- Confirmed POST precedes detail GET; failed detail loading retries GET only. Unconfirmed POST retains the draft and asks managers to inspect saved forms. Double clicks produce one request. Newer/expired response scenarios preserve correct selection/session/draft save state.
- Immutable historical forms reopen read-only. Label changes send only label metadata; deletion cancellation, failure/retry, stale list overlays/tombstones and final 404 responses were observed with the local Worker.
- Six English PDFs cover a historical write-up and all five current types. Independent fixtures check full 40-line narratives, declarations, selected paper checkboxes, canonical digital selections, money and signature text. Unrelated controls/views stay out. Original write-up paper code is unchanged except extraction/export.
- Sixteen library/editor screenshots cover 1440/768/390/320px and enlarged Spanish; keyboard/focus, reduced motion and narrow filter boundaries were inspected. Shared shell/session tests preserve the global moving highlight and access lifecycle.

## Checks actually run

| Command / log | Actual result |
| --- | --- |
| `npm run check` — [check.txt](../evidence/step-13/checks/check.txt) | 419 pass: scheduler 246, cashout/inventory 54, session 7, recovery 7, imports 57, forms 29, requests 5, agent 14. Includes 14 new draft/presentation tests. |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` — [log](../evidence/step-13/checks/i18n-contracts.txt) | 9 pass. |
| `npm exec tsc -- --noEmit` — [types.txt](../evidence/step-13/checks/types.txt) | pass, including preserved generated declaration file. |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` — [build.txt](../evidence/step-13/checks/build.txt) | production static export pass. |
| `npm run seo:check` — [seo.txt](../evidence/step-13/checks/seo.txt) | pass. |
| `scripts/test-forms-workspace.py http://127.0.0.1:3050` — [log](../evidence/step-13/checks/browser-workspace.txt) | 14 groups pass; six PDFs, 16 screenshots, exact values/requests and final passive REA capture. |
| Existing `test-forms-list.py`, `test-forms-drafts.py`, `test-forms-compat.py` through `scripts/overhaul-baseline/run-existing.py` | pass; preserved assertions adapted for new chooser/readonly content and scoped retained panes. |
| Existing `test-digital-forms.py http://127.0.0.1:3050 http://127.0.0.1:8787` through guard wrapper — [log](../evidence/step-13/checks/browser-digital.txt) | actual disposable local Worker persistence, labels, deletion/404 and refresh pass for all five types. |
| Existing recovery/session through guard wrapper; shell with `--artifacts .../step-13/shell` | recovery pass; session 14 and shell 11 pass; zero page errors/external attempts. |

Final browser runner: `LD_LIBRARY_PATH=/tmp/cr-step13-browser-libs/root/usr/lib/x86_64-linux-gnu /tmp/cr-step13-venv/bin/python`, Playwright 1.65.0 / Chromium 158.0.8127.18. Static service: `python3 scripts/overhaul-baseline/serve.py --port 3050`. APIs are explicitly loopback; mocked runs block external traffic. Local Worker: `WRANGLER_SEND_METRICS=false npm exec wrangler -- dev --local --config worker/wrangler.local.jsonc --compatibility-date 2026-05-03 --var SCHEDULE_WRITE_TOKEN:synthetic-forms-token --port 8787 --persist-to /tmp/cr-step13-worker-final`. The runtime date override is necessary because installed workerd does not support the repository's September date. That configuration/deployed runtime remains unverified; no repository Worker change was made.

REA 6.8.0 final static and passive runtime identities, raw run locations and partial/policy-filtered coverage are retained in the investigation and `rea/`. Raw results remain in `.rea/runs/`; complete summary-view coverage is not complete application coverage.

## Review and rollback

Review Saved → New → Enter → Review → Save for all five types; browse libraries with an active draft; reload/resume a device copy; inspect Spanish labels against unchanged canonical values; retry failed saves/reads and change only a manager label. Check deletion confirmation and inspect all print fixtures before advancing.

Rollback the frontend commits while retaining original record readers, immutable saved contents, all draft/source/recovery bytes and eleven blank URLs. Do not clear storage/server records. Wider attachment/amendment/signature/staff-language/live-service milestones stay open. Step 14 has not begun.
