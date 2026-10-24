---
id: FORM-07
parent: FORM
title: "Verify blank downloads and saved compatibility"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Claude
implementation_dependencies: []
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# FORM-07 — Verify blank downloads and saved compatibility

## Outcome and scope

Capture compatibility checks for every blank form and historical write-up.

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

None. This task can be claimed independently within the stated scope.

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/WriteUps.tsx; src/lib/writeup-store.ts; src/app/(order-shell)/internal/forms/page.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Verify all eleven catalog downloads resolve with their existing formats
- [x] Render old saved write-ups and edit only their manager labels
- [x] Check long narratives, signature fields, print pagination, and basePath-aware links
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Verify all eleven catalog downloads resolve with their existing formats. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Render old saved write-ups and edit only their manager labels. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Check long narratives, signature fields, print pagination, and basePath-aware links. Record fixture/input, expected result, actual result, and evidence.
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
- Add focused fixture/behavior checks where this outcome introduces a new contract. FORM-07 added `npm run forms:test` and `scripts/test-forms-compat.py`.
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

- Artifacts: `src/lib/forms.ts` (blank-form catalog moved out of the page so it can be checked), `src/lib/forms.test.ts` with new `npm run forms:test`, `scripts/test-forms-compat.py`, and a print fix in `WriteUps.tsx`. Base: `main` at 21db7f0.
- Scenario 1: all eleven catalog entries match the eleven files in `public/internal/forms` one-to-one. Each starts with its format's signature (`PK\x03\x04` for xlsx/docx, `%PDF` for PDF) and is served 200 by Next dev. PDFs open in a new tab without `download`; Excel/Word links carry `download`. Links are built with `NEXT_PUBLIC_BASE_PATH`, unit-checked for empty and `/chinarose`.
- Scenario 2: a v1 write-up shaped exactly as the existing page saved it opens from the list with every field, checkbox and signature-text value read-only (clicking a saved checkbox does nothing). Saving a new label sends only `PUT /api/writeups/{id}/label`; the form object is unchanged. Enter in the label field also saves.
- Scenario 3 and defect fixed: narrative boxes were fixed-height `<textarea>`s, so a printed write-up showed only the first 4–5 lines of a long narrative. They now print a full-text block (same minimum height as the paper box) and hide the textarea in print. A 40-line narrative prints in full across ≥3 Letter pages with signature lines visible and label/editor controls hidden. Reverting the fix makes the check fail.
- Typed signature names remain text fields, not a completed signature workflow; nothing new claims otherwise.
- Checks (local, 2026-10-24): `npm run forms:test` 2/2; `python3 scripts/test-forms-compat.py http://127.0.0.1:3017` PASS against Next dev with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`, synthetic responses and production requests rejected; `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`.
- English/Spanish: the forms page and write-ups have no translated strings yet and print in English, unchanged here. FORM-01/02 add their new strings to both dictionaries.
- I/L/E/V: done/done/not_applicable/not_applicable.
- Rollback: revert the commit; no stored data or URLs change.
- Next owner/action: FORM-01 (list search/filters) stacks on this branch.
