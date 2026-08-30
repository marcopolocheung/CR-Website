# Scheduler Demo Architecture

The demo at `/scheduler-demo` is a static Next.js App Router page with the correctness-critical scheduling logic kept outside presentation code.

## Modules

- `src/lib/scheduler/types.ts`: domain types for employees, availability, staffing slots, assignments, diagnostics, and validation violations.
- `src/lib/scheduler/data.ts`: structured seed data normalized from `scheduler.md`.
- `src/lib/scheduler/solver.ts`: deterministic backtracking scheduler with preflight diagnostics and stable candidate ordering.
- `src/lib/scheduler/validator.ts`: independent hard-constraint validator used for generated and manually edited schedules.
- `src/components/scheduler/SchedulerDemo.tsx`: manager-facing demo UI for generating, locking, manually reassigning, validating, printing, editing basic employee constraints, and adding new employees.

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

## Commands

- Run the app: `npm run dev`, then open `/scheduler-demo`.
- Run scheduler tests: `npm run scheduler:test`.
- Validate the static site: `npm run build`.
