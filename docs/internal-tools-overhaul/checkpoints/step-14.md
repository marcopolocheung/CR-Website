# Step 14 checkpoint: unified manager scheduling

## Scope and baseline

- **Step:** 14, Unify manager scheduling.
- **Date / owner:** November 27, 2026. Codex implemented most of it; it stopped at its usage limit before verification. Claude finished verification, fixed the defects listed below and wrote this record, at the owner's request.
- **Source:** branch `feat/overhaul-step-14-scheduling` in worktree `/home/unusn/CR-step14`, from main `410302d` (Step 13 merged in PR #203). The original checkout and its untracked work are untouched.
- **Approved contract:** [approved-plan.md](../evidence/step-14/approved-plan.md) (Codex's plan, approved in session).
- **Design:** Night shift bank v1.0, Layered paper, Patina teal, moving red navigation.
- **APIs:** static export built with loopback `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787` and `NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790`. Browser scripts intercept all API calls with synthetic fixtures; the agent script runs the real local Node agent service.

**What changed for managers:**
- Scheduling now lives inside the shared internal shell, under the same manager unlock, language controls, lock button and red navigation. The separate scheduler login and header are gone.
- `/internal/*` and `/scheduler-demo/*` share one route group and layout, `(order-shell)/(internal-tools)/`; public URLs are unchanged.
- One layout with three views: **Schedule**, **Staff & rules** and **Requests** (`#schedule`, `#staff`, `#requests`). The Current/Classic layout selector is removed; an old stored layout preference is ignored and kept.
- Each visited station stays mounted while hidden, so edits survive moving between views, weeks, stations, other tools and lock/unlock during the visit. Drafts are memory-only and labelled "Draft for this visit".
- Copy previous week, Build week, Adjust, Undo and Publish sit above the board. The contextual shift/fix panel, guided fixes, restore shift, generation report, hours per person and strategy/clear controls carry over from Classic.
- Crew editing on schedule-only stations still requires the separate staff password.
- The assistant stays optional and collapsed; applying a proposal changes only the draft.

No Worker route, schema, migration, device draft envelope or deployment was added.

## Gates

| Gate | State | Evidence or reason |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Plan items implemented; parity matrix below; 6 defects fixed during verification. |
| Local automated checks | pass | `npm run check:full`, type check, build, SEO and tracker all pass (see below). |
| Browser scenarios | pass, with 1 failure that predates Step 14 | 9 of 10 scripts pass. `test-internal-home-reports.py` passes its Step 14 block, then stops at the same failure `main` already has (see Known failures). |
| Visual and task review | pending owner | Screens in [evidence/step-14/screens](../evidence/step-14/screens/). Reviewer spot-checked desktop and phone Schedule. |
| Owner review before Step 14a/15 | pending | PR to be opened into main; stop without merging. |
| Backend/policy readiness | not applicable | No backend change; existing request/hours services keep their own activation gates. |
| Physical device, staff acceptance, live verification | pending | Browser emulation only. No deployment or production mutation. |

## Classic parity matrix

| Capability in Current/Classic | Unified layout |
| --- | --- |
| Make schedule / strategy selection | **Build week** plus strategy selector under More actions |
| Copy last week, Clear week (with confirm) | **Copy previous week**; Clear week with confirmation under More actions |
| Guided fixes ("Fix N of M", candidates, excluded reasons) | Fix panel beside the board (`#planning-fix`), candidates and excluded list |
| Restore one shift / restore everything | Restore shift in the shift panel; Restore everything under Changes since generation |
| Generation report banner | Generation report disclosure |
| Hours summary | Hours for each person disclosure; hours total on the board |
| Publish state badge | Status line "Draft for this visit…" plus status in the shell context line and the printout |
| Staff snapshots (save/restore) | Staff & rules → snapshots |
| Undo, Keep locks, required/optional spots, swaps, qualification checks | Board and shift panel (covered by views/planning scripts) |
| Print | Print button; active station/week only, English, hidden controllers excluded |
| Staff view link | "View staff schedule" (new tab, `noopener`) |
| Separate manager gate and header (`PlanningShell`) | Replaced by the shared shell and manager unlock (owner-approved test updates below) |
| "Getting started" onboarding banner | **Dropped on purpose.** First-run help text; the design bank avoids explanatory filler. Empty-staff state still shows an Add employees action. |

## Defects found and fixed during verification

Codex's implementation stopped before any browser run. These failures surfaced; each was fixed in source without editing a test:

1. **Tab keyboard focus.** `changeView` focused the panel a frame after every view change, undoing arrow-key focus on the tabs and the focus targets of the "open settings" and "Back to schedule" helpers. It now focuses the panel only for the board's request shortcut (`SchedulerDemo.tsx`).
2. **Request form stuck "unsaved".** Codex counted typed preparer/reviewer names and a never-cleared `touched` flag as unsaved work. After a manager typed a name to approve, the approval never reached the draft, **Build week** stayed disabled and the leave warning stayed on. Restored the original definition: person, reason, review notes or pending save (`RequestsPanel.tsx`).
3. **Tool switching blocked during any save.** An added rule blocked every in-shell navigation while any work was busy, breaking the Step 04 contract (switch tools during a cash save; the late response is still handled). Removed; leaving the tools during a save is still blocked (`NavigationProtection.tsx`).
4. **Reloading requests blocked locking.** The request panel reported reloads as mutations. It now reports only writes (`RequestsPanel.tsx`).
5. **Publish blocker lost the day.** The localized qualification list printed seven identical "Sample Employee · Morning coverage" rows. English shows the validator's day-specific sentence again; Spanish adds day and period (`PublishPanel.tsx`).
6. **Missing spaces from string extraction.** "Review7changed spots", "42scheduled hours ·…", "2 shift s" and "( 3/5)" fixed (`SchedulingAgent.tsx`, `SchedulePanels.tsx`, `StaffWorkspace.tsx`).

Also reverted Codex's last-minute `expanded` prop that opened Requests by default. Both request scripts, including Codex's new one, expect it collapsed, and the guide asks for "a quieter request view"; the board shortcut still opens it with the person and date filled in.

## Test changes

- **By Codex (reviewed):** file-path globs for the new route group in four shared scripts; selector updates in `test-scheduler-views.py`, `test-scheduler-planning.py`, `test-schedule-requests.py` and `test-scheduling-agent.py` for the unified layout; new `test-scheduler-workspace.py`. Audit: no test function or recorded scenario was removed. Of 69 removed assertions in the views script, the Classic-only ones (layout switch, chips, "Make schedule") were replaced, and the behavioral ones (tab keyboard, unsaved markers, warnings blocking publish, publish confirmation, no 375px overflow, no console errors) are kept or have equivalents. Panel focus is covered in the planning script.
- **Classic selectors (guide-permitted):** `test-schedule-snapshots.py`, where "Make schedule" became Build week, the "Employee settings" tab became Staff & rules, and one Close is scoped with `.first` because the board now also has an Edit person Close. All publication/snapshot assertions unchanged.
- **Owner-approved (Nov 27):** four blocks that asserted the old separate scheduler (its own manager-code page, "Internal tools" return link, leave dialog):
  - `test-internal-shell.py`: the Schedule round trip, plus the station/keyboard-entry block.
  - `test-internal-session.py`: scheduler boundary.
  - `test-internal-home-reports.py`: the Schedule launcher.

  Each now asserts the unified behavior: no second manager gate, no departure dialog, mounted work and the original `File` object survive the round trip, public staff URLs stay outside the shell. The separate crew staff password remains asserted in `test-scheduler-views.py` ("Shift rules (locked)" until it is entered).

## Checks actually run

Logs are in [evidence/step-14/checks](../evidence/step-14/checks/).

| Command | Result |
| --- | --- |
| `npm run check:full` ([check-full.txt](../evidence/step-14/checks/check-full.txt)) | pass after all fixes: type check, tracker, and 12 suites with 456 tests (scheduler 259, cash/inventory 54, session 7, recovery 7, imports 57, forms 29, requests 5, agent 14, data 10, import Worker 6, request Worker 4, hours Worker 4) |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790 NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | pass |
| `npm run seo:check` | pass |
| `python3 scripts/check-overhaul-tracker.py` | pass |
| `test-scheduler-workspace.py` | pass: routes/hashes/Sunday links, build/copy history, retention across views/tools/stations/lock, late 401 cannot revoke reauthentication, 4 station PDFs from Spanish configuration, 12 screenshots |
| `test-scheduler-views.py`, `test-scheduler-planning.py`, `test-schedule-requests.py`, `test-schedule-snapshots.py` | pass |
| `test-scheduling-agent.py` (real local agent service) | pass: proposal, restart/review recovery, stale-draft protection, apply/undo, draft-only writes, 375px |
| `test-internal-shell.py` | pass, 11 scenarios |
| `test-internal-session.py` | pass, 14 scenarios |
| `test-internal-primitives.py` | pass, 11 scenarios |
| `test-internal-home-reports.py` | Step 14 Schedule-launcher block passes; then fails at line 158 on a failure `main` already has (below) |

Browser runner: `/tmp/cr-step13-venv/bin/python` with `LD_LIBRARY_PATH=/tmp/cr-step13-browser-libs/root/usr/lib/x86_64-linux-gnu`, static export served by `python3 scripts/overhaul-baseline/serve.py --port 3052`. All runs had zero external requests.

- **Screens:** desktop, tablet, phone and 320px enlarged Spanish for all three views. Reviewer inspected Schedule at 1440px and 390px.
- **Keyboard / reduced motion:** tab arrow/Home/End, shift-panel focus and reduced-motion media checked by scripts. No physical touch or software-keyboard evidence.
- **Print:** four English station PDFs checked against independent employee/day values; hidden controllers and draft text excluded.

## Recovery and remaining work

- **Rollback:** revert the branch's frontend commits. Station IDs, assignments, links, published records and request/hours data are unchanged, and the old layout preference key is left in place. No storage is cleared.
- **Known failure (predates Step 14):** `test-internal-home-reports.py` line 158 finds two "Unlock" buttons on Reports, the manager-code form and the "Sales from Toast" sales-code form. That region was added in `1ac35cf` (Nov 14), after the script last changed (`00a509f`, Nov 13), so `main` has the same failure; Step 14 does not touch Reports. Everything after line 158 in that script went unverified this run.
- **Cosmetic, not fixed:** on phones, employee names wrap mid-word in narrow board cells, and the previous/next week arrows sit together beside Set hours.
- **Not in scope:** staff-visible publication comparison (Step 15), staff schedule view (Step 16), device autosave of schedule drafts.
- **Briefs:** SCH-03, SCH-07 and SCH-08 get Step 14 notes; their statuses are unchanged, because SCH-07 also covers the staff view and SCH-08 needs public-read and encrypted-link evidence.
- **Next:** owner review and merge. Then Step 14a (company Files library, planned in PR #204) or Step 15. Step 15 has not begun.
