# Atomic record mutations (DATA-05)

`src/record-mutations.ts` provides a D1 record-envelope primitive for future authorized service owners. Existing Worker routes, tokens, KV writes and clients are unchanged. No generic write endpoint or capability is exposed. This task is locally implemented; external activation and live verification remain pending.

## Calling contract

A service authenticates and authorizes the caller through its existing gate, supplies a stable opaque caller scope (never a credential/token), record/store/family/action, optional station, exact business date/period context and actor provenance. An entered preparer label stays separate from authenticated identity. Pass the v1 mutation and a mandatory domain validator returning stable field issues. Scalar/context validation runs first; schema mismatches, malformed/lossy JSON, invalid dates, mismatched store/station, invalid/exhausted base revisions and empty actor context are rejected. Domain validators own calculations, policy/version checks and workflow transitions; this primitive does not approve a cash/form/unit policy.

Returns `{ok:true, record, replayed}` on acknowledgment, or `{ok:false,status,body}` with a language-independent v1 error. Conflict is HTTP 409 `revision_conflict` with current revision; clients retain their edits for compare/reload/copy. Unknown database/transaction failures return 503 `unavailable`, never a false save. Do not let clients automatically retry a stale mutation with a newer base revision. Reuse the original operation ID after an uncertain outcome. An operation receipt is created only with a successful business mutation; validation/conflict leaves the key available for a corrected attempt.

## Transaction boundary

One [D1 batch transaction](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) does all of the following:

1. Claim `(caller scope, store, family, record ID, action, operation ID)` with canonical request and original authoritative result, only if the record matches base revision (or is absent for base 0).
2. Insert/update the record under that claim and base condition. New revision is base + 1. Original creation time is selected inside the transaction.
3. Append exactly one history event with prior/new revision, actor, timestamp, action and authoritative snapshot. A required revision subquery makes a missing/mismatched record write fail the transaction.

Receipt uniqueness and event `(store,family,id,revision)` uniqueness arbitrate races within D1. A stale claim writes nothing. Duplicate successful operations replay the original result (even after later revisions); different canonical content or actor/context rejects `operation_reused`. Canonical JSON sorts object keys and retains array order, null and zero; it rejects undefined, nonfinite numbers, sparse arrays, non-JSON objects and cycles. It is not a financial parser. Operation contents, actor context and historical snapshots are protected business data; never log raw receipts. No credential belongs in service data.

Mutation receipts and history have database triggers rejecting update/delete. Domain relational projections (count lines, issued snapshots, receipt lines, etc.) are not changed by this envelope primitive: a consuming service must include those changes with its revision/history in a guarded transactional implementation before advertising that service. Do not bolt separate unguarded writes onto a successful envelope mutation. Cross-station scheduling publication enforcement remains SCH-05's separate transactional requirement. KV compare/put still has its original weaker guarantee.

## Local acceptance evidence

`npm run data:test` runs 10 integration/behavior tests (two DATA-02 storage scenarios plus eight DATA-05 scenarios) against fresh nonpersistent local workerd D1. It covers:

- Create/update with preserved creation time, original Spanish narrative, null/zero and actor provenance; historical success replay; event/receipt immutability.
- Two simultaneous writes from the same base: exactly one success, one 409 at the next revision, one new event/receipt.
- Six concurrent identical creates: one fresh success, five replays, one record/event; another create ID receives conflict.
- Changed content/actor rejects operation reuse; reordered JSON keys replay.
- Invalid input/domain validation and unknown policies supplied by validators produce no business, receipt or history writes.
- A synthetic trigger failure during history insertion rolls back receipt AND prior business update; dropping only that fixture trigger permits the same operation to retry once.
- Store, record, caller and action scopes remain distinct.

No UI, pointer gesture, persisted device credential, print rendering or language switch is introduced. Snapshots retain original labels/context for consuming English/Spanish UI and output owners. Their device and print acceptance remains their responsibility.

## Pending activation and rollback

DATA-03 must provision verified non-production D1/R2 and preserve the existing SCHEDULES binding. REL-03 must review the pinned artifact, actual account/resource IDs and environment-specific bindings; the local-only config is not a deployment config. Apply migrations 0001–0003 to the verified isolated target and rehearse restore before any production slice. Service owners wire authorized routes/domain validation and advertise only locally/staging verified capabilities. DATA-09 owns the selected production cutover and write reconciliation. None of those external steps was executed here.

Live verification must repeat create, concurrent same-base writers, identical/different-content retries and history-failure rollback through the deployed authorized service, recording redacted request IDs/revisions, artifact, operator, environment and UTC time. A health response is insufficient. Frontend consumers publish separately through REL-04.

Rollback: keep legacy KV attached/readable; stop writes to the selected new slice, export records/receipts/history and preserve/reconcile accepted new writes before returning to the last compatible artifact. Never delete receipt/history rows or assume code rollback restores data. Do not drop an activated migration; use a reviewed forward correction. Locally, test state is nonpersistent/disposed and the history-failure fixture is isolated. Next available migration number: 0004.
