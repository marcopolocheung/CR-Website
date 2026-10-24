---
id: DEC-02
parent: DEC
title: "Confirm cash-out notebook scope and fixed $100 float"
priority: P0
delivery_class: DECISION
status: complete
owner: Codex
implementation_dependencies: []
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# DEC-02 — Confirm cash-out notebook scope and fixed $100 float

## Outcome and approval

Record the user-approved bookkeeping notebook purpose, fixed $100 per cashier drawer and existing calculation semantics. The canonical answer, examples, boundaries and downstream effects are in [cash-out rules](../cashout-rules.md).

Approver: the project owner, identified as the user in this Codex conversation; no personal or GitHub identity is inferred. Approval date: 2026-10-24. Decision version: `DEC-02-notebook-v1`. The user explicitly said “always $100”, confirmed the existing example as the intended behavior and described the tool as a notebook “purely for bookkeeping and easy calculation”. The subsequent instruction authorized this decision PR.

The earlier starting-cash/adjustment/review brief was too broad. This decision resolves that brief by retaining the existing arithmetic and deferring operational cash-control features. No additional cash policy answers are required for the baseline calculation/notebook scope.

## Current behavior and verified sources

- [cashout.ts](../../../src/lib/cashout.ts): integer cents, fixed 10000-cent float per drawer, AM/PM sums, blank Toast/Z comparisons remain null.
- [CashOut.tsx](../../../src/components/internal/CashOut.tsx): guided entry and independent local drafts from CASH-01/02; save and print.
- [cashout-store.ts](../../../src/lib/cashout-store.ts) and [Worker](../../../worker/src/index.ts): existing store/date API, 30-day history, 31-day TTL, shape-checked client totals and last-save-wins. The decision does not claim those storage limits are sufficient for the future notebook.

## Dependencies and affected work

No prerequisite decision, deployment or staff session is needed to record this explicit approval. CASH-03 becomes ready, without changing its separate backend/frontend activation requirements. CASH-04/05/06 are deferred until a future operational feature request. CASH-08 depends on DATA-05 rather than CASH-04; save revision history remains baseline bookkeeping. DASH-03 depends on CASH-08 rather than CASH-05 and does not invent unreviewed/unresolved cash work.

DEC-03 retention and DEC-07 terminology/output decisions remain separate. This decision does not alter employee mappings, public/private access, source workbook semantics or other domains' approval workflows.

## Implementation and acceptance

- [x] Record the project owner's approval, date, exact fixed-float answer and bookkeeping purpose.
- [x] Verify balanced, short, over, explicit-zero and unavailable Toast/Z examples against the current integer-cent functions. Distinguish per-drawer from per-day subtraction.
- [x] Define calculated turn-in versus evidence of an actual bank deposit; preserve existing field/output compatibility.
- [x] Defer submission/review/adjustment/physical-delivery features without deferring ordinary saving and revision history.
- [x] Update affected briefs, contracts and tracker views; verify dependency references and cycles.
- [x] Preserve existing bilingual entry, keyboard/touch, device drafts, print and sales linkage. This documentation adds no UI or translated stored values; terminology approval remains DEC-07.
- [x] Record recovery/reversal: a future dated decision supersedes this one without deleting saved figures/source drafts; no code or data rollback is performed here.
- [x] Separate decision/local evidence from implementation, publication and live guarantees.

## Verification

- `npm run cashout:test`: 19/19 pass, including current arithmetic, blank/zero/unknown state and wire parity.
- `node --input-type=module` with `createJiti` and inline assertions: the worked balanced/over/short/zero/blank cases, AM/PM/Z totals, two-drawer float and below-float case match the decision record.
- `python3 /tmp/check-cr-dec02.py`: 84 briefs, 161 tracker rows, task/tracker titles/status/owner/dependencies/milestones, dependency graph cycles, resolved DEC-02 gates, deferred task views and 46 newly added local links pass. The checker is a transient local artifact; no application test/tool is added.
- `npm run build`, `npm run seo:check`, `git diff --check`: pass as repository PR validation. No application source changed or new browser behavior is claimed.

## Milestones

| Milestone | State | Evidence |
| --- | --- | --- |
| Implementation | done | Owner-approved decision and scoped plan in cashout-rules.md. |
| Local verification | done | Arithmetic and documentation consistency checks above. |
| External activation | not_applicable | Documentation decision; no deployment. |
| Live verification | not_applicable | No live feature or staff acceptance claim. |

## Handoff evidence

- Owner/worktree: Codex, `docs/overhaul-dec-02`, same `/home/wslunusn/CR-Website-cashout` worktree used for UX-04/CASH-02; base is `feat/overhaul-cash-02` / PR #148.
- Artifacts: cashout-rules.md, affected task briefs/tracker and cash-related planning references. Application/schema/API/retention/access code is untouched.
- Decision is complete; implementation milestones of CASH-03/08 and deferred tasks remain pending. No downstream task is claimed and no PR is merged.
- Next owner/action: user may select CASH-03 for calculation parity or the remaining notebook/history work. CASH-08 still needs the separately recorded retention/output decisions; do not infer a duration from “long notebook”.
