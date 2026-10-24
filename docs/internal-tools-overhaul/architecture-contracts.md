# Target architecture and minimum contracts

**Target architecture; no deployed APIs or executed migration are implied.** DATA-01 now provides [local executable contract v1](contract-v1.md); service routes and policy-dependent conversions remain pending. [Current state](current-state.md) documents existing behavior. DATA-01 turns these minimum agreements into exact versioned schemas, type definitions, adapters, error fixtures, and routes before independent consumers implement them. Unresolved policy fields remain unset/disabled until the linked decision is approved. Do not infer a deployed capability from a documented type.

## Storage and ownership

Retain a static frontend/API boundary. D1 holds business records and relationships; R2 holds attachment objects; D1 holds their references and access context. Existing SCHEDULES KV remains readable through compatibility adapters and is preserved until each approved service slice has reconciled, exercised rollback, and met DEC-03 archival requirements. No wholesale replacement, frontend hosting move, authentication redesign, or Toast API is required.

Domain owners maintain their calculations and validators. DATA-01 owns shared interfaces; DATA-02 owns migrations/fixtures; DATA-04 owns reviewed employee mappings; DATA-05 owns atomic mutations and audit events; DATA-06 owns object/reference integrity. Dashboard inputs derive from these records. No second checklist, UI-only completion flag, or translation-dependent duplicate record is authoritative.

## Identifiers, dates, and language

| Proposed contract | Minimum agreement / unresolved policy |
| --- | --- |
| StoreId | `CR2` or `CR3`, physical store. Display names/location slugs require an explicit mapping; never parse arbitrary labels into authority. |
| StationId | Existing CR3-diningroom, CR3-kitchen, CR2-kitchen, CR2-diningroom; directory explicitly maps each to its StoreId. Current `restaurant` query parameter means StationId and remains compatible. |
| EmployeeId | Stable opaque shared identity; memberships are separate records. No name-based merge. A mapping uses source system, source scope/station, legacy/external ID, shared ID, review provenance, and effective context. DEC-04 resolves rehires, temporary cashiers, membership and hour targets. Unmapped is an explicit state. |
| BusinessDate | Valid calendar `YYYY-MM-DD`, stored independently from event timestamp. DEC-01 defines store timezone, rollover, overnight ownership, week boundary and overrides. Do not convert UTC timestamps to a business date without the approved rule. |
| Event time / shift | UTC timestamp for occurred/created/updated/reviewed events plus relevant store context. Shift instance retains business date and start/end context; do not assume all shifts end before midnight. Current minute-based templates remain readable. |
| RecordId / schemaVersion / revision | Stable opaque record identity, explicit schema version, integer monotonically increasing revision. Legacy IDs stay available through lineage mappings; do not reuse an employee name or array index as a new shared identity. |
| Locale | UI preference `en` or `es`, independent of record values. Persist enums/IDs/cents without translated labels. Preserve original names, narratives, supplier text, and source files. Store original narrative language only when explicitly entered/known. |

## Money, quantities, and nulls

All authoritative financial values are safe integer **USD cents**, including calculated cash turn-in and differences. Source text may remain in an import/draft for correction; CASH-03 will recalculate the existing notebook arithmetic on the server. [DEC-02](cashout-rules.md) confirms $100 retained per cashier drawer and the bookkeeping purpose; it does not require adjustment categories, review/submission states or physical-deposit tracking. Blank Toast/Z means the comparison is unavailable (`null`), while entered zero is explicit. CASH-02 preserves blank versus entered-zero denomination status locally while keeping its existing zero contribution to totals; invalid input is retained and blocks saving. DEC-07 still resolves money-entry display and ambiguous separators. Preserve existing Toast/Z workbook fields; their `deposit` values are calculated turn-in, not evidence of an actual bank deposit.

Inventory count and purchase quantities are different fields with explicit units and pack-conversion context. DATA-01 must specify an exact decimal/rational representation after DEC-05 examples; do not assume binary float or integer cents applies to stock units. Legacy mixed-unit raw values remain available and unresolved conversions are visible. Enough is a deliberate categorical response, not a measured quantity or automatic target quantity.

## Record envelope, mutations, and errors

Proposed minimum read envelope: `{schemaVersion, id, storeId, stationId?, businessDate?, revision, createdAt, updatedAt, data}`. Record families add their required context; import periods use explicit start/end dates rather than a fabricated single date. Legacy endpoints keep current response shapes via adapters; adopting this envelope is additive/versioned, not an in-place break.

