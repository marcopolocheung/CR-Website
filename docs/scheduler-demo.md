# Scheduler Demo Architecture

The demo at `/scheduler-demo` is a static Next.js App Router page with the correctness-critical scheduling logic kept outside presentation code.

## Modules

- `src/lib/scheduler/types.ts`: domain types for employees, availability, staffing slots, assignments, diagnostics, and validation violations.
- `src/lib/scheduler/data.ts`: structured seed data normalized from `scheduler.md`.
- `src/lib/scheduler/solver.ts`: deterministic backtracking scheduler with preflight diagnostics and stable candidate ordering.
- `src/lib/scheduler/validator.ts`: independent hard-constraint validator used for generated and manually edited schedules.
- `src/lib/scheduler/week-visibility.ts`: per-week on/off status, month strip helpers (`weeksForMonth`, `shiftMonth`), and v1→v2 draft migration. Off weeks are hidden from staff; they are never deleted.
- `src/components/scheduler/SchedulerDemo.tsx`: manager-facing demo UI for generating, locking, manually reassigning, validating, printing, editing basic employee constraints, and adding new employees. The week board is a 7-column fluid grid (`lg:grid-cols-7`, no `min-w`, full-width containers) with a month strip, per-week on/off toggles, and copy-prior-week.

## Data Model

Employees are independent from staffing slots. Each employee has roles, recurring weekly availability, optional overrides, max day/shift limits, double-shift policy, preferences, incompatibilities, and active state.

Staffing slots are concrete required positions expanded from a weekly template. A slot has day, AM/PM period, role, label, start time, end time, and required status. Cashier 1 and Cashier 2 are labels over the same `cashier` role in the demo seed data. Weekday PM server slots start at 5:00 PM in this demo so Javier and Serenity's stated weekday availability can be represented without relaxing the validator.

## Implemented Hard Constraints

- Required slots must be assigned.
- Employees must be active.
- Employees must be qualified for the slot role.
- Slot times must fit inside employee availability.
- One employee cannot hold overlapping slots.
- Max days and max shifts are enforced.
- Employees who prohibit doubles cannot work AM and PM on the same day.
- Incompatible employee pairs cannot work the same day and period.
- Locked assignments are applied before regeneration and must remain fixed.
- Generated schedules must pass the independent validator.

## Objective

This demo does not yet use OR-Tools CP-SAT. It uses deterministic candidate ordering that prefers fewer assigned days, fewer assigned hours, lower max-day pressure, avoiding doubles, and honoring preference weights when present. Ties fall back to stable employee names and slot ordering for reproducibility.

The production version should replace `solver.ts` with an OR-Tools CP-SAT model while keeping `types.ts`, seed data, and `validator.ts` as the contract around it.

## Infeasibility

Before search, the scheduler runs deterministic preflight checks for missing role/time candidates and insufficient shift or role capacity. If search still cannot find a valid schedule, it returns `INFEASIBLE` with a search diagnostic instead of relaxing hard constraints.

The UI has a "Show gap example" button that deactivates lead/manager employees so the manager can see concrete diagnostics such as missing shift-lead coverage. The readiness panel can open the add-employee form with the missing role and shift availability preselected.

## Adding Rules

Add new structured fields to `types.ts`, enforce generation behavior in `solver.ts`, and add a separate validator check in `validator.ts`. Then add a regression case in `src/lib/scheduler/scheduler.test.ts` so manual schedules cannot bypass the rule.

## Sharing

The demo edits one persistent golden schedule in the free Cloudflare Worker
+ KV (`worker/`). Each week is stored in plaintext under
`golden:YYYY-MM-DD` with `visible` (the week on/off switch), a
`templateHash` guard against shift-layout drift, and `rev` for optimistic
concurrency (`409 conflict` means someone else saved first — saving again
overwrites with your copy, and the first save of a week uses `baseRev: 0`).

Reads are public: `/schedule` lists visible weeks for a month and needs no
link or code. The viewer never polls — it revalidates with a cheap month-rev
check when the tab becomes visible, regains focus, or reconnects, and swaps
content only when a save actually bumped the rev. A save from the demo also
pings open `/schedule` tabs on the same device over a BroadcastChannel, so a
manager previewing the page sees it update immediately. Writes need the manager token (`SCHEDULE_WRITE_TOKEN`
Worker secret), typed into the publish panel when saving; it lives in the
tab only. Nothing schedule-related persists in `localStorage` anymore —
the Worker is the source of truth. Legacy `/api/weeks` link blobs are
still served so old staff links open, but the UI no longer makes them.

## Commands

- Run the app: `npm run dev`, then open `/scheduler-demo`.
- Run scheduler tests: `npm run scheduler:test`.
- Validate the static site: `npm run build`.
- Deploy the store: paste `worker/dashboard.js` (plain JavaScript mirror of
  `worker/src/index.ts` — the dashboard editor rejects the TypeScript source)
  into the `chinarose-schedule-api` Worker (KV binding `SCHEDULES`), then open
  `/api/health` to verify. Keep the two files in sync when the API changes.
