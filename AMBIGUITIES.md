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