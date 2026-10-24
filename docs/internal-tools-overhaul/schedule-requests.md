# SCH-01: dated schedule requests

Local implementation only. Manager-only GET/PUT `/api/internal/schedule-requests/{station}` uses the existing optional INTERNAL_DB and DATA-05 atomic records/history primitive. Existing migrations 0001–0003 suffice; no schema, production binding, compatibility date, deployed Worker or KV record changed.

Each station owns one undated `schedule-request` record (`requests-{station}`). Its request list is bounded to 200 entries and 600,000 incoming UTF-8 bytes; reaching capacity requires a future reviewed archival design, never automatic deletion. An absent record is an explicit private empty list; absent binding/old Worker is unavailable. This aggregate serializes approvals within a station so overlapping approved exceptions for one legacy identity cannot race. It is an additive envelope service, not a projection into the future shared personnel tables.

Requests pin DEC-01-v1, inclusive shift-start business dates (at most 366 days), station plus original employee ID and display-name snapshot, original requested time, entered-by label/time, narrative and pending/approved/declined state. Actor labels are manager-entered provenance, not authenticated personal identities. UTC receipt/history timestamps are authoritative server write times. Temporary availability stores sorted nonoverlapping minute ranges; an end beyond 1440 denotes the next day of the same starting shift. Time off owns the entire starting business day. Recurring availability and suspension are untouched. Pending overlaps may coexist; approved overlaps for the same identity/date are rejected rather than assigned an implicit priority.

One mutation appends one pending original or reviews one pending request. Original fields, previous decisions and ordering are immutable; deletion/reopening is rejected. Base revisions protect concurrent editors. Stable operation IDs replay the original authoritative success even after later edits; changed content/actor rejects reuse. A guessed future revision cannot bypass domain validation. Clients validate station/store/envelope/data/revision and canonical acknowledged content before accepting a save. Credentials are only authorization headers and never request data.

## Local evidence

Synthetic fixtures only; local nonpersistent workerd D1/KV with remote bindings disabled.

- `npm run scheduler:requests:test`: 5 tests pass (dates, overnight/overlapping ranges, provenance, pending/approved overlap, immutable originals and strict client acknowledgments/retry identity).
- `npm run scheduler:requests:worker:test`: 4 integration tests pass (create/review/history/replay, simultaneous approval/decline, overlapping approvals and preserved KV, manager-only routes, absent binding, malformed/oversized bodies).
- `npm run scheduler:test`: 128 tests pass.
- `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8791 npm run build`, standalone TypeScript and SEO checks pass.

SCH-01 adds no visible UI or print output; English/Spanish and keyboard/touch entry are SCH-02, and application to generation/manual validation is SCH-03. Local frontend tests must use a loopback API override and block production requests.

Activation/live verification remain pending on DATA-03, REL-03, DATA-09 and REL-04. No provisioning, remote migration, deployment, publication, or real staff verification occurred. Rollback reverts the additive service/clients while preserving all accepted records, operation receipts and append-only history; reconcile accepted writes before returning to an older artifact. Public staff links and legacy APIs remain unchanged.
