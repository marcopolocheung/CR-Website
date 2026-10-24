# DATA-01 contract v1

The executable source of truth is [contracts.ts](../../src/lib/internal-tools/contracts.ts); [compatibility.ts](../../src/lib/internal-tools/compatibility.ts) contains additive adapters. This is a local contract, not a deployed service. Existing Worker routes and all existing clients remain unchanged.

## Wire boundary

New service routes use `/api/internal/v1/<service>`; individual service owners specify verbs, authorization and payload validators before adding a route. The reserved read-only discovery route is `GET /api/internal/v1/capabilities`. It is not implemented or advertised by the current Worker. A v1 manifest has `schemaVersion: 1` and a `services` map. Each advertised service supplies integer `readVersions`/`writeVersions` and boolean `atomicRevisions`/`idempotentOperations`. Empty versions mean unsupported. Bindings, types, or a health response never establish support. A v1 client may enable new writes only with explicit v1 write support AND both guarantees; policy and authorization checks still apply. Adding a known service/read version is additive. Unknown services are ignored; an unknown schema is unavailable until supported.

Discovery 404 selects the legacy reader; timeout, auth failure, 5xx, malformed response, or an unsupported schema produces unavailable, retaining the user's in-progress data. No uncertain new write is retried through a legacy endpoint. The consumer owns transport; the decoder is pure and never fetches the production fallback.

Existing `/api/weeks`, `/api/schedule`, employees/template global/week inheritance, staff/undo, cash-out, inventory and write-up endpoints keep their exact shapes. `restaurant` continues to identify a station, with omitted/empty default CR3-diningroom. `preserveLegacy`/`restoreLegacy` wrap and restore the full original body, including ciphertext, hidden weeks, unknown fields, historical text and unresolved raw counts. They do not manufacture IDs, business dates, cents, or atomic revisions. This is intentionally lossless; conversion into a new business record requires the domain validator and a lineage mapping. Public projection must keep private roster constraints out of staff views.

The compatibility window remains open until DATA-09 records old/new-reader parity, release manifest, rollback and reconciliation evidence and DEC-03 authorizes archival. No deletion date or permission to remove KV is implied. A v1 contract error has stable `error.code`, optional field paths/parameters, current revision, and decision ID; it has no translated message or credentials. HTTP status is defined by `ERROR_STATUS`. Legacy failure translation retains the original response for recovery; consumers must redact protected input before logs.

## Scalars and contexts

Store/station mapping is explicit. New employee/record/operation IDs are assigned opaque ASCII identifiers (1–128 characters, alphanumeric first, then alphanumeric/underscore/hyphen); a legacy ID remains in lineage instead of being guessed from a name. IDs are scoped by family/store at persistence boundaries. Dates validate the actual Gregorian day from year 0001 through 9999 without deriving a working day from an event timestamp. UTC timestamps use canonical `YYYY-MM-DDTHH:mm:ss.sssZ`. Revision is a nonnegative safe integer: 0 is a missing-record/create precondition, stored records start at 1. Services enforce monotonic increments and refuse exhausted revisions. Money is signed safe integer USD cents, without string/blank coercion; missing stays null and measured zero stays zero. UI numeric entry rules remain DEC-07's responsibility.

Record context distinguishes a business day, inclusive period (service validator requires start <= end), and undated records. Station/store consistency is required at a service boundary. Record envelopes retain immutable created time, updated time, family and typed data. Source snapshots and names/narratives remain unmodified for export/print.

Mutation identity is `(authorized caller scope, store, family, record ID, action, operationId)`. A retry must reuse identical canonical request content; success replays its authoritative original result. Different content rejects `operation_reused`; stale base revision rejects `revision_conflict` without altering data or history. Validation, conditional update, revision increment and audit event must share one D1 transaction (DATA-05). None of these guarantees applies retroactively to KV. An entered preparer label is distinguished from authenticated actor identity.

## Explicit policy gaps

| Field group | Owner | Until approval |
| --- | --- | --- |
| Store timezone, rollover, week boundary, overnight ownership | DEC-01 | No timestamp-to-business-date conversion |
| Starting cash, financial adjustments, reviews/corrections | DEC-02 | Versioned policy gate unresolved; no new calculation or transition |
| Retention, attachment formats/limits | DEC-03 | No automatic disposal or upload enabling |
| Rehires, memberships, temporary cashiers, hour targets | DEC-04 | Unmapped employee reference with original source ID/scope/name |
| Stock units, packs, quantity representation, waste/transfers | DEC-05 | Raw quantity and explicit unresolved unit; no decimal/rational conversion selected |
| Signature/review workflow and next form | DEC-06 | No approval inferred from entered names or printed lines |
| Money entry, final terminology, print language | DEC-07 | No separator reinterpretation or approved terminology claim |

`PolicyGate` carries the decision ID, and an approved gate requires version, approver and UTC approval time. These are representation requirements, not proof of an approval; the decision brief remains authoritative. No approved fixture is supplied. `CountResponse` keeps uncounted, measured-zero, measured, Enough and skipped distinct. Attachment references expose parent/revision/status without R2 keys or secrets. Import identity retains fingerprint, store/date or period, source slot and parser/mapping version.

## Local acceptance and recovery

Run `node --import jiti/register --test src/lib/internal-tools/contracts.test.ts`. Synthetic fixtures cover invalid/leap dates, safe cents/revisions, opaque IDs, all station defaults, capability negotiation, lossless encrypted/public/roster/template/cash/count/form payloads and policy/error examples. Existing scheduler/Worker and cash-out suites verify legacy behavior independently.

A revision conflict example keeps the original legacy `{error: 'conflict', rev: 4, updatedAt: 'source-time'}` beside the stable v1 error. A failed discovery never changes or clears source input; the rejected input is available to copy/reload/compare in consuming UI tasks. Reversal is removal/revert of these unused additive modules; no business record or existing draft is rewritten. Keyboard/touch, shared-device storage and print rendering are unaffected: these modules introduce no UI, storage, credentials, gesture, or print output. Consuming owners must preserve those behaviors when wiring the contracts. English/Spanish consumers share the same IDs/enums/error codes; UX-01 owns translated labels.
