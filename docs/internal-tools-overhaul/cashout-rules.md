# Cash-out bookkeeping scope — DEC-02

Approved by the project owner (the user in this Codex conversation) on 2026-10-24. Decision version: `DEC-02-notebook-v1`. The user confirmed “always $100” and described the tool as “purely for bookkeeping and easy calculation”, a long notebook for looking back at the figures. The user then instructed that this clarified scope be recorded in a PR. This is approval of the scope and fixed float; the synthetic examples below verify its arithmetic rather than introducing more business procedures.

This decision supersedes the earlier planning assumptions about cash movements, submission/review states and actual bank deposits. Those assumptions came from general workflow research and broad task briefs, not a restaurant requirement. Historical research and earlier handoffs remain background; use this record and the updated tracker for current cash scope.

## Current purpose and rules

- Count each cashier's drawer by denomination for AM and PM, with store and selected date context.
- Always retain **$100 per cashier drawer**, for both stores and both shifts. There is no store/shift override in this scope.
- Drawer total = sum of denomination value × count. Calculated turn-in = drawer total − $100. Preserve the existing signed calculation, including a negative result when the drawer contains less than $100; do not introduce a clamp or another float.
- Cashier difference = calculated turn-in − entered Toast cash payments. Shift turn-in is the sum of its cashier turn-ins; day turn-in is AM + PM. Day difference versus Z = day turn-in − entered Z expected cash.
- All calculations use integer USD cents. Blank Toast/Z means that comparison is unavailable, not a confirmed zero. Entered zero remains a real comparison value. New blank denomination fields and entered zero remain distinct in device entry status, while preserving the existing zero contribution to calculations. Invalid entry remains correctable and is not an accepted financial zero.
- Save the figures by store/date so users can return to their records. Preserve source figures, useful saved versions, explicit save feedback, recoverable drafts and protection against silent overwrite as the saving/history work is implemented.
- Existing `deposit` fields, paper labels and sales workbook cells represent **calculated turn-in** in this notebook. They do not prove that cash was counted a second time, physically delivered or deposited at a bank. Preserve those fields and output compatibility; a future label change must avoid changing their meaning.

No cash-drop/paid-out category, adjustment formula, required discrepancy explanation, shortage threshold, approval/submission state, special correction authorization or physical deposit/delivery tracking is required for this scope. Optional operational features need a future explicit request. Ordinary record revision history is still useful bookkeeping and does not depend on an approval workflow. Existing access controls stay as they are; describing a notebook that people can look back at does not authorize publishing cash records to the public internet.

## Worked calculation examples

These use the existing `cashierTotals` and `dayTotals` functions, not a new calculation model.

| Example | Counted drawer | Retained float | Calculated turn-in | Toast cash payments | Difference |
| --- | --- | --- | --- | --- | --- |
| Balanced | $300.00 | $100.00 | $200.00 | $200.00 | $0.00 |
| Slightly over, as discussed | $300.00 | $100.00 | $200.00 | $199.75 | +$0.25 |
| Short | $300.00 | $100.00 | $200.00 | $205.00 | −$5.00 |
| Float only, explicit zero Toast | $100.00 | $100.00 | $0.00 | $0.00 | $0.00 |
| Toast not entered | $300.00 | $100.00 | $200.00 | blank | unavailable (`null`) |
| Explicit zero Toast | $300.00 | $100.00 | $200.00 | $0.00 | +$200.00 |

Day example: AM drawer $300 / Toast $199.75 and PM drawer $100 / Toast $0 produce AM turn-in 20000 cents, PM turn-in 0, day turn-in 20000 and combined Toast difference +25. Entered Z $200 produces a zero Z difference; blank Z leaves that comparison null. Two $300 drawers retain $100 **each**, so the day turn-in is $400, not $500. A $50 drawer retains the fixed subtraction and produces −$50 calculated turn-in, as the current code already does.

## Effect on the work plan

| Task | Current disposition |
| --- | --- |
| CASH-01 / CASH-02 | Existing local draft safety and guided entry remain complete. |
| CASH-03 | Ready for future implementation: verify/recalculate the same notebook arithmetic on the server, with fixed $100 and existing source fields. No adjustment or workflow-policy gate remains. This PR does not implement it. |
| CASH-04 | Deferred: incomplete/submitted/reviewed business workflow is outside the current purpose. |
| CASH-05 | Deferred: mandatory discrepancy explanations/review resolutions are outside the current purpose. Technical save/revision history remains DATA-05/CASH-08 work. |
| CASH-06 | Deferred: a separate actual bank deposit or cash-delivery record is outside the current purpose. |
| CASH-07 | Still optional directory-selection work with its existing employee-identity dependencies; DEC-02 does not approve employee mappings. |
| CASH-08 | Active baseline: saved notebook lookup, ordinary revisions, print/export and recovery. Depends on DATA-05 instead of the deferred CASH-04 workflow. Retention/output decisions DEC-03/DEC-07 remain separate. |
| DASH-03 | Show recorded differences and inventory progress from service records, without an invented cash review queue. Depends on CASH-08 instead of CASH-05. |

## Evidence, limits and reversal

Source inspection confirms `FLOAT_CENTS = 10000` and the formulas above in [cashout.ts](../../src/lib/cashout.ts). CASH-02 already preserves the established wire shape and sales linkage. `npm run cashout:test` and direct execution of the worked cases verify the current behavior. Task/tracker dependency, status, milestone and cycle checks verify the plan; build and SEO checks are repository PR validation, not evidence that new notebook services are deployed.

This is a documentation decision. No application, schema, API, authentication, TTL, retention duration, Worker deployment or frontend publication is changed. In particular, existing server history is still limited to 30 days with a 31-day TTL and last-save-wins; reliable long-term history remains implementation/retention work. No exact retention duration was supplied by this decision.

The unused local D1 scaffold in [migration 0002](../../worker/migrations/0002_domain_relations.sql) still restricts `cash_closes.state` to incomplete/submitted/reviewed and has an optional actual-deposit column. It reflects the earlier plan. The CASH-08 owner must align that scaffold additively before notebook persistence uses it, coordinating a migration number at implementation time; do not implement an approval workflow just to satisfy the old scaffold. CASH-03 calculation parity can still use the existing KV route independently. No migration is edited or executed by this decision PR.

If the purpose changes later, add a dated superseding decision and assess its affected tasks. Preserve the original notebook figures, source drafts and revision lineage. Reverting this documentation alone must not be treated as changing saved data or restoring an older financial procedure. No downstream code task has been claimed in this assignment.