Proposed mutation envelope: `{schemaVersion, baseRevision, operationId, data}`. `baseRevision: 0` means create only where the family permits it. Operation identity is stable across retry and scoped to the caller/record/action. Reuse with different content is rejected. Server validation produces stable error codes, field paths, and parameters; English/Spanish clients translate them.

| Result | Required behavior |
| --- | --- |
| Successful mutation | Return authoritative data/revision/time; only then show Saved to server. Domain validation, conditional update, revision increment, and history event commit atomically. |
| Validation failure | Stable field errors, user values retained, no partial business mutation. |
| Unauthorized / unconfigured | Preserve in-progress data, distinguish 401 from missing backend configuration, prompt through existing credential gates. No credentials persisted in drafts. |
| Conflict | 409 with stable conflict code and current revision/context; retain user's version and offer reload/compare/copy. No silent financial/count overwrite or automatic blind retry. |
| Retry after uncertain outcome | Same operationId returns prior result without a duplicate order, receipt, submission, amendment, or event. |
| Unavailable / partial load | Explicit waiting/failed/stale state with retry; never translate failure into zero or an empty successful list. |

DATA-05 must prove atomic revision enforcement with concurrent requests and couple mutation/history within one D1 transactional boundary. The current KV read/compare/put sequence does not meet that contract. Revision alone does not prevent cross-station conflicts: SCH-05 also needs a transactionally enforced scheduling publication check for shared employee intervals.

History events minimally identify record/family, prior/new revision, event kind, timestamp, and recorded actor/preparer context permitted by existing access. Keep an entered manager/preparer label distinct from an authenticated identity. No proposed audit event implies an authentication redesign has happened.

## Record families and transitions

Transitions below describe required distinctions. Exact action permissions and policy-required fields are approved by DEC tasks, then encoded by DATA-01 and service owners.

| Family / owner | Minimum record content and relationships | State / compatibility requirements |
| --- | --- | --- |
| Directory / DATA-04 | Employee, memberships, reviewed legacy/external-ID mappings, inactive history | Retain historical references and display-name snapshots; never silently merge same-name staff. |
| Scheduling / SCH-01–06 | Recurring availability, dated exception/request with entered-by/requested-for/review event, station assignment, publication revision and snapshot | Pending → approved/declined; only approved exceptions affect generator/manual validator. Suspension separate. Draft → published snapshot; visibility independent. Compare against last published revision, retain old public payload adapters. |
| Cash notebook / CASH-03, CASH-08 | Store/business-date record, cashier/shift/count lines, fixed 10000-cent retained float per drawer, Toast/Z source inputs, calculated totals and saved revisions | Device draft and acknowledged shared save are distinct. Preserve ordinary revisions/history without requiring submitted/reviewed states or an actual bank deposit field. Operational CASH-04/05/06 are deferred by DEC-02. |
| Counts / INV-01–05/10 | Session with store/date/catalog version, line ID/item snapshot, unit/pack/target context, measured/raw value and categorical response, completion review | Session open → completed; line uncounted/measured-zero/measured/Enough/skipped. Report skipped lines explicitly. Catalog edits never reinterpret completed history. |
| Purchasing / INV-06 | Order and lines, originating count, supplier, issued catalog/label/unit/pack snapshots, manual overrides | Draft → issued; issued details immutable. Cancellation/correction retains lineage. Suggested order is not an issued order. |
| Receiving / INV-07/08 | Receipt and lines linked to issued order/line, operation identity, quantities, discrepancies, receipt event | Multiple partial receipts allowed; remaining = issued minus valid received/cancelled amounts in compatible units. Do not close open lines prematurely or duplicate retries. |
| Stock events / INV-09 | Waste/transfer event, source/destination store, quantity/unit snapshot, reason, receipt/confirmation context | Approved DEC-05 event types only; avoid inferred consumption and duplicate transfer accounting. |
| Imports / IMPORT-01–08 | Import job, kind/store/period, source fingerprints and slots, parser/mapping version, extracted values, row exceptions, employee mapping, review/export metadata | Upload → validate → review → download; rejection retains useful inputs. Repeat download distinct from reprocess; preserve superseded lineage. Source regular/overtime values stay identifiable. |
| Forms / FORM-01–07 | Draft, typed form definition/version, employee/date/type, immutable submitted snapshot, label, amendments, review/signature evidence, attachment refs | Draft → submitted; append-only amendments; label editing preserved. Review/signature transitions only as approved in DEC-06; printed line or typed name alone proves neither signature completion nor approval. |
| Follow-ups / FORM-05 | Parent record/ref, due date, assignee, status, resolution and history | Open/overdue/resolved distinctions; resolution event retained; service record drives dashboard status. |
| Attachments / DATA-06 | Stable attachment ID, private R2 object key, parent family/id/revision, original filename, media type, size, checksum, upload status, timestamps | Pending upload → available or failed; authorize parent access on upload/read, recover interrupted uploads, reconcile orphan object/metadata, use DEC-03 retention/limits. No public R2 URL assumed. |

