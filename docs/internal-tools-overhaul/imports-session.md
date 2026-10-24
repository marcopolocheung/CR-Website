# Imports-first service session — 2026-10-24

The latest instruction is to use **one new worktree for six PRs: DEC-01 and IMPORT-04 through IMPORT-08**, opening each and reporting when IMPORT-08 is open. Worktree: `/home/wslunusn/CR-Website-imports`. Start from IMPORT-03 (`cab30fc`); each subsequent branch targets its predecessor branch. Leave every PR open, unmerged, with auto-merge off. This supersedes the earlier stop-after-IMPORT-03 instruction. Shared prerequisites may be implemented within the appropriate dependent PR, with separate task evidence and no fabricated business approval. No external activation is authorized.

## Work and evidence

- IMPORT-01 is merged (#140); its validation and workbook compatibility remain preserved.
- IMPORT-02 implements extraction review/reconciliation. Canonical acceptance and commands are in [sales-review.md](sales-review.md) and [its brief](tasks/IMPORT-02.md). It is open as [PR #141](https://github.com/marcopolocheung/CR-Website/pull/141), base `main`, implementation commit `7d7bccf`; no merge/auto-merge.
- IMPORT-03 is open as [PR #142](https://github.com/marcopolocheung/CR-Website/pull/142), head `feat/overhaul-import-03`, base `feat/overhaul-import-02` (#141), implementation commit `5500abc`. Evidence: [retained imports](retained-imports.md). It remains unmerged with auto-merge off. The six-PR continuation follows this head.
- The six-PR continuation now covers DEC-01 and IMPORT-04 through IMPORT-08, with four explicitly scoped shared prerequisite slices. CODE_AND_EXTERNAL tasks remain locally implemented with external/live work pending. Wider employee, retention and scheduler parent tasks remain pending. No further task follows IMPORT-08 in this instruction.

## User's date-policy delegation (not a staff observation)

Asked for DEC-01 time zone, date cutoff, overnight ownership, week start, inclusive-range behavior, approver and effective date, the user answered: “CST, 11-9, no clue whatever the csv might say on CR3 kitchen schedule, doesnt matter, im not sure, implement what you think is correct.” This delegates implementation choices for these date questions; it does not approve unrelated cash/retention/identity policies or external operations.

Communicated interpretation: San Antonio Central time `America/Chicago` including daylight saving; 11:00–21:00 are opening hours, not a forced date cutoff. Use local midnight as the date boundary, assign an overnight shift to its starting business date, and include a whole source shift when that starting date falls in the selected inclusive range. Preserve source regular/overtime hours; do not recalculate/split payroll. Ambiguous timestamps need visible review rather than guessed conversions. Check existing CR3 Kitchen week helpers before choosing the week-start default, to preserve compatibility.

DEC-01's canonical record, midnight/DST examples and executable checks are in [business dates](business-dates.md), the first PR of the continuation. Record which inputs came directly from the user and which were chosen under delegated authority. Do not claim an independent staff approval, personal approver name, deployed policy or effective production date that was not supplied. Local code can implement the delegated choices; external activation remains a separate event.

## Boundaries

Use synthetic fixtures and explicit loopback API overrides. No cloud resource creation, Worker deployment, production migration/data mutation, deferred auth/hosting work or automatic merging is authorized. Keep original user worktrees/untracked documentation untouched. Shared migration number 0004 remains unused; reserve before any schema work. CODE_AND_EXTERNAL work records local implementation separately from activation/live verification. The [tracker](tracker.md) and canonical briefs remain authoritative; [earlier handoff](session-handoff.md) is a historical pre-merge inventory, not current PR state.

## Six-PR continuation

1. DEC-01: [PR #143](https://github.com/marcopolocheung/CR-Website/pull/143), base `feat/overhaul-import-03`, head `feat/overhaul-dec-01`, commit `e88b245`.
2. IMPORT-04: [PR #144](https://github.com/marcopolocheung/CR-Website/pull/144), base `feat/overhaul-dec-01`, head `feat/overhaul-import-04`, commit `49f7a7e`. Evidence: [sales context](sales-context.md).
3. IMPORT-05: [PR #146](https://github.com/marcopolocheung/CR-Website/pull/146), base `feat/overhaul-import-04`, head `feat/overhaul-import-05`, commit `2e94519`. Evidence: [hours preview](hours-preview.md).
4. IMPORT-06: [PR #147](https://github.com/marcopolocheung/CR-Website/pull/147), base `feat/overhaul-import-05`, head `feat/overhaul-import-06`, commit `07f15d2`. Scoped prerequisites/evidence: [import identity](import-identity.md); wider parents remain pending.
5. IMPORT-07: [PR #149](https://github.com/marcopolocheung/CR-Website/pull/149), base `feat/overhaul-import-06`, head `feat/overhaul-import-07`, commit `fc16f0a`. DEC-03-IMPORT approval/evidence: [import history](import-history.md).
6. IMPORT-08 follows `feat/overhaul-import-07`; actual PR link/implementation commit are recorded after opening. SCH-06-IMPORT and acceptance evidence: [scheduled versus actual](scheduled-actual.md).

The user approved scoped import defaults on 2026-10-24: managers explicitly review mappings, never match by name, preserve inactive identities, disable hour targets; retain reviewed import values/fingerprints without raw file uploads or automatic deletion. Wider identity, personnel and retention/recovery decisions remain pending. This approval applies only to the import slices and grants no external execution.

## Final continuation state

The worktree remains `/home/wslunusn/CR-Website-imports`; all six continuation branches were created sequentially in this one worktree. Do not merge or enable auto-merge. Stop when IMPORT-08 is open. Local checks and task milestones are recorded in the linked guides; publication/cutover and live verification remain separately gated. Scoped prerequisites are DEC-04-IMPORT, DATA-04-IMPORT, DEC-03-IMPORT and SCH-06-IMPORT. Original 84 canonical briefs plus those four slices = 88. Run `python3 scripts/check-overhaul-tracker.py` to verify all rows, ready gates and dependency cycles.

Observed other open work on 2026-10-24: #145 (`feat/overhaul-ux-04`, base main), #148 (`feat/overhaul-cash-02`, base UX-04) and #150 (`docs/overhaul-dec-02`, base CASH-02) form a separate stack. This import session did not create, modify or merge those PRs. Future integration must reconcile shared tracker/i18n/Worker edits rather than duplicate that cash work. The import tracker reflects this branch's implemented artifacts, not unrelated unmerged branch contents. Original user worktrees and untracked `docs/forms`/`docs/supply` remain untouched by this session.
