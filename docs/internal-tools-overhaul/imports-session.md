# Imports-first service session — 2026-10-24

The latest instruction is to use **one new worktree for six PRs: DEC-01 and IMPORT-04 through IMPORT-08**, opening each and reporting when IMPORT-08 is open. Worktree: `/home/wslunusn/CR-Website-imports`. Start from IMPORT-03 (`cab30fc`); each subsequent branch targets its predecessor branch. Leave every PR open, unmerged, with auto-merge off. This supersedes the earlier stop-after-IMPORT-03 instruction. Shared prerequisites may be implemented within the appropriate dependent PR, with separate task evidence and no fabricated business approval. No external activation is authorized.

## Work and evidence

- IMPORT-01 is merged (#140); its validation and workbook compatibility remain preserved.
- IMPORT-02 implements extraction review/reconciliation. Canonical acceptance and commands are in [sales-review.md](sales-review.md) and [its brief](tasks/IMPORT-02.md). It is open as [PR #141](https://github.com/marcopolocheung/CR-Website/pull/141), base `main`, implementation commit `7d7bccf`; no merge/auto-merge.
- IMPORT-03 is open as [PR #142](https://github.com/marcopolocheung/CR-Website/pull/142), head `feat/overhaul-import-03`, base `feat/overhaul-import-02` (#141), implementation commit `5500abc`. Evidence: [retained imports](retained-imports.md). It remains unmerged with auto-merge off. The six-PR continuation follows this head.
- When the user resumes work, implement the date-decision record and affected IMPORT-04/05 work. Identity, retention, history and schedule-comparison prerequisites remain explicit; do not mark all imports complete from only the early frontend tasks.

## User's date-policy delegation (not a staff observation)

Asked for DEC-01 time zone, date cutoff, overnight ownership, week start, inclusive-range behavior, approver and effective date, the user answered: “CST, 11-9, no clue whatever the csv might say on CR3 kitchen schedule, doesnt matter, im not sure, implement what you think is correct.” This delegates implementation choices for these date questions; it does not approve unrelated cash/retention/identity policies or external operations.

Communicated interpretation: San Antonio Central time `America/Chicago` including daylight saving; 11:00–21:00 are opening hours, not a forced date cutoff. Use local midnight as the date boundary, assign an overnight shift to its starting business date, and include a whole source shift when that starting date falls in the selected inclusive range. Preserve source regular/overtime hours; do not recalculate/split payroll. Ambiguous timestamps need visible review rather than guessed conversions. Check existing CR3 Kitchen week helpers before choosing the week-start default, to preserve compatibility.

DEC-01's canonical record, midnight/DST examples and executable checks are in [business dates](business-dates.md), the first PR of the continuation. Record which inputs came directly from the user and which were chosen under delegated authority. Do not claim an independent staff approval, personal approver name, deployed policy or effective production date that was not supplied. Local code can implement the delegated choices; external activation remains a separate event.

## Boundaries

Use synthetic fixtures and explicit loopback API overrides. No cloud resource creation, Worker deployment, production migration/data mutation, deferred auth/hosting work or automatic merging is authorized. Keep original user worktrees/untracked documentation untouched. Shared migration number 0004 remains unused; reserve before any schema work. CODE_AND_EXTERNAL work records local implementation separately from activation/live verification. The [tracker](tracker.md) and canonical briefs remain authoritative; [earlier handoff](session-handoff.md) is a historical pre-merge inventory, not current PR state.

## Six-PR continuation

1. DEC-01: [PR #143](https://github.com/marcopolocheung/CR-Website/pull/143), base `feat/overhaul-import-03`, head `feat/overhaul-dec-01`, commit `e88b245`.
2. IMPORT-04: [PR #144](https://github.com/marcopolocheung/CR-Website/pull/144), base `feat/overhaul-dec-01`, head `feat/overhaul-import-04`, commit `49f7a7e`. Evidence: [sales context](sales-context.md).
3. IMPORT-05 follows `feat/overhaul-import-04`; evidence: [hours preview](hours-preview.md).

The user approved scoped import defaults on 2026-10-24: managers explicitly review mappings, never match by name, preserve inactive identities, disable hour targets; retain reviewed import values/fingerprints without raw file uploads or automatic deletion. Wider identity, personnel and retention/recovery decisions remain pending. This approval applies only to the import slices and grants no external execution.
