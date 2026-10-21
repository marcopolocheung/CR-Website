# Scheduler

Manager side: `/scheduler-demo/[station]`, `src/components/scheduler/*`, `src/lib/scheduler/*`. Staff side: `/schedule/[station]`, `src/components/schedule/ScheduleViewer.tsx`. Architecture: `docs/scheduler-demo.md`. Rules source: `scheduler.md`, `docs/26-00919 CR SCHEDULER RULES.xlsx`, open questions in `AMBIGUITIES.md`.

## Job

Each week, for each station (CR3 dining room, CR3 kitchen, CR2 kitchen, CR2 dining room): put the right people in every required spot, within each person's availability and limits, fairly; publish it so staff can see it; handle changes (call-outs, time off, swaps).

## What exists. This is the most mature module.

- **Deterministic solver + independent validator** (hard rules: qualified, available, no overlaps, max days/shifts, doubles policy and caps, incompatibilities, suspensions, locked picks). Explains infeasibility with diagnostics and a guided fix ("Fix next problem"). Strategies (balanced, fair hours). Priority ranking.
- Week board (7 columns), month strip, copy prior week, manual moves with validation, Undo (Ctrl+Z), print.
- Publish states with clear badges: **Live / Unpublished changes / Hidden / Not published**. Off weeks hidden, never deleted.
- Staff editor (roles, availability presets like "Midday 12–7", overrides, suspensions, priority, new hire) and rules editor (per-shift spots, times, optional spots).
- Public staff viewer by month/week, "only me" filter remembered on the device, printable.
- Optimistic concurrency everywhere; `beforeunload` guard; one Save.
- Plain-language copy has already been worked on ("red only for problems, plain words": commit 57f15fc).

## Gaps (against 7shifts/Homebase-class tools)

| Gap | Weight |
|---|---|
| Lives in the **public** site shell (public nav/footer, GA tracking), a different visual style from other internal tools, and a separate code gate | High: it's the biggest "two products" seam |
| **No hours or labor cost while building**: hours per person exist ("Hours for each person" disclosure) but no weekly total, no overtime (>40h) warning, no labor $ | High: overtime is the costly mistake |
| **Availability and time off are typed by the manager** from texts and conversations | High: biggest time sink, and the source of the "can't work Thursday" free text in `scheduler.md` |
| No notification on publish: staff must remember to check | Medium |
| No shift swap / drop / pickup flow | Medium: happens by text today |
| Station = URL slug; no "all stations this week" view for the GM | Medium |
| No sales/forecast link (more staff on busy days) | Low at two stores; template already encodes busy days |
| Solver is backtracking, not CP-SAT (`prompt.md` asks for OR-Tools) | Low: deterministic, validated, fast at this size. Only revisit if a station grows past ~30 people or rules get soft-weighted heavily |

## Ideal

### Manager: build and publish

1. **`/internal/schedule`**: station cards for the week: "CR3 Dining · ✓ Live", "CR3 Kitchen · ! Unpublished changes", "CR2 Kitchen · ✕ 2 spots empty". Same states as the badges today, one screen. Tap → that station's board.
2. **Board** (as today), plus a **footer strip that's always visible**: "Total 312 h · Est. labor $4,680 · ⚠ 1 person over 40 h (Sam 42.5 h)". Requires an hourly rate per employee (optional field; hide $ if unset). Overtime is computed from assignments already in hand.
3. **Availability inbox** (needs employee identity, see below): requests from staff appear as cards ("Ana: off Sat Oct 25 (family)", [Approve] [Decline]). Approving writes an `availabilityOverride`, an existing field. The solver honors it without any change.
4. **Publish** asks once, naming the outcome: "Publish week of Oct 26 to staff? 14 people will see it." Then: "✓ Live. [Copy link for group chat]". The copy-link step covers the notification gap with zero backend: most restaurant crews have a group text.

### Staff: see, request, swap

1. `/schedule/[station]` stays public and read-only (current). Add a **"My shifts" calendar file** (`.ics` link per person) so shifts show up in their phone calendar. Generated client-side from the published week; no backend.
2. **Requests (phase 2):** a simple form on the staff viewer: name (picked from the roster) + a 4-digit staff PIN → "I can't work [date] [AM/PM/all day] because [optional]" → goes to the manager inbox. Swap: "Give away my shift" → manager approves who takes it. The validator checks the swap before approval, so a swap can never break a rule.
3. Staff PINs are separate from the manager code and can only submit requests, never edit the schedule.

### Rules and staff (admin)

- Keep the editors, behind "Staff" and "Rules" tabs (current).
- Resolve the open questions in `AMBIGUITIES.md` with the owner and delete the "demo assumptions". The demo label (`scheduler-demo`) should go once they're settled: rename the route to `/internal/schedule` and keep `/scheduler-demo` as a redirect.

## Why

- **One shell, one gate**: every other improvement is weaker while the scheduler feels like a different site.
- **Hours and labor while building** is the headline feature of every restaurant scheduling product: the decision happens on the board, so the cost should be on the board.
- **Employee-submitted availability** moves data entry to the person who knows the answer, and the existing override model means the solver needs no changes.
- **Copy link + calendar file** solves "staff didn't see the schedule" without an SMS or push service.

## Keep (don't rewrite)

- `solver.ts`, `validator.ts`, `types.ts`, the tests (869 lines), the week-visibility model, the conflict handling. They're sound, tested, and match the architecture doc. UI changes go around them.
