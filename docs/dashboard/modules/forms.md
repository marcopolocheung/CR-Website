# Forms

`/internal/forms` provides digital records and the original eleven blank downloads.
The manager code unlocks a single searchable saved-forms table and five creation
buttons: employee write-up, injury report, customer complaint, payroll change
request, and pay rate increase application.

## Digital workflow

1. Choose a form, store, form date, and preparer. Start a draft or resume a device copy.
2. Complete the form. Drafts save on the device while typing, scoped by form type,
   store, and date; the manager credential stays in memory.
3. For the four new types, review the completed answers and choose **Save form**.
   This creates a permanent server record. Existing write-up saving remains compatible.
4. Open saved records to read or print them and update their manager-only label.
   Form answers are immutable. Print for any required handwritten signatures.
5. Use **Delete** on any table row or **Delete form** in an opened record. The
   confirmation identifies the form, person, and date. A successful deletion
   removes the document and the metadata used by every saved-forms list. Errors
   keep the record visible and allow retry; cancel and Escape do not delete it.

Search matches person, label, or store; type and date filters apply across all
five types. Complaints can be anonymous, and injury reports can describe an
employee, customer, or other injured person. Empty lists, no matches, loading,
and failed loads have distinct states. Device drafts and downloaded or printed
copies are separate from saved server records, as the deletion dialog explains.

## Storage and compatibility

- Existing write-ups retain their `/api/writeups` endpoints and `writeup:{id}` KV
  records. No migration or rewrite is necessary; DELETE is additive.
- New records use `/api/forms` and `form:{id}` in the existing `SCHEDULES` KV
  binding. A versioned document contains its type, form date, store, preparer,
  answers, manager label, and timestamps. There is no expiration.
- Key metadata contains only the list summary (type, date, person, store, label).
  There is no second table or separate index to leave behind when deleting.
  Lists paginate through KV; the browser merges them with write-up summaries
  and orders by date, newest first, then person.
- Reads, creates, label changes, and deletes all require the manager token.
  Mutations use the existing rate limit. Shared field definitions validate both
  editor payloads and Worker writes, including required fields, calendar dates,
  money, and checkbox choices. Unknown fields and credentials are rejected.
- Injury, complaint, and payroll fields follow the original templates. Pay rate
  applications use an employee number; SSNs are deliberately not collected.
  These saved requests do not automatically apply changes to payroll.
- KV list propagation can briefly lag writes. This is the same storage model as
  write-ups; the page keeps confirmed saves/labels visible and suppresses successfully
  deleted rows for the current session.

No new database binding, dependency, or migration is needed. Deploy the Worker
before the frontend so `/api/forms` and DELETE exist when the new page loads.
Use `npm run worker:build` to regenerate the self-contained dashboard paste file.
The Worker entry module exports only the handler; test helpers stay in `index.ts`.

## Implementation and verification

- `src/components/internal/WriteUps.tsx`: manager gate, merged table, existing
  write-up editor, label editing, and deletion confirmation.
- `src/components/internal/DigitalForm.tsx`, `src/lib/digital-forms.ts`: shared
  four-type schemas, editable/review/print views, and draft validation.
- `src/components/internal/FormDraftWorkspace.tsx`: reusable device draft workflow.
- `src/lib/digital-form-store.ts`, `worker/src/index.ts`: authenticated persistence.

Run `npm run forms:test`, `node --import jiti/register --test worker/src/index.test.ts`,
`npx tsc --noEmit`, `npm run worker:build`, `npm run build`, and `npm run seo:check`.
`scripts/test-digital-forms.py` exercises the complete local browser/Worker flow
with synthetic data, including reload/resume, review, print, labels, all five
kinds of deletion, cancellation, failed deletion/retry, and mobile widths.
The existing forms list, compatibility, and draft browser scripts remain valid.
