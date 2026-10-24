# Labeled drafts and handoff (UX-05)

`src/lib/internal-tools/drafts.ts` is the shared versioned draft repository; `DraftChooser.tsx` supplies explicit resume/new/recovery controls. Cash-out is the first consumer, validated through an explicit whitelist in `cashout-draft.ts`. A draft is local working data, separate from a submitted/reviewed business record. Nothing is uploaded by draft save, resume or handoff.

## Stored contract and context

Version 1 stores ID, optional source ID, task, store, either business date or inclusive period, optional station/shift/record ID, entered preparer label, created/updated UTC time, nullable known server revision and typed JSON payload. Every context dimension is in the encoded key. Unsupported/extra context fields are rejected, so they cannot be silently ignored. Dates are validated without deriving a business day from event time. Legacy cash endpoints have no revision, so the known server revision stays null rather than implying a revision guarantee.

Names, invalid-but-readable source money strings, original text and numeric zero stay unchanged. Persisted state is language independent. Preparer is an entered label, not an authenticated identity or signature. Cash-out excludes credential-bearing properties and projects only AM/PM cashier names/counts/Toast plus Z input; generic storage also rejects credential-bearing keys, cycles, nonfinite/lossy JSON and unsupported objects. Manager/staff tokens stay in existing in-memory gates.

An explicit Start new creates a fresh ID and empty domain payload after the user chooses context and enters a preparer label. Resume as a copy clones the selected payload to a new ID with source lineage and the current entered preparer. The original source key/bytes remain intact. Separate editors always get independent working IDs; a storage event can refresh the chooser but never replaces an active editor's fields. This avoids claiming atomic cross-tab compare/write guarantees from localStorage. Context cannot be reassigned while an editor is active: choose another draft first, then explicitly resume or start new in the target context.

## Recovery and schema compatibility

Reads distinguish available from unavailable; denied/partial storage is never reported as an empty successful list. Corrupt, invalid and unsupported-version entries expose original-source download and remain untouched. Saving refuses to overwrite an unreadable source. No delete/expiry/automatic disposal API is exposed; DEC-03 remains unapproved.

The defined v0 fixture format is version 1 minus sourceId/createdAt. Its reader can upgrade in memory using its existing update time; resume writes a new v1 ID/key and preserves original bytes. This is a verified compatibility fixture, not a claim that a v0 feature was previously deployed. Other formats are not guessed. The older application's unscoped `cr-cash-out` source stays unassigned and can be downloaded; it is never automatically given today's store/date. CASH-01 owns the remaining explicit context-assignment workflow and its complete four-context/late-load acceptance.

Draft writes happen on an edit before a context/handoff action can unmount the editor. Failure keeps the latest working copy in memory and available for download, preserves any last successful stored bytes, and shows device-save failure. The displayed saved time advances only after successful storage. Choose another draft / Save draft and lock require a successful local save; a failure leaves the editor and its values open. A successful handoff saves then clears the existing manager session and focuses its gate. It preserves unrelated mounted converter work; it does not redesign authentication. Downloading a working copy is a deliberate local recovery action, never a backend attachment upload.

No financial rules, calculations, submitted state, form signatures, record retention, station membership, output policy or cloud resource is approved by this task. Paper cash-out context/figures and workbook mappings remain compatible; draft chooser/handoff controls are hidden in print. Screen English/Spanish switching keeps active payload/context/ID unchanged.

## Local acceptance evidence

`node --import jiti/register --test src/lib/internal-tools/drafts.test.ts` passes six scenarios: complete context isolation including periods; independent forked resume and retained source; corrupt/future-source protection without disposal; defined v0 upgrade by copy; denied read/write distinction; and rejection of credentials, renamed contexts and malformed cash payloads. Combined contracts/dictionaries/drafts: 15 tests pass.

`python3 scripts/test-internal-drafts.py http://127.0.0.1:3017` passes against a local Next dev server with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`. All backend requests are mocked with synthetic data and production Worker requests rejected. It verifies explicit new/resume choice, labeled context/preparer/time, empty new payload, focus transfer, language/touch, separate working copies for two editors, unchanged original/legacy bytes, corrupt/future-source download, quota failure preserving current values, current-copy recovery download, and successful save/lock with token absent from storage/downloads. The UX-01 and UX-03 browser regressions also pass after adapting their setup to the explicit chooser.

TypeScript, static build, SEO and existing cash-out/dashboard/inventory tests pass. No staging publication, deployment, remote resource, production mutation, staff observation or live verification occurred. Final Spanish/output approval remains DEC-07; frontend publication remains REL-04.

Rollback is revert of scoped repository code, leaving both new draft keys and the older unscoped source preserved. Do not delete drafts during rollback. A prior frontend will ignore new keys; use the local original/working-copy downloads to preserve data until a compatible reader is restored. Next consumers should reuse the repository/chooser and domain validators, never serialize access tokens or fabricate missing context.
