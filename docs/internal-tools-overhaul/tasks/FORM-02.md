---
id: FORM-02
parent: FORM
title: "Add recoverable drafts and navigation protection"
priority: P0
delivery_class: CODE_ONLY
status: complete
owner: Claude
implementation_dependencies: [UX-05, UX-06]
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# FORM-02 — Add recoverable drafts and navigation protection

## Outcome and scope

Persist labeled form drafts and protect unfinished narratives during navigation.

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

- [UX-05](UX-05.md) at `implemented` (or `complete`).
- [UX-06](UX-06.md) at `implemented` (or `complete`).

**Needed to activate:**

None for local completion. Frontend publication, when applicable, is tracked separately by REL-04.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/WriteUps.tsx; src/lib/writeup-store.ts; src/app/(order-shell)/internal/forms/page.tsx. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [x] Resume by store/date/type/preparer without confusing another employee record
- [x] Test reload, back, tab switch, corrupt storage, and storage denial
- [x] Leave saved write-ups immutable and keep tokens out of drafts
- [x] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [x] Scenario 1: Resume by store/date/type/preparer without confusing another employee record. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 2: Test reload, back, tab switch, corrupt storage, and storage denial. Record fixture/input, expected result, actual result, and evidence.
- [x] Scenario 3: Leave saved write-ups immutable and keep tokens out of drafts. Record fixture/input, expected result, actual result, and evidence.
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

- Artifacts: `FormDraftWorkspace.tsx` (reusable store/date/preparer chooser, device autosave and navigation protection for any paper form), `src/lib/internal-tools/writeup-draft.ts` with tests, optional `formType` in `DraftContext` (`drafts.ts`), write-up editor wired into it in `WriteUps.tsx`, `formDrafts.*` keys in both dictionaries, `scripts/test-forms-drafts.py`. `forms:test` now also runs the draft and write-up draft unit tests. Stacked on FORM-01 (#157).
- Draft contract: write-up drafts use the shared UX-05 repository with context `{ task: 'form', formType: 'write-up', storeId, businessDate }`. `formType` is appended to the encoded key only when present, so every existing cash-out/import key is byte-identical (unit-checked against the old encoding). The payload is `{ form, savedId }`. `form` is whitelisted to exactly the write-up fields. `savedId` records the server write-up a draft became, so after a reload the device still knows it was saved.
- Scenario 1: explicit store, date and preparer label, then Start new or Resume as a copy. The paper DATE is the draft date and is locked while editing. Drafts for CR2/2026-10-20 and CR3/2026-10-20 stay separate; one preparer's draft is labeled with its preparer and never merges into another. Cash-out drafts for the same store/date are a different task and never appear.
- Scenario 2: every edit autosaves to the device ("Saved on this device" with time). Reload and Resume restores names and multi-line Spanish narrative exactly. In-app links ask first (Escape keeps the page), and a real reload raises the browser's beforeunload prompt. A second tab resumes its own copy without replacing the first tab's fields. With storage denied, the editor keeps the typed values, shows the device-save failure and won't close until a save succeeds; it recovers when storage returns. A corrupt entry is shown as unreadable, its original bytes download, and it is never overwritten.
- Scenario 3: the 401 (expired code) path now keeps the editor mounted behind the code gate, so re-entering the code restores the unsaved write-up instead of discarding it; nothing is posted until then. Saving posts exactly one immutable write-up; the saved view stays read-only and the draft records `savedId`. Resuming a saved draft shows "already saved" and disables Save until the manager chooses "Edit as a new write-up", so a reload can't silently create a duplicate. The saved record is unchanged. No manager code appears in localStorage or in any recovery download. Language switching leaves every stored draft byte-identical.
- No delete/expiry is added; saved and unsaved drafts stay on the device until DEC-03 defines retention. Preparer is a typed label, not an identity or signature.
- Checks (local, 2026-10-24): `npm run forms:test` 12/12; `cashout:test` 16/16; `recovery:test` 7/7; contracts+i18n 9/9. `test-forms-drafts.py` passed 5 runs in a row after two test-only ordering fixes (draft storage order is not stable), and fails when device saving is disabled. `test-forms-list.py`, `test-forms-compat.py`, and the existing `test-internal-drafts.py`, `test-cashout-context.py`, `test-internal-recovery.py`, `test-internal-language.py`, `test-internal-feedback.py` all PASS against Next dev with a loopback API override and production requests rejected. `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`.
- Browser limits from UX-06 still apply: beforeunload is browser-controlled, and back/forward inside the app is protected by the device draft rather than blocked.
- I/L/E/V: done/done/not_applicable/not_applicable. No Worker change.
- Rollback: revert the commit. Write-up drafts stay in localStorage under `cr-internal-draft:` keys and are simply not shown by the older page.
- Next owner/action: DEC-06 record, then FORM-06 reuses `FormDraftWorkspace` for each new form.
