# Step 14 — Unify manager scheduling

## Summary

Build one manager scheduling workspace using the existing bilingual Workspace layout and the approved Night shift design. Provide three focused views: **Schedule**, **Staff & rules**, and **Requests**.

Preserve working edits across views, weeks, stations, other internal tools, and lock/unlock during the visit. Keep drafts memory-only, with warnings before reload or leaving the tools.

## Workspace and navigation

- Integrate scheduling into the shared internal shell, language controls, manager session, lock behavior, and moving red navigation. Remove the separate scheduler shell and duplicate login/language controls.
- Place internal tools and scheduler routes beneath one persistent provider/layout boundary without changing their public URLs. Keep the scheduler landing page as the four-station picker.
- Extend `WorkspaceHost` to retain one controller per visited station. Keep inactive controllers mounted but hidden and inert; only the active controller handles keyboard shortcuts, focus, and printing.
- Use `#schedule`, `#staff`, and `#requests`, defaulting absent/unknown hashes to Schedule. Support direct links and Back/Forward without losing edits.
- Preserve extensionless, trailing-slash and `.html` routes, valid Sunday `?week=` links, and `hoursDate` entry points. Week navigation updates the URL’s week context; consumed hours-editor parameters must not reopen an editor unexpectedly.
- Show station/week and truthful draft/publication status once in stable context. Local view changes retain selected shifts, filters, configuration edits, and request entry.

## Editing, access, and compatibility

- Refine `PlanningWorkspace` as the sole layout. Put **Copy previous week**, **Build week**, **Undo**, and explicit publication access above the board. Keep strategy, resets, month visibility, and diagnostics in secondary controls.
- Keep the contextual shift/fix panel. Preserve keyboard and tap/select assignment, optional dragging, moves/swaps, both employees’ qualification checks, required/optional positions, Keep locks, automatic adjustment, exclusions, and undo.
- Before removing Current/Classic rendering and selectors, record a capability matrix and carry missing behavior into the unified layout: guided fixes and warning handling, shift restoration, generation results, hours summaries, staff snapshots, and existing recovery actions. Old layout preferences become inert; do not clear unrelated storage.
- Keep Staff & rules separate from routine planning. Preserve recurring availability, employee limits, suspension, custom roles, weekly roster/rule scope, and CR3 Kitchen’s shared crew plus separate staff-password permission.
- Give Requests its own retained view. Board shortcuts open it with the selected person/date. Preserve existing approval and adjustment policy, uncertain-write recovery, and unavailable-service states. Approval and adjustment never publish a schedule.
- Keep the assistant optional and collapsed. Preserve proposal validation, context checks, undo, and existing run pointers; applying a proposal changes only the draft.
- Translate remaining visible controls, errors, confirmations, and statuses. Preserve names, canonical values, and stored business data.

Use `SchedulerDemo` as the retained station controller. Replace its standalone leave prompts with shared navigation protection, including unfinished employee, request, and hours forms. Label unsaved schedules as **Draft for this visit**, never device-saved.

Locking hides private content and retains working state in memory while clearing manager and staff credentials. Reauthentication must retain dirty weeks rather than hydrate server data over them. Guard asynchronous work by session generation, station/week, and request identity; stale responses cannot overwrite newer work or revoke a newer unlock. Cancel obsolete generation/proposal work and prevent overlapping writes or target changes during mutations. Preserve partial acknowledgements and never automatically replay uncertain writes.

## Interfaces and verification

Keep existing API routes, payloads, revisions, station/employee/slot IDs, published records, and encrypted/public links unchanged. Add no Worker schema, migration, device draft envelope, or deployment. Preserve current publication/conflict behavior; staff-visible publication comparison remains Step 15.

Verify:

- All four stations; direct URLs/hashes; Back/Forward; language changes; retained edits across views, weeks, stations, tools, and lock/unlock.
- Build/copy strategies, manual placement and swaps, qualification failures, Keep, undo, required/optional gaps, guided fixes, staff/rules, dated requests, and special-hours workflows.
- Separate Kitchen staff permission, failed/expired access, delayed responses, repeated clicks, write conflicts, partial saves, uncertain results, and optional-service failures.
- Assistant disabled/configured flows; proposal application and request approval issue no publication request.
- Familiar English print output for only the active station/week, including when printing from another local view. Exclude hidden controllers and restore language/view afterward.
- Desktop, tablet, phone, 320px enlarged Spanish, keyboard/focus, reduced motion, bounded board scrolling, and PDFs against independent fixture values.

Run aggregate, scheduler, request, agent, dictionary/contracts, type, build, SEO, and tracker checks; relevant Worker suites when touched; scheduler/planning/request/assistant and shared shell/session/recovery browser suites. Replace obsolete layout assertions with equivalent behavior coverage. Use explicit loopback services and synthetic data; retain REA artifact/runtime evidence.

## Delivery and boundaries

Implement from fresh main in an isolated worktree on `feat/overhaul-step-14-scheduling`, preserving the original checkout and its untracked work.

Record the Step 14 checkpoint, parity matrix, actual test results, screenshots/PDFs, review scenarios, and rollback instructions. Reconcile Step 13’s merged status and affected scheduling briefs without marking Step 15, Step 16, physical-device, staff-acceptance, or live-service work complete.

Deliver one non-draft PR to main. Stop for review without merging, deploying, or beginning Step 15. Rollback must preserve records, links, existing storage, and compatible readers.
