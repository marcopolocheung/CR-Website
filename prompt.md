I want to replace an existing LLM-based restaurant employee scheduling workflow with a deterministic, auditable scheduling application.

The current workflow consists of a manager pasting employee availability, role qualifications, staffing requirements, and miscellaneous rules into ChatGPT and asking it to produce a weekly schedule. This is fragile because the LLM must simultaneously interpret ambiguous natural language, remember every constraint, perform the scheduling optimization, and verify its own answer.

The new system should treat employee scheduling as a constraint satisfaction / optimization problem rather than a text-generation problem.

## Primary goal

Build a small, production-quality restaurant scheduling application that:

1. stores employee qualifications and availability as structured data;
2. stores weekly staffing requirements as structured data;
3. generates a valid weekly schedule using a constraint solver;
4. distinguishes hard constraints from optimization preferences;
5. independently validates generated and manually edited schedules;
6. explains why a schedule cannot be generated when the constraints are infeasible;
7. gives a nontechnical restaurant manager an intuitive interface for maintaining employees and generating schedules.

Use Google OR-Tools CP-SAT for the scheduling engine unless repository or environment constraints provide a compelling reason not to.

Do NOT use an LLM to decide which employees should work particular shifts.

An LLM may eventually be used as an optional ingestion layer for converting natural-language availability into proposed structured records, but it must never be part of the correctness-critical scheduling path.

## Domain model

Model employees independently from shifts and staffing slots.

An employee should support at least:

* id
* name
* qualified roles
* recurring weekly availability
* date-specific availability overrides
* maximum days per week
* maximum shifts per week if applicable
* whether double shifts are allowed
* optional minimum/preferred number of days or hours
* optional shift preferences
* employee-to-employee incompatibilities
* active/inactive status

Model a staffing slot as a required position with:

* date/day of week
* AM/PM shift designation
* role
* start time
* end time
* required/optional status

Do not assume that every employee assigned to an AM or PM period has identical hours. In this restaurant, servers, managers, Cashier 1, Cashier 2, and special extra employees can have different start times.

Represent recurring staffing templates separately from a generated week's actual slots.

## Hard constraints

The solver must support at least:

* every required staffing slot must be filled;
* only employees qualified for a role can fill that role;
* assigned work must fall entirely inside employee availability;
* unavailable employees cannot be scheduled;
* an employee cannot occupy simultaneous staffing slots;
* employees with a maximum number of work days may not exceed it;
* employees prohibited from doubles may not work both AM and PM on the same date;
* employee-pair incompatibility constraints can prohibit two employees from appearing on the same shift;
* required manager/shift-lead positions must be filled by qualified employees;
* manually locked assignments must remain fixed during regeneration.

Do not silently relax hard constraints to obtain a schedule.

If no valid schedule exists, return an INFEASIBLE result rather than an invalid schedule.

## Soft constraints / optimization

Design the objective system so its weights are configurable.

Initial soft objectives should include:

* balance total days worked;
* balance total hours where reasonable;
* avoid double shifts even for employees who permit them;
* avoid PM-to-next-morning turnaround where possible;
* honor employee shift/day preferences;
* distribute undesirable/weekend shifts fairly;
* minimize changes to locked or previously published schedules when regenerating.

Hard constraints must always take precedence over soft objectives.

Use stable secondary objectives/tie-breaking so identical inputs produce reproducible schedules as much as practical.

## Independent validation

Implement a schedule validator separately from the solver model.

Given:

* employees;
* rules;
* staffing requirements;
* generated or manually edited schedule;

the validator should evaluate every hard constraint and return explicit violations.

A generated schedule is not considered successful until it passes this validator.

Create tests demonstrating that deliberately invalid schedules are caught.

## Infeasibility diagnostics

A restaurant manager should not receive only "no solution."

Implement useful diagnostics where practical.

Examples:

* "Friday PM requires two cashier-qualified employees but only one is available."
* "Dolores would need to work six days but her maximum is five."
* "Sunday AM requires a shift lead but no shift lead is available."

Start with deterministic preflight checks for obvious capacity/qualification/availability failures. If useful, investigate CP-SAT assumptions or another method for identifying conflicting groups of constraints, but do not let sophisticated diagnostics block the core scheduler.

## UX

The application is intended for a nontechnical restaurant manager.

Provide:

### Employee management

A clear employee list and editor for:

* roles;
* recurring availability;
* unavailable days;
* maximum work days;
* doubles;
* preferences;
* incompatibilities.

Avoid requiring users to edit JSON or natural-language prompts.

### Staffing requirements

Provide a weekly template editor where the manager can define required positions and start/end times for each day/shift.

### Weekly schedule

Display a Sun-Sat schedule grid organized by AM/PM and role.

Allow the manager to:

* generate a schedule;
* manually reassign employees;
* immediately see validation errors;
* lock assignments;
* regenerate everything except locked assignments;
* see hours/days assigned to each employee.

Include a printer-friendly/exportable view.

## Existing restaurant rules

Use the following current business rules as seed/test data, but DO NOT silently resolve ambiguous statements. Create an `AMBIGUITIES.md` file identifying assumptions/questions that require confirmation.

[PASTE THE RESTAURANT RULES HERE]

Examples of ambiguities that must be surfaced include:

* Does "can only work 4 days" mean exactly four or at most four?
* Are employees without an explicit "no doubles" restriction allowed to work doubles?
* What roles constitute the four-person normal PM shift?
* Which role is the "third person" arriving at noon Sunday?
* Which role is the "fourth person" arriving at noon Thursday/Friday?
* Do Desiree, Shorty, and Dolores have weekly day/hour limits?
* Is Cashier 1 versus Cashier 2 a distinct qualification, or simply two staffing positions that any cashier-qualified employee may fill?
* Does "Friday manager is 5th person" mean Friday PM has the normal four-person role composition plus an additional manager beginning at 3 PM?

Do not encode guesses about these into the domain model.

## Engineering expectations

Before implementation:

1. inspect the existing repository and technology stack;
2. write a concise architecture/design document;
3. normalize the restaurant rules into proposed structured data;
4. produce the ambiguity list;
5. identify the solver variables, hard constraints, and objective terms;
6. then implement.

Keep scheduling/domain logic independent of presentation code.

Add strong automated tests for every constraint.

At minimum include tests for:

* employee unavailable;
* employee unqualified;
* max days exceeded;
* prohibited double;
* allowed double;
* employee incompatibility;
* missing manager;
* staffing coverage;
* weekend availability exception;
* manually locked assignment;
* infeasible schedule;
* schedule passing independent validation.

Also create a regression fixture representing the restaurant's complete confirmed rules.

Do not optimize prematurely. This dataset is small. Correctness, explainability, maintainability, and usability are more important than solver performance.

When finished, document:

* architecture;
* data model;
* every implemented constraint;
* optimization objective and weights;
* how infeasibility is handled;
* how to add a new scheduling rule;
* how to run tests;
* how to run the application.

Work autonomously through implementation rather than stopping after the design, except where a domain ambiguity would require fabricating a business rule. Keep such rules configurable/unresolved rather than guessing.
