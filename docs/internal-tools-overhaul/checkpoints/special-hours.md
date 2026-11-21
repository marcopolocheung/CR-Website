# Special hours completion checkpoint: items 1–6

## Scope and baseline

- Date / owner: November 20, 2026 / Codex.
- Baseline: `main` at `0ac29ca0e9acefd74d3dd5f5201550a146aa0573`, plus the preserved, uncommitted [publication foundation](special-hours-publication.md).
- Authorization: the user requested detailed planning before implementation and completion of items 1–6 as one delivery. The [implementation plan and operating guide](../special-hours.md) records the design, interfaces, state handling and release contract. No intermediate prerequisite is being handed back as completion of those six items.
- Scope: dated restaurant-wide normal/closed/early-close events; station staffing review and status; all manager layouts; cleanup times; copy/navigation/Undo; staff labels and print. Full overhaul Steps 14–16, recurring holidays, public-site hours widgets and notifications are not claimed complete.
- Design: Night shift v1.0, Layered paper, Patina teal, existing moving navigation retained. New controls reuse the bundled working/display fonts, 44px minimum controls and focus treatment.
- Environment: synthetic loopback frontend/API fixtures; disposable real local D1/KV under `worker/wrangler.local.jsonc`; no remote bindings, paid models, real staff records or production requests. Changes remain uncommitted for review.

## Requested outcomes

| Item | Implemented result | Observed evidence |
| --- | --- | --- |
| 1. Visible Hours control | A labeled control beside every date in Planning, Current and Classic opens the same dated editor with Normal / Closed all day / Close early | Browser exercised all three layouts, keyboard Enter/Escape and focus return; screenshots retained |
| 2. One restaurant-wide event | D1 records are scoped by store/date and shared by dining/kitchen; normal hours creates a cancellation revision | Real D1 create/edit/conflict/retry and store/date isolation tests; browser reads the same event from both stations |
| 3. Preview and cleanup | Preview lists positions, assigned names, original times and Keeps; closed days remove every spot; early closes suggest shorter shifts/removal and permit explicit cleanup finishes | Locked assignment removed with explicit count; 7 PM customer close with a 7:30 PM dining finish; kitchen independently chooses 7 PM; original templates and surviving IDs unchanged |
| 4. Separate review/publication | Each station has its own review revision and Needs review / Ready to publish / Published status; source/rule changes require review; no automatic publish | Browser publishes dining then kitchen, observes their independent status, and rejects unknown reads; real Worker rejects stale/omitted metadata and mismatched effective slots |
| 5. Date-safe copying and drafts | Exceptions stay outside normal templates and are fetched for destination dates. Applying changes only affected assignments. Undo restores local assignments/Keep and applied review selection while shared saves remain | Undo restores Thursday's positions and requires review; copying into next week leaves its Thursday normal; normal cancellation restores positions without assigning people |
| 6. Staff output | Published snapshots include reviewed dated labels and source revisions plus exact times. Staff phone/desktop and print show closure/early-close labels; all-closed weeks can publish zero assignments | Staff output shows Thanksgiving closure and 7 PM closing alongside 7:30 PM employee finish; printed PDF retained; real D1/KV and browser exercise all seven explicit closures |

## State, compatibility and recovery

