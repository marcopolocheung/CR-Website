# Company Files library (Steps 14a and 14b)

The owner approved these decisions on 2026-11-27. [DEC-03-FILES](tasks/DEC-03-FILES.md) records them as a scoped child of DEC-03, and [DATA-06](tasks/DATA-06.md) implements the storage. This document is the plan only. No code, migration, binding or deployment exists for it yet.

## Why

Managers want one central place for company files, mostly Excel, CSV and PDF. It needs folders and use-case labels and has to connect to the internal tools. A third-party shared drive was considered and rejected because staff would not use it.

## Owner decisions

| Topic | Decision |
| --- | --- |
| Scope | One library shared by CR2 and CR3. Each file belongs to one store, chosen at upload (default: the current working store). Store is a filter, not a wall. Files cannot move between stores. |
| Access | Anyone who has unlocked the internal tools with the manager code can view, add, replace, rename, move, label, trash and restore. No staff or public access. |
| Names | "Added by" is a typed name kept as an entered label. It is never identity, never authorization and never treated as verified. |
| Retention | Keep everything forever: current files, every version, trashed files and the activity log. No automatic purge and no "empty trash". |
| Content | Company working documents only. No SSNs, medical, bank or ID documents for now. |
| Limits | 25 MB per file. Allowed: xlsx, xls, csv, pdf, docx, doc, png, jpg/jpeg, heic. Files are always served as downloads, never rendered on the site's domain. |
| Integrations | Imports (Step 14a); Forms & write-ups, Cash close and Inventory counts (Step 14b). |

The Imports integration lets a manager deliberately save the original spreadsheet. That narrows DEC-03-IMPORT's "no raw uploads" limit, but only for this optional, manager-initiated save into Files. Import history itself still stores reviewed values and fingerprints, exactly as before.

## Design summary

- **Document:** a `records` row in family `attachment` (id `doc_<uuid>`, store CR2/CR3, undated context). Its data holds name, folder path, labels, links, current version, trashed time and entered name. Every change goes through `mutateRecord`, so it gets a revision, 409 conflicts, idempotent retries and one immutable `change_events` entry. That entry is the activity log.
- **Version:** an immutable `records` row (id `ver_<uuid>`) plus an `attachments` row: private R2 key `files/<store>/<ver id>`, filename, media type, size, SHA-256, `available`, policy `DEC-03 attachments-v1`. Both are written as guarded projections inside the document's single D1 batch.
- **Folders** are path strings on documents; empty folders do not exist in this slice.
- **Links** are references to existing tool IDs (`import:<id>`, `form:<id>`, `writeup:<id>`, `cash-close:<store>:<date>`, `inventory-count:CR3:<date>`). They are not foreign keys, because forms, cash and inventory still save to KV.
- **Migration 0004** seeds the `policy_versions` row for DEC-03 `attachments-v1`. No table is rebuilt.
- **Worker routes** live under `/api/internal/files`, behind the existing manager gate and write throttle. They answer `backend_unconfigured` when D1 or R2 is not bound. Uploads write to R2 with checksum verification, then commit the D1 batch. A 409 deletes the just-written object. An uncertain outcome leaves it for reconciliation.
- **Frontend:**
  - A Files destination in the internal shell, with a folder list, a file table, filters, upload, a detail panel (versions, activity, rename/move/labels, trash/restore) and a named conflict dialog.
  - A shared `RelatedFiles` panel for the tool integrations.
  - English and Spanish text.

The full implementation plan, including files to touch and test scenarios, is in the Step [14a](implementation-guide.md#14a-add-the-company-files-library-and-imports-link) and [14b](implementation-guide.md#14b-link-files-from-forms-cash-close-and-inventory) sections of the implementation guide.

## Acceptance scenarios

1. Upload xlsx, csv and pdf; download each and confirm the bytes match. A disallowed type, an oversize file, a wrong checksum or a missing name is rejected with nothing stored.
2. Two managers replace the same file from the same revision: one succeeds, the other sees "Changed since you downloaded it" with Download latest / Upload as new version anyway. No version is lost.
3. An identical retry after an uncertain response replays the original result. A failed projection rolls back the document change.
4. Rename, move, relabel, trash and restore each add one activity entry. Every version stays downloadable, including those of trashed files.
5. Without D1/R2 bindings, every Files screen says storage is not set up, never an empty library.
6. Reconciliation reports an R2 object with no available attachment row.
7. Linked files appear on the saved import (14a) and on the saved form/write-up, cash close and inventory count (14b). Those tools' saves and math are unchanged.

## Release gates

Local completion does not make the feature live. Production needs owner-run D1/R2 provisioning and binding review ([DATA-03](tasks/DATA-03.md), [REL-03](tasks/REL-03.md), [DATA-09](tasks/DATA-09.md)), then frontend publication ([REL-04](tasks/REL-04.md)). Agents do not deploy, run remote D1 commands or change secrets.

## Rollback

Hide the Files destination and panels. Keep D1 rows and R2 objects: retention is forever, so nothing is deleted on rollback. Activated migrations are corrected forward, never dropped.
