# China Rose internal dashboard — design docs

This folder covers how the internal tools (cash, bookkeeping, inventory, scheduler, forms, write-ups) **should** look and behave as one product, how far the code is from that today, and what to change first.

The audience is two groups:

- **Whoever builds it** (you, or an AI agent working in this repo). Read everything.
- **Managers and owners** deciding what to build. Read `improvements.md` and the module page you care about.

## Files

| File | What it answers |
|---|---|
| [research.md](research.md) | What good operations dashboards and back-office tools do, with sources. What the restaurant SaaS vendors (Toast, 7shifts, MarginEdge, Homebase, Restaurant365) converge on. |
| [design-language.md](design-language.md) | **The one design language.** Principles, words, colors, type, sizes, components, states, and patterns every internal page must use. |
| [platform.md](platform.md) | The shell around every tool: navigation, the home page, sign-in, saving, data and retention, phones vs desktops, printing. |
| [modules/home.md](modules/home.md) | The "Today" home screen: what a manager sees first. |
| [modules/cash.md](modules/cash.md) | Cash out (drawer counts) and the cash dashboard. |
| [modules/bookkeeping.md](modules/bookkeeping.md) | Daily sales report and employee hours converters. |
| [modules/inventory.md](modules/inventory.md) | Supply counts, order list, item list editing. |
| [modules/scheduler.md](modules/scheduler.md) | Building and publishing the weekly schedule, and what staff see. |
| [modules/forms.md](modules/forms.md) | Blank forms, write-ups, and which paper forms should become screens. |
| [improvements.md](improvements.md) | **Ranked list of suggested changes, with the why for each.** |
| [security.md](security.md) | Is the internal site really protected? What a stranger can and can't get, checked live, and the fixes. |
| [audit.md](audit.md) | Snapshot of the code as of 2026-10-20: what exists, inconsistencies, risks. |
| [open-questions.md](open-questions.md) | Decisions only the owner can make. |

There is also a project skill at `.claude/skills/internal-dashboard/SKILL.md`. It loads the design language whenever someone asks Claude Code to build or change an internal page, so new work matches without anyone re-reading these docs.

## The short version

1. **One door, one code.** Today each tool asks for the manager code separately (five gates). Unlock once per visit, keep the code in memory for every internal page, and lock after a short idle period.
2. **One shell.** Every internal page gets the same header: store switcher, links to every tool, "Lock" button. The scheduler currently lives inside the public website shell, with a different look.
3. **Home answers "what needs me today?"** Lead with a checklist of what's done and not done (cash out saved? inventory counted? schedule published for next week? any short drawers?), not with charts.
4. **Red means a problem.** Main buttons today are red on most internal pages, which reads as "danger" and drowns out real problems. Main buttons go dark; red is only for problems and deleting.
5. **Bigger, plainer, fewer.** 16px text in fields, 44px tap targets, one main action per screen, plain words ("Save count", not "Persist").
6. **Keep records long enough.** Cash-out days are deleted after 31 days. Bookkeeping records should be kept for years (IRS: at least 4 years for employment tax records). Stretch the retention or export monthly.
7. **Paper parity first, then go further.** The screens mirror the paper sheets, so staff recognize them. That's correct. The next step is doing what paper can't: warn on outliers, pre-fill from the last count, send the order list to the supplier, flag overtime.

Research limits: general web search was blocked during this research, and several vendor and legal pages (7shifts, Toast, Texas Workforce Commission, U.S. Department of Labor) would not load. Claims that rest on those sources are marked **(verify)**. Everything else is cited.
