# Scheduling Ambiguities

The source rules in `scheduler.md` are not fully normalized business policy. These points need manager confirmation before a production solver should treat them as hard constraints.

- Does "can only work 4 days" mean exactly four scheduled days or at most four scheduled days?
- Are employees without an explicit "can't work double shifts" note allowed to work doubles?
- What exact roles make up the normal four-person PM shift?
- Which role is the "third person" arriving at noon Sunday?
- Which role is the "fourth person" arriving at noon Thursday and Friday?
- Do Desiree, Shorty, and Dolores have weekly day or hour limits?
- Is Cashier 1 versus Cashier 2 a distinct qualification, or are they two staffing positions that any cashier-qualified employee may fill?
- Does "Friday manager is 5th person" mean Friday PM has the normal four-person role composition plus an additional manager beginning at 3:00 PM?
- Does Javier and Serenity's Monday-Friday 5:00 PM availability mean they cannot work server PM slots that begin at 4:00 PM?
- If Javier and Serenity are intended to cover weekday PM server shifts, should the server staffing slot start at 5:00 PM on weekdays or should another employee cover 4:00 PM-5:00 PM?
- Should manager and shift-lead be separate qualifications, or can a manager fill any shift-lead slot?
- Are the AM and PM end times fixed for every role, or can some employees leave earlier than the period end?
- Are employee incompatibilities shift-specific, day-specific, or global for any overlapping work time?

## Demo Assumptions

The `/scheduler-demo` route uses explicit seed assumptions so it can produce a runnable schedule without hiding unresolved policy decisions:

- "Can only work 4 days" is treated as at most four days.
- Employees without an explicit no-doubles restriction are marked double-eligible.
- Cashier 1 and Cashier 2 use a shared `cashier` qualification.
- PM shifts are modeled as one lead, one server, and two cashiers.
- Friday PM adds a manager slot from 3:00 PM to 11:00 PM.
- Weekday PM server slots start at 5:00 PM so Javier and Serenity can satisfy their stated weekday availability.
- The Sunday noon third-person and Thursday/Friday noon fourth-person notes remain unresolved and are not encoded as extra slots.
- Desiree, Shorty, and Dolores use seven max days in demo data because the source text does not provide confirmed limits.

scheduler-demo > updates schedule page
cr2dr

monday to wednesday, hire new person, so that person can only works morning

## CR03 Kitchen (sheet `CR03_K`) Assumptions

The CR03 Kitchen shift rules are fixed in code (`seedKitchenTemplateCR03`) and its crew ships as a built-in seed (`seedKitchenEmployeesCR03`). The crew can be edited from the scheduler behind the staff password (`/api/staff`) — roles, availability, add and remove — and saved for every week, with the last save undoable. The sheet lists post qualifications and per-person hours but not required headcount, so these points still need manager confirmation:

- **Required cover per shift** is now: lunch (AM) = Cook + M/V Prep (early/late); dinner (PM) = Cook + Line Cook + F.R. Cook + Dishwasher. The sheet lists who can work each post but not how many of each a shift needs, so this is a chosen default. Shadow, Meat Prep, and the extra lunch F.R. Cook / Dishwasher spots are optional. Adjust the counts if the kitchen needs different coverage.
- **Dishwasher (PM) starts at 5pm**, not 4pm, so Jayden and Cris (whose sheet hours start at 5pm) can take it. Confirm if dinner dishwasher should start at 4pm.
- **"Any shift"** people (Jay, Jeremy, Robert, Jorge, Jeremiah) are modeled as available the whole day (9:00-23:00).
- **Jeffery starts at 6:00am**, before the sheet's 9:00am AM window; his hours are encoded as written (Sun 8:00-1:30, Mon & Wed-Sat 6:00-1:30, Tue off).
- **Alfredo** works Mon-Fri 10:15am-4pm only; he can fill the lunch F.R. Cook spot (10:15am-4pm) but not the 9:00am required lunch spots.
- **Stef** "one day off only, any 6 days" → max 6 days; "one day double shift only" → `maxDoublesPerWeek: 1`. His "main post: shadow" is not modeled — the model has no per-person role preference, so shadow is just an optional PM spot.
- **Jeremy** "when Stef is off, he is the shadow" is conditional and is not encoded as a rule; shadow ships as an optional PM spot either of them can take. In practice Stef takes Shadow most days and Jeremy covers it on Stef's off day.
- **Meat Prep is implied by M/V Prep**: a Meat / Veggie Prep worker can cover Meat Prep, but a meat-prep-only worker (Cris) cannot cover M/V Prep. Cris takes Meat Prep on the days he is not already on the required Dishwasher spot.
- **Eddie** "AM shift only" is encoded as the lunch window (9am-4pm). He is not scheduled into the dinner shift.
- **Optional spots** are auto-filled when someone valid is free; a spot nobody can cover stays open (yellow) and does not block the week.
- The sheet's AM (9-4) and PM (4-11) windows drive the required lunch/dinner crews; the lunch Cook slot is 9am-4pm (Sun 10:15am-4pm) and the dinner Cook slot is 4pm-11pm.
- Sheet typo: "Monday to Saturday PM : 4 am to 11 pm" is read as 4pm-11pm.
- No employee incompatibilities are stated for the CR03 crew.
- **Publishing still needs the manager write token.** If CR3 users should publish without it, that needs a separate station-scoped token. 