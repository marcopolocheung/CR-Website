---
id: LATER-04
parent: LATER
title: "Barcode and shelf-QR scanning"
priority: P2
delivery_class: CODE_ONLY
status: deferred
owner: unassigned
implementation_dependencies: [INV-03, INV-05]
activation_dependencies: []
implementation: pending
local_verification: pending
external_activation: not_applicable
live_verification: not_applicable
---

# LATER-04 — Barcode and shelf-QR scanning

## Outcome and scope

Defer scanning until reliable item IDs/units and staff demand establish a useful lookup workflow.

This deferred scope is excluded from unrelated baseline tasks. Preserve current working flows and file imports while evaluating it; no account/resource change, subscription, deployment, or automatic agent spawning is authorized by this brief.

## Current behavior and verified sources

The baseline is a static export plus a separate KV Worker. QRGenerator builds /order links; OrderReview logs and writes order payloads to localStorage with no restaurant transmission. Current imports use uploaded files and current scheduling uses the browser solver. Separate optional work must not gate baseline improvements.

Verified in the local repository on 2026-10-24; this is source inspection, not a live-environment assertion. Entry points and symbols for rechecking:

- [src/components/internal/QRGenerator.tsx](<../../../src/components/internal/QRGenerator.tsx>)
- [src/components/order/OrderReview.tsx](<../../../src/components/order/OrderReview.tsx>)
- [next.config.ts](<../../../next.config.ts>)
- [worker/wrangler.toml](<../../../worker/wrangler.toml>)
- [src/lib/scheduler/solver.ts](<../../../src/lib/scheduler/solver.ts>)

See [current-state inventory](../current-state.md) and [supporting research](../../internal-tools-research.md) for preserved capabilities and rationale.

## Dependencies and coordination

**Needed to implement:**

- [INV-03](INV-03.md) at `implemented` (or `complete`).
- [INV-05](INV-05.md) at `implemented` (or `complete`).

**Needed to activate:**

Resolve the deferred activation criteria below before changing status to ready.

Dependencies reference milestone gates: `implemented` requires implementation and local verification; `complete` includes required external/live work. A prerequisite CODE_ONLY task may satisfy an implementation gate by being complete. Production cutover selects service slices; do not wait for every future feature. See [contracts](../architecture-contracts.md), [bilingual/shared-device reference](../bilingual-ux.md), and [agent guide](../agent-guide.md).

Affected areas: src/components/internal/QRGenerator.tsx; src/components/order/OrderReview.tsx; next.config.ts. Shared edits to worker/src/index.ts, API adapters, shared dictionaries, schema migrations, navigation, and package/workflow files require a named coordinating owner and an agreed interface before editing. Reserve a migration number with DATA-02; coordinate dashboard.js changes through REL-02. Keep unrelated files out of the task.

## Implementation checklist

- [ ] Trial USB typed input, camera scanning, and shelf labels with manual search fallback
- [ ] Handle permission denial and unrecognized codes
- [ ] Activate only after catalog mappings and tablet usability are accepted
- [ ] Update task evidence and the tracker, including any newly discovered contract or policy gap.

## Acceptance checklist

- [ ] Scenario 1: Trial USB typed input, camera scanning, and shelf labels with manual search fallback. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 2: Handle permission denial and unrecognized codes. Record fixture/input, expected result, actual result, and evidence.
- [ ] Scenario 3: Activate only after catalog mappings and tablet usability are accepted. Record fixture/input, expected result, actual result, and evidence.
- [ ] Preserve the exclusions and existing capabilities above; no unrelated prerequisite or paid component is introduced.
- [ ] Record local results separately from staging activation and production/live results.

## English/Spanish, devices, output, and recovery

- [ ] Keep persisted values, IDs, enums, and API errors language independent; expose translation keys or stable error codes for English/Spanish clients.
- [ ] Review downstream keyboard/touch and shared-device effects with the consuming task owner; no backend-only output requires a pointer gesture.
- [ ] Print/output: preserve source record context and historical snapshots consumed by print/export; no direct print UI is introduced in this task.
- [ ] Recovery: record a failure/reversal example and preserve original records, manifests, and evidence; mark genuinely inapplicable failure cases with reasons.

## Verification commands and expected results

- `npm exec tsc -- --noEmit` for touched TypeScript.
- `npm run build` for changed frontend/export behavior; `npm run seo:check` after a build when routing/static output changes.
- For affected UI, run `npm run dev` with a verified local/staging API override and exercise the scenarios above in both languages; browser/Playwright setup must be checked rather than assumed. Do not let local tests fall back to the production API.

Expected result: every applicable acceptance scenario passes, preserved behavior remains readable, and failures leave an explicit recovery path. Existing commands above were checked in package.json; proposed commands must be implemented and labeled before execution. During this documentation package creation none of these application or external checks were run.

## External operations, access, evidence, and rollback

No resource creation, binding change, migration execution, or Worker deployment is needed for this task. Verify locally; ordinary frontend publication is tracked by [REL-04](REL-04.md). This task reaching complete does not mean its frontend is live. Rollback: revert the scoped repository commit; retain any existing drafts and compatible record readers.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | pending | Scoped artifact, code, decision record, or execution plan reviewed. |
| Local verification | pending | Commands/scenarios and observed results, or decision/protocol consistency review. |
| External activation | not_applicable | No external operation in this task; frontend publication is REL-04. |
| Live verification | not_applicable | Covered by shared release/acceptance tasks where applicable. |

## Handoff evidence

- Commits/artifacts: none; this brief is planning documentation.
- Checks performed: source inspection only; implementation scenarios not run.
- Remaining steps: claim task, verify prerequisites, execute applicable checklists, and record milestone evidence.
- Blockers: Listed prerequisites are pending.
- External/live evidence: none. No feature is implemented, deployed, or verified by this documentation.
- Next owner/action: unassigned; claim and synchronize the [tracker](../tracker.md) before editing.

## Deferred activation criteria

Activate only after catalog mappings and tablet usability are accepted. A named owner must approve this criterion, confirm the implementation dependencies, split any newly discovered external work into explicit operations, and record an environment-specific activation/rollback plan before claiming implementation. Nothing in this task gates unrelated baseline delivery.