- Normal weekly templates and staff/availability/request records remain separate from hours. Review records store configuration, not shared assignment drafts or employee identities.
- A shared event save followed by uncertain review failure leaves the board unchanged. The browser verifies a retry reuses operation identity and both records stay at revision 1. Receipt replay, concurrent edits and append-only history are tested against real disposable D1.
- Conflict recovery preserves entered labels/choices, reloads the current source, then requires a deliberate save. An untouched preview does not introduce an extra unsaved-work warning; edited, saving and uncertain forms remain protected.
- Native dialogs wait for actual staff/rules, including links to another station's exact week/date. A delayed-rule test verifies the editor stays closed and controls disabled until rules arrive. Failed rule reads cannot open an editor over fallback rules.
- Backend and UI kitchen permissions were preserved. The browser verifies CR3 Kitchen's Hours editor stays locked until the existing staff editor is unlocked; the existing backend still recognizes manager/staff credentials as before.
- Generation, repair, manual validation, hour totals, printing and assistant validation share the effective slots. Event/review revisions invalidate stale contexts. The assistant domain test actually generates a Thursday closure and Wednesday cleanup layout: 12 positions, 74.5 total hours. Ordinary weeks retain the prior assistant request shape; dated weeks require the compatible assistant.
- Staff continue seeing the prior snapshot until Publish succeeds. The snapshot foundation's failed-publish/retry browser regression still passes. Existing public/encrypted routes, assignment indexes and legacy report mapping keys are retained.
- A durable KV activation marker is set before accepting hours mutations. Losing D1 after activation returns unknown/unavailable and blocks even a client omitting all hours metadata. The real Worker test verifies the existing publication remains unchanged. A server that has never activated the service explicitly reports it unconfigured; the new controls are unavailable while legacy workflows remain usable.

## Gates

| Gate | State | Evidence / remaining work |
| --- | --- | --- |
| Items 1–6 local implementation | Pass | All requested outcomes mapped above |
| Domain and service correctness | Pass | Full suite plus final targeted scheduler, assistant and hours-Worker reruns |
| Local rendered/keyboard/language/print checks | Pass | Synthetic desktop/phone, all layouts, English/Spanish, enlarged dialog, reflow, focus and printed output |
| Representative manager usability | Pending | No claim that managers completed an uncoached real task or that this is empirically the most intuitive design |
| Physical phone touch / software keyboard | Pending | Browser emulation is not physical-device evidence |
| Owner review | Pending | This is the completed six-item handoff |
| Backend/assistant activation and compatible release | Pending | Binding/schema/target versions not verified live; no deployment authorized or performed |
| Live holiday configuration | Not performed | User's actual closure/early-close dates and closing time were not inferred or entered |

## Checks actually run

Logs are in [checks](../evidence/special-hours/checks/). Browser APIs intercept all external requests except the explicitly permitted loopback Node assistant in its dedicated suite.

| Exact command / suite | Observed result |
| --- | --- |
| `npm run check:full` | Passed: 412 test executions across 12 suites; zero failures. Includes types, tracker, scheduler/cash/session/recovery/imports/forms/requests/assistant, data, import Worker, request Worker and the new hours Worker suite |
| `npm run scheduler:test` | Final targeted rerun: 238 passed, including the final Worker database-loss protection |
| `npm run scheduler:hours:worker:test` | Final targeted rerun: 4 passed against disposable real D1/KV, including the missing-binding bypass case |
| `npm run agent:test` | Final targeted rerun: 14 passed, including actual closure/cleanup generation and hours-context invalidation |
| `node --import jiti/register --test --test-reporter=spec src/lib/internal-tools/i18n/i18n.test.ts` | 3 passed; dictionary keys/placeholders match |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790 npm run build` | Passed; static export and route mirrors generated with local API targets |
| `npm exec tsc -- --noEmit` | Passed; generated-only `next-env.d.ts` drift restored |
| `npm run worker:build` | Passed; Wrangler dry-run and generated `worker/dashboard.js` mirror; no deployment |
| `npm run seo:check` | Passed |
| `scripts/test-special-hours.py --url http://127.0.0.1:3064` | Passed on final frontend: items 1–6, all layouts, uncertain retry, conflict/reload, delayed deep link, kitchen lock, Undo, cancellation, copying, independent publication, closed week, unavailable service, English/Spanish, keyboard/focus, 320px reflow, enlarged phone dialog and print |
| `scripts/test-scheduler-views.py --url http://127.0.0.1:3064` | Passed; Current/Classic and existing editor/publish behavior |
| `scripts/test-scheduler-planning.py --url http://127.0.0.1:3064` | Passed; explicitly reports no production API access |
| `scripts/test-schedule-requests.py --url http://127.0.0.1:3064` | Passed; existing requests, original provenance, conflicts/retries and bilingual phone behavior |
| `scripts/test-scheduling-agent.py` | Passed with a real local Node/SQLite service; restart/review recovery, stale draft checks, apply/Undo, no auto-publish and desktop/375px phone |
| `scripts/test-schedule-snapshots.py --url http://127.0.0.1:3064` | Passed; saved-but-unpublished time change, failed publish/retry and staff snapshot desktop/phone/print |
| `python3 scripts/check-overhaul-tracker.py`; `git diff --check` | Passed; wider task metadata/milestones retained |

