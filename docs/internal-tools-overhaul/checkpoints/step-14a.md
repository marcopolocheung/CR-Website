# Step 14a checkpoint: company Files library and Imports link

## Scope and baseline

- **Step:** 14a. Implements [DATA-06](../tasks/DATA-06.md) for the [company Files library](../files-library.md) under [DEC-03-FILES](../tasks/DEC-03-FILES.md).
- **Date / owner:** November 27, 2026. Claude.
- **Source:** branch `feat/overhaul-step-14a-files`, worktree `/home/unusn/CR-step14a`, from main `2516593` (Step 14 merged in PR #205; plan merged in PR #204).
- **Approved contract:** [approved-plan.md](../evidence/step-14a/approved-plan.md).
- **Design:** Night shift bank v1.0, Layered paper, Patina teal, moving red navigation.
- **APIs:** static export built with loopback `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`. Browser scripts intercept the API with an in-memory Files fake that enforces the Worker's size, checksum and revision rules. Worker behavior is verified separately against real local D1 + R2 (`getPlatformProxy`).

**What changed:**
- **Files in the shell:** a Files destination (shared unlock, red navigation highlight, English/Spanish) with:
  - one library across CR2 and CR3, folders, labels, a store filter, name search and a trash view
  - upload: Excel, CSV, PDF, Word or photos, at most 25 MB
  - a detail panel: download, replace (keeps every version), rename/move/relabel, move to trash with **Undo**, restore, versions and activity
  - a named conflict prompt, "Changed since you downloaded it", with **Download latest** or **Upload as new version anyway**
- **Imports link:** saving an import uploads nothing new. On the saved import's history card, **Source files → Save original.csv to Files** stores the exact original spreadsheet, linked `import:<record id>`, in `Imports/Sales` or `Imports/Hours`. Every import history card, in the converters and on the history page, lists its linked files.
- **Backend:**
  - Migration `0004_files_policy.sql` seeds policy `DEC-03 attachments-v1`.
  - `mutateRecord` gains optional guarded `projections`, which run in the same D1 batch and apply only when the receipt claim succeeds.
  - New `worker/src/files.ts` and five `/api/internal/files` routes behind the existing manager gate and write throttle. They report `backend_unconfigured` without `INTERNAL_DB` + `ATTACHMENTS`.
- **Shared rules:** new `src/lib/files.ts`, used by both Worker and client: allow-list, limits, name/folder/label/link normalization, header encoding.
- **Bundle:** `worker/dashboard.js` regenerated with `npm run worker:build`. It only adds the Files code; no existing function was removed.

Typed names are stored and shown as entered labels ("Maria (entered)"), never identity. Retention is forever: nothing purges files, versions, trash or activity.

## Gates

| Gate | State | Evidence or reason |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Files library, Imports link and Worker service as planned. |
| Local automated checks | pass | `check:full` 468/468 in 14 suites; type check, tracker, build, SEO, `worker:build`. |
| Browser scenarios | pass | 9 of 9 scripts: new Files script plus shell, session, primitives, four import scripts and scheduler workspace. |
| Visual and task review | pending owner | Screens in [evidence/step-14a/screens](../evidence/step-14a/screens/). Reviewer inspected 1440px and 375px. |
| Owner review before 14b | pending | PR to be opened into main; stop without merging. |
| Backend/policy readiness | pending external | DEC-03-FILES approved. Production needs owner-run D1 + R2 provisioning, migrations 0001–0004 and binding review (DATA-03, REL-03, DATA-09). Until then the deployed site shows "File storage isn't set up yet." |
| Physical device, staff acceptance, live verification | pending | Browser emulation and local runtime only. |

## Scenario evidence

| Scenario | Expected | Observed |
| --- | --- | --- |
| Upload xlsx/csv/pdf across both stores | Exact bytes stored; folder/labels normalized; listed | Pass. `" Ordering / Suppliers "` → `Ordering/Suppliers`; labels deduplicated. |
| `.html` and a 25 MB + 1 byte file | Refused locally, no request | Pass. Worker also rejects disallowed types, wrong size, wrong checksum and missing name with nothing stored. |
| Filters | Store, label, folder, name each narrow results | Pass. |
| Download | Exact bytes and original filename | Pass in browser; Worker sends `attachment`, `octet-stream`, `nosniff`. |
| Two replaces from the same revision | One saves, the other gets 409; loser's object removed; nothing lost | Worker: pass. Browser: the named prompt appears; Download latest and Upload anyway both work; 3 versions remain. |
| Retry after an uncertain response | Same operation replays once | Worker: identical upload and trash retries return `replayed: true`. |
| Failure partway through the save | Document, receipt, history and version rows all roll back | Pass (forced policy-row removal); `reconcileFiles` reports the orphaned object. |
| Rename/move, trash, Undo, restore | One activity entry each; trashed files keep all versions | Pass; activity reads upload → replace ×2 → update → trash → restore → trash. |
| No storage bindings | "File storage isn't set up yet", no upload control | Pass (Worker 503 `backend_unconfigured`; UI message). |
| Manager gate | Wrong code refused | Pass (401). |
| Import save, then Save source | Import save makes no Files request; explicit save links the exact file | Pass. The existing IMPORT-07 "no raw upload" test still passes unchanged. |
| Widths and language | No horizontal overflow at 1440/768/375 and 320px enlarged Spanish; keyboard opens upload | Pass. |

## Checks actually run

Logs are in [evidence/step-14a/checks](../evidence/step-14a/checks/).

| Command | Result |
| --- | --- |
| `npm run check:full` | pass: 468 tests in 14 suites, including new `files:test` (6) and `files:worker:test` (6); `data:test` 10 still green after the projections change |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | pass (9), English/Spanish parity |
| `npm run worker:build` | pass; additions only |
| Loopback build (`NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 …`) and `npm run seo:check` | pass; `/internal/files` exported |
| `test-internal-files.py` | pass, 7 groups |
| `test-internal-shell.py` (owner-approved 6 → 7 destinations, Files added to the keyboard/pointer walk), `test-internal-session.py`, `test-internal-primitives.py` | pass (11 / 14 / 11 scenarios) |
| `test-import-history.py`, `test-import-history-hub.py`, `test-import-retention.py`, `test-import-comparison.py` | pass, unchanged |
| `test-scheduler-workspace.py` (shell regression) | pass |

Browser runner: `/tmp/cr-step13-venv/bin/python` with `LD_LIBRARY_PATH=/tmp/cr-step13-browser-libs/root/usr/lib/x86_64-linux-gnu`, static export on `serve.py --port 3053`, zero page errors or external requests.

## Defects found during verification and fixed

- An ambiguous `id` column in the labels facet query (`json_each` has its own `id`), caught by the Worker test.
- Success and trash messages wiped by the list reload that follows; now only stale load errors are cleared, and the empty state renders separately (`FilesWorkspace.tsx`, `RelatedFiles.tsx`).

## Recovery and remaining work

- **Rollback:** remove the Files destination and panel. Keep all D1 rows and R2 objects, because retention is forever. Migration 0004 only inserts a policy row; correct it forward, never drop it. Existing import records are unchanged.
- **Production activation (owner only):** provision D1 and R2, apply migrations 0001–0004, bind `INTERNAL_DB` and `ATTACHMENTS`, review per REL-03. No agent deployed or ran remote commands.
- **Cosmetic, not fixed:** on phones the seventh navigation item (Files) sits alone on a third row.
- **Limits by design:**
  - Empty folders don't exist (a folder appears once a file uses it).
  - Search matches names only.
  - Facets and link lookups scan JSON; fine for hundreds of files, to revisit past about 10,000 (code comment marks it).
- **Next:** Step 14b adds `RelatedFiles` to saved forms/write-ups, cash closes and CR3 inventory counts. It has not begun.