The unused `cash_closes` table in migration 0002 still encodes the earlier workflow-state plan. CASH-08 must align that scaffold additively with the approved notebook before using it; this target contract neither changes SQL nor makes CASH-04/05/06 prerequisites. CASH-03 may independently recalculate through the existing KV route.

## Attachment and import identity boundaries

API consumers receive attachment references and authorized retrieval metadata, not secrets, arbitrary R2 keys they can use to cross records, or copied file bodies in business records. Upload/retrieval route design remains DATA-06's future deliverable. Validate required type/size policy, filename handling, checksum and authorized parent context; list missing/failed files explicitly. R2 upload and D1 metadata cannot be assumed to be a single cross-service transaction: use recoverable pending/available states and reconciliation.

Source import identity includes fingerprint of source bytes, import kind, verified store, business date or inclusive period, slot/report role, parser version and mapping revision. Different import versions may reference the same source. Do not deduplicate by filename or upload timestamp. IMPORT-07 owns the persisted identity/history; IMPORT-03 can retain session inputs without new backend activation. Retaining raw files or generated workbooks uses approved policy and attachment references; repeat download can also regenerate from a preserved reviewed snapshot where appropriate.

## Dashboard summary boundary

DASH-01 defines the exact type/transport. Minimum summary item: `{sourceFamily, recordId, revision, storeId, businessDateOrPeriod, stationId?, reasonCode, status, countOrAmount?, target, observedAt}`. Target identifies an exact route/tab and record context; tokens never appear in URLs. Separate response states: loading, available-with-items, available-empty, missing-source-data, unavailable, and stale-partial. Each service supplies authoritative unresolved inputs; the dashboard does not invent completion flags.

CASH-08 supplies saved notebook records and recorded differences; these observations do not imply incomplete submission, an unresolved review task or a physical deposit. Missing notebook records are distinct from saved zero-difference records. INV-01 supplies progress, INV-06/07 outstanding deliveries; SCH-04 unpublished differences; FORM-05 due follow-ups. Missing required service capability is visible and does not mean no work. Existing cash summaries remain available where authorized.

## Compatibility and migration gates

Preserve `/api/weeks` ciphertext consumers, predictable public `/api/schedule` views, station `restaurant` queries/defaults, visible weeks, month revisions including spanning weeks, global/week roster/template fallback, CR3 Kitchen restrictions and crew undo, and current cash-out/form/inventory response adapters. Employee directory payloads must not expose private roster constraints through public staff views. Existing endpoints and current KV keys are enumerated in [current state](current-state.md).

DATA-07 exports every key family with values, metadata, TTL/expiration, checksums and lineage; unknown/malformed records are quarantined, never silently dropped. DATA-08 rehearses deterministic transformation, isolated import, snapshot restore and old/new read comparison using tooling/fixtures; it can rehearse storage independently of future feature deployments. DATA-09 provisions production and cuts over selected slices, checking locally implemented slice artifacts explicitly. Complete tasks unrelated to a slice are not prerequisites. DATA-10 then automates and verifies the approved ongoing backup/export/restore procedures; a one-time migration snapshot alone is insufficient.

Migration flags/capability discovery, exact API routes, forward/back compatibility window, freeze/catch-up mechanism, and per-slice rollback thresholds are future deliverables, not existing controls. Choose them before activation. Keep changes additive until old consumers are verified; stage backend compatibility before frontend publication. Do not delete legacy KV on cutover. If new writes exist, reverting frontend/Worker code alone is insufficient: retain or reconcile those writes before restoring an old path.