Browser commands use `/tmp/cr-scheduler-checks/bin/python`, Playwright 1.65.0, Chromium 1254 and `LD_LIBRARY_PATH=/home/unusn/.local/chromium-libs/root/usr/lib/x86_64-linux-gnu`. No application dependency was added. Node is 22.22.0. The full suite was followed by focused reruns for the final loading, assistant-compatibility and database-loss safeguards; the last UI refinements were dates, sizing and unsaved-form handling.

An initial browser run caught the empty-week startup date conversion; the date controls now wait for a real week and the existing startup/layout suites pass. The delayed-link regression also verifies that no staffing preview opens against not-yet-loaded rules. No failing scenario is being carried forward.

## Rendered evidence

All output is synthetic CR2/CR3 data for illustrative November 22–28, 2026. The examples use November 26 closed and November 25 early closing; these are test fixtures, not confirmed restaurant policy.

- [Closed-day preview with assigned person and Keep](../evidence/special-hours/screens/closed-preview-desktop.png)
- [Early-close preview with cleanup finish](../evidence/special-hours/screens/early-preview-cleanup.png)
- [Planning board and independent station status](../evidence/special-hours/screens/manager-hours-status.png)
- [Current layout](../evidence/special-hours/screens/new-hours.png) and [Classic layout](../evidence/special-hours/screens/classic-hours.png)
- [Spanish phone dialog with enlarged text](../evidence/special-hours/screens/spanish-phone-preview.png)
- [Staff desktop](../evidence/special-hours/screens/staff-hours-desktop.png) and [staff phone](../evidence/special-hours/screens/staff-hours-phone.png)
- [Printed staff schedule](../evidence/special-hours/screens/staff-special-hours.pdf)

Dialog, station/board, Spanish phone and staff phone captures were visually inspected. Print text/labels are asserted under print media before PDF export. The existing public-site shell/footer remains; this delivery does not implement the broader staff-shell redesign or public operating-hours exceptions.

## Release and rollback

- No commit, merge, deploy, remote migration, raw upload, staff notification or live schedule change was performed. The requested deliverable is complete locally.
- Activate a verified Worker with the existing core/atomic-history D1 schema and correct store bindings; deploy compatible frontend readers/writers. The checked-in production config still contains placeholder KV setup and does not demonstrate D1 activation. Update the optional Node assistant for dated-hours contexts if it is enabled.
- Preserve D1 hours/review records, immutable mutation receipts/history, KV activation markers, published snapshots and legacy capture records. Roll back with compatible readers/writers; reverting to older strict snapshot readers or a Worker ignoring hours would lose the new safeguards.
- Event/review mutations use existing atomic D1 revisions. Golden publication remains KV with its existing concurrency/consistency limits: a check spanning D1 and KV is not an atomic cross-store transaction. A later event edit marks an older publication as needing review; it does not silently rewrite staff hours.
- Do not infer exceptions from historical manually edited templates, merge employee identities, change recurring availability, or erase existing drafts/records to resolve a review conflict.
- Remaining work outside items 1–6: representative manager walkthrough, physical-device review, coordinated authorized deployment/live checks, and the actual holiday dates/time before real entry.
