---
id: FORM-01
parent: FORM
title: "Add searchable employee/date/type lists"
priority: P1
delivery_class: CODE_ONLY
status: complete
owner: Claude
implementation_dependencies: [UX-03]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# FORM-01 — Add searchable employee/date/type lists

## Outcome and scope

Provide searchable/filterable existing write-up lists and a record-type adapter for future forms.

Preserve every blank download, original submitted narratives/signature fields, and manager-label editing. Do not mutate a submitted original or claim typed/printed signature text is a completed signature workflow.

## Current behavior and verified sources

The forms page lists eleven blank downloads and mounts WriteUps. WriteUps has a saved-record list and a paper-shaped editor; the Worker keeps submitted form contents immutable and permits manager-label updates. No local form draft, attachment, amendment, or follow-up service is present in these sources.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/WriteUps.tsx](<../../../src/components/internal/WriteUps.tsx>)
- [src/lib/writeup-store.ts](<../../../src/lib/writeup-store.ts>)
- [src/app/(order-shell)/internal/forms/page.tsx](<../../../src/app/(order-shell)/internal/forms/page.tsx>)
- [worker/src/index.ts](<../../../worker/src/index.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [UX-03](UX-03.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/WriteUps.tsx; src/lib/writeup-store.ts; src/app/(order-shell)/internal/forms/page.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Filter employee/date/type and preserve current manager labels and ordering
- [x] Distinguish no matches, no records, and failed loading
- [x] Open the exact saved form with keyboard and tablet controls
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Filter employee/date/type and preserve current manager labels and ordering. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Distinguish no matches, no records, and failed loading. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Open the exact saved form with keyboard and tablet controls. Record fixture/input, expected result, actual result, and evidence.
- [x] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [x] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [x] Translate visible labels, field errors, confirmations, statuses, and empty states with stable keys; language switching preserves record identity and entered values.
- [x] Complete the relevant flow by keyboard and touch; retain visible focus, dialog focus recovery, readable wrapped Spanish, and generous frequent-action targets.
- [x] Print/output: preserve familiar existing reports and downloads, show store/date/status, and check long Spanish and pagination where output is affected; otherwise record why print is unaffected.
- [x] Recovery: exercise interrupted work, denied storage or authorization, late responses, retries, and a second editor where applicable; never label local-only work as server saved.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- Add focused fixture/behavior checks where this outcome introduces a new contract. No `imports:test`, `forms:test`, D1 migration runner, or Worker build script exists yet; exact new commands and fixtures are future deliverables and must be recorded in handoff.
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

No resource creation, binding change, migration execution, or Worker deployment is needed for this task. Verify locally; ordinary frontend publication is tracked by [REL-04](REL-04.md). This task reaching complete does not mean its frontend is live. Rollback: revert the scoped repository commit; retain any existing drafts and compatible record readers.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | done | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | not_applicable | No external operation in this task; frontend publication is REL-04. |
| Live verification | not_applicable | Covered by shared release/acceptance tasks where applicable. |

## Handoff evidence

- Artifacts: `SavedFormRow`/`filterSavedForms` adapter in `src/lib/forms.ts` with unit cases in `forms.test.ts`; `SavedFormsList` in `WriteUps.tsx` replacing the plain table; `forms.*` keys in both dictionaries; `scripts/test-forms-list.py`. Stacked on FORM-07 (#155).
- Record-type adapter: each saved form type maps to one row shape (`type`, `id`, `date`, `employee`, `label`) so later forms join the same list and filters. Only `write-up` exists in this PR.
- Scenario 1: search matches employee and label words in any order, ignoring case and accents ("ana lopez" finds "Ana López"). Type and from/to date filters combine. Rows keep the server order (newest date, then employee) and the current manager labels. Synthetic browser fixture of 4 records checks each filter and the "Showing n of m" count.
- Scenario 2: three different messages. No records: "No forms saved yet." Filters with no hits: "No saved forms match these filters." plus Clear filters, which refocuses search. Failed load: an alert with Try again. A failed refresh keeps the previous list visible instead of emptying it, and a failed first load never shows "No forms saved yet."
- Scenario 3: each Open button is 44px tall and named for its record ("Open Write-up for Ana López, 2026-01-05"), so the two Ana López records stay distinct. Touch tap and keyboard Enter each open the exact record. At 375px the type and label stack under date/employee with no sideways scrolling.
- English/Spanish: list controls, states and counts use stable keys in both languages, checked by the dictionary parity test and a Spanish empty-state check at 375px. Employee names, labels and the paper form are never translated. Print is unaffected (the list is `print:hidden` as before).
- Checks (local, 2026-10-24): `npm run forms:test` 3/3; i18n 3/3; `test-forms-list.py` and `test-forms-compat.py` PASS against Next dev with a loopback API override, synthetic responses and production requests rejected; `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`.
- I/L/E/V: done/done/not_applicable/not_applicable. No Worker change; the existing list route already returns every field filtered here.
- Rollback: revert the commit; nothing is stored.
- Next owner/action: FORM-02 (device drafts and navigation protection) stacks on this branch.
