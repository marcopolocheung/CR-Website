# Plan: Step 14a — Company Files library + Imports link

## Context

The owner wants one central place for company files (mostly Excel/CSV/PDF), with folders and labels, tied into the internal tools. The decisions were approved and merged on 2026-11-27 in PR #204: `docs/internal-tools-overhaul/files-library.md`, `tasks/DEC-03-FILES.md`, and the guide's "## 14a" section.
- One library for CR2 and CR3; each file is tagged with a store.
- Anyone with the manager code can view and add. Typed names are labels, not identity.
- Keep everything forever. No sensitive documents. 25 MB limit and an allow-list of file types.

Step 14 (PR #205) is merged and deployed, so the shared shell and route group exist. 14a implements DATA-06 locally and links Imports. 14b (Forms, Cash close, Inventory) is not part of this step.

Like every D1/R2 feature here, it is **local-only until the owner provisions production D1/R2**. The Worker reports `backend_unconfigured`, and the UI says storage isn't set up. No deploy, remote D1 or secrets changes.

## Setup

- New worktree `/home/unusn/CR-step14a`, branch `feat/overhaul-step-14a-files`, from current `origin/main` (includes #204 and #205). Edits there need the sandbox bypass, as with the earlier worktrees.

## Backend

**Migration `worker/migrations/0004_files_policy.sql`**
- One `INSERT INTO policy_versions` for `('DEC-03','attachments-v1','owner', '2026-11-27T00:00:00Z', <json>)`.
- The JSON holds: family `attachment`, retention forever, all versions kept, trash kept, `maxBytes` 26214400, and the type allow-list.
- No table changes. `worker/setup/` is untracked, so nothing is mirrored there.

**`worker/src/record-mutations.ts`**
- Add an optional 5th parameter, `projections?: (guard: { sql: string; binds: unknown[] }) => D1PreparedStatement[]`.
- Its statements are appended to the existing `db.batch([claim, insert, update, event])`.
- Each one uses the existing `claimExists` condition (`EXISTS (SELECT 1 FROM mutation_operations WHERE ${receiptWhere})` with `identity` binds), so it only applies when the claim succeeds, and a failure rolls back the whole batch.
- Existing callers are unchanged.

**`worker/src/files.ts`** follows the shape of `worker/src/import-history.ts`.
- **Document:** a `records` row with family `attachment`, id `doc_<uuid>`, undated context. `data`:
  `{name, folder, labels[], links[{kind,key}], currentVersionId, trashedAt|null, addedBy}`.
- **Version:** an immutable `records` row (id `ver_<uuid>`, revision 1) plus an `attachments` row: `object_key files/<store>/<ver>`, filename, media_type, byte_size, sha256, `status 'available'`, `policy_version 'attachments-v1'`. Both are written through `projections` inside the document's `mutateRecord` call.
- **Writes:** use `callerScope:'manager'`, action `upload` / `replace` / `update` / `trash` / `restore`, and actor `{kind:'entered-label', label: addedBy}`.
- **Reads:**
  - `filesPage(db, {folder,label,store,q,trash,link,cursor})`: both stores, newest first, 50 per page. The link filter uses `json_each`.
  - `fileRecord(db, store, docId)`: the document, its versions (from `attachments`) and its activity (`change_events` for the document: action, actor label, time).
- **`reconcileFiles(env, {remove?})`:** lists R2 `files/` keys with no `available` row. `remove` deletes only keys older than 24 h.

**Routes in `worker/src/index.ts`**, next to the import-history block and using the same pattern:
- Every route goes through `managerAuthError`, returns `no-store`, and returns 503 `backend_unconfigured` if `!env.INTERNAL_DB || !env.ATTACHMENTS`. Writes use `checkWriteThrottle`.
- Add `ATTACHMENTS?: LocalBindings['ATTACHMENTS']` to `Env`. Add `X-File-Meta` to `Access-Control-Allow-Headers` (line ~1253).

| Route | Behavior |
|---|---|
| `GET /api/internal/files` | `filesPage` |
| `GET /api/internal/files/(CR2\|CR3)/doc_…` | `fileRecord` |
| `PUT /api/internal/files/(CR2\|CR3)/doc_…/content` | New file or replacement. Raw body; base64url JSON in `X-File-Meta`: `{operationId, baseRevision, versionId, name, folder, labels, links, addedBy, sha256, type}`. |
| `POST /api/internal/files/(CR2\|CR3)/doc_…` | Metadata-only mutation: rename, move, labels, trash, restore |
| `GET /api/internal/files/(CR2\|CR3)/versions/ver_…/content` | Download with `Content-Disposition: attachment; filename*=UTF-8''…`, `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff` |

**Upload sequence**
1. Validate the metadata with the shared `src/lib/files.ts` rules. Check that `Content-Length` is at most 25 MB.
2. Read the body (25 MB fits in Worker memory) and compute SHA-256 with `crypto.subtle.digest`. Reject a mismatch or wrong size with 400, storing nothing.
3. `ATTACHMENTS.put(key, bytes, {httpMetadata:{contentType:'application/octet-stream'}})`.
4. Run `mutateRecord` with projections.
5. On a 409, best-effort delete the object and return `revision_conflict` with `currentRevision`.
6. On an uncertain error, leave the object for `reconcileFiles`. A same-operation retry replays (same key, so the identical bytes overwrite).

## Shared rules: `src/lib/files.ts`

- `FILE_TYPES` (xlsx, xls, csv, pdf, docx, doc, png, jpg/jpeg, heic → MIME), `MAX_BYTES`.
- `fileName()` sanitizer: no path separators or control characters, at most 200 characters.
- `folderPath()` normalizer: `/`-separated segments of 1–40 characters, at most 5 deep, trimmed.
- `labelsList()`: at most 10 labels of at most 40 characters, deduplicated case-insensitively.
- `linkKey()` for the `import`, `form`, `writeup`, `cash-close`, `inventory-count` kinds.
- `validFileMeta()`.
- `src/lib/files.test.ts` is added to a new `files:test` script, and that script is added to `check`.

## Frontend

- **API client `src/lib/files-api.ts`:** JSON calls through `requestJson` (`src/lib/cashout-store.ts`), errors mapped like `importFailure` in `src/lib/converter/import-api.ts`.
  - Upload and download use `fetch` with `getScheduleApiBase()`, `Authorization: Bearer`, the `managerSession.capture(token)` check, and a timeout.
  - The client computes SHA-256 as `HoursConverter.tsx:95` does. Download goes blob → object URL → `<a download>` click → revoke.
- **Navigation:** add `{id:'files', icon:'layers', href:'/internal/files'}` to `destinations` in `src/components/internal/InternalShell.tsx`, plus `section` detection for `/files`. It reuses the existing `layers` icon, so the shared icon set is unchanged.
- **Route:** `src/app/(order-shell)/(internal-tools)/internal/files/page.tsx`, returning `null` with metadata, like `forms/page.tsx`.
- **Registration:** add `files` to `tools` in `src/components/internal/WorkspaceHost.tsx`.
- **`src/components/internal/FilesWorkspace.tsx` + `files-workspace.module.css`**, built from `InternalTheme`, `Paper`, `Button`, `Field` (`src/components/internal/ui/controls.tsx`) and the confirmation/feedback helpers already used by Forms:
  - Locked state uses the shared unlock pattern from other workspaces. `backend_unconfigured` says "File storage isn't set up yet", never shows an empty library.
  - Folder list (stacked on phone), then a table: name, labels, store, updated, "added by … (entered)". Filters: label, store, search, Trash.
  - **Upload** (red primary) opens a form: file, store (required, remembered on the device as a preference), folder, labels, your name (remembered as a label only).
  - Detail panel:
    - Download.
    - Replace. On a 409, a named dialog: "Changed since you downloaded it", with **Download latest** or **Upload as new version anyway**. The second resends with the current revision only on that click.
    - Rename, move and edit labels.
    - Versions, each downloadable, and the activity list.
    - Move to trash, with an undo toast, and Restore.
  - Retry keeps the same operationId after an uncertain result, as Imports does.
- **`src/components/internal/RelatedFiles.tsx`:** props `link`, `storeId`, `folder`, `labels`, optional `sources: File[]`.
  - Lists linked files (lazy `GET ?link=`) with download.
  - "Save source file to Files" uses the held `File`, the preset folder/labels/link and the preparer name.
- **Imports link:** pass the held sources from `SalesConverter` (`files` map, line 60) and `HoursConverter` (`csvFile`, line 55) into `ImportHistory`.
  - After `putHistory` succeeds (`ImportHistory.tsx:43`), render `RelatedFiles` for `import:<saved.id>`, folder `Imports/Sales` or `Imports/Hours`, label `sales` or `hours`.
  - `ImportHistoryRecordCard` gets a "Source files" disclosure (lazy list).
  - Import saves and records are otherwise unchanged.
- **Text:** `src/lib/internal-tools/i18n/files.ts` exporting `filesEnglish` / `filesSpanish`, spread into `en.ts` / `es.ts` like `special-hours.ts`. Add `shell.files`. `i18n.test.ts` checks parity.

## Tests (new, plus the one pre-approved edit)

- **`worker/src/files.test.mjs`** follows `worker/src/special-hours.test.mjs`: `getPlatformProxy` with local D1+R2, migrations 0001–0004, `worker.fetch` through jiti. It covers:
  - upload, list and byte-exact download with the checksum
  - rejecting a bad type, size, checksum or missing name, with nothing stored
  - two replaces from the same base: one succeeds, one gets 409, the object is cleaned up
  - an identical retry replays
  - a forced projection failure rolls back the document, receipt and event
  - trash/restore keeps every version
  - the `?link=` filter
  - 401 without the code; `backend_unconfigured` without bindings
  - reconcile reports an orphan

  Add it to a `files:worker:test` script and to `check:full`. `data:test` must still pass.
- **`scripts/test-internal-files.py`** follows the `test-scheduler-workspace.py` interception style (synthetic fixtures, external requests blocked). It covers:
  - upload xlsx/csv/pdf; reject .html/.exe/oversize
  - the two-tab replace conflict with both choices
  - version download, trash/restore/undo, folder/label/store filters
  - the not-set-up state
  - the import source-file save and its history disclosure
  - Spanish, keyboard only, 375/768/1440/320-enlarged screenshots, zero page errors
- **Pre-approved edit:** `scripts/test-internal-shell.py:88`, `count()==6` → `7` (and "six" → "seven" in the line 95 record), plus Files in its destination walk if one exists. No other existing test is edited.

## Docs

- `checkpoints/step-14a.md` from the template, with evidence under `evidence/step-14a/`.
- Guide progress row 14a.
- DATA-06 brief and tracker: implementation and local verification done, status `implemented`.
- `worker/LOCAL_DATA.md`: the Worker now consumes `ATTACHMENTS`; the next migration is 0005.
- Regenerate `worker/dashboard.js` with `npm run worker:build`, as earlier Worker features did.

## Verification

1. `npm run check` (with `files:test`) and `npm run check:full` (with `files:worker:test`; `data:test` green after the projections change).
2. `npm run worker:build`, then review the `dashboard.js` diff.
3. Build with loopback APIs: `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790 NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`, then `npm run seo:check`.
4. Browser runs: `test-internal-files.py`, plus the existing shell, session, primitives and import scripts (`test-import-*`/history as present), plus the scheduler workspace script as a shell-regression guard. All run against `scripts/overhaul-baseline/serve.py --port 3052` with `/tmp/cr-step13-venv` and `LD_LIBRARY_PATH=/tmp/cr-step13-browser-libs/...`.
5. Optional real persistence check: `npm run worker:dev:local` with a synthetic token, `--persist-to` a temp directory, upload/download once.
6. Inspect the Files screens at phone and desktop widths myself.
7. Commit on the branch, open a PR, stop for review. No merge unless asked.

## Out of scope

- 14b panels (Forms, Cash close, Inventory).
- Editing in the browser, sharing, per-folder permissions, logins, purge or empty trash, moving files between stores, sensitive documents.
- Any production provisioning or deploy.
