# IMPORT-03 — retained output and device recovery

Local CODE_ONLY implementation after IMPORT-02. No Worker, database, cloud resource, production mutation, shared import history or frontend publication is included.

## Workflow

Sales retains its prepared source review, selected context, acknowledgement and generated workbook. Hours retains validated source rows, selected period and generated workbook. Download generates the workbook once per unchanged working input; later downloads reuse exactly the same bytes and filename, including offline. Changing inputs invalidates the relevant reviewed/generated result. Successful exports never clear fields/files. An explicit Start next report confirms before clearing the current editor and restores focus to the first field. Saved device copies are preserved.

Replacing an existing source (or a recovered review) confirms before applying it. Cancel/Escape retains the original selected File, validation, reviewed values and cached output; the native file input is restored through DataTransfer where supported, with the working File state preserved as fallback. Cancelling the native picker also retains the previous working File. Generation freezes relevant inputs and coalesces duplicate submits.

## Optional device copies

Save a copy on this device stores a versioned payload through the shared UX-05 draft repository under complete task/store/date-or-period context. The label includes the entered preparer, saved UTC time and source filenames. A preparer label of 1–120 characters is required for saving; it is not an authenticated identity. Original upload File objects/bytes are not persisted. The device copy contains validated extracted values/review and, after generation, the exact workbook as base64 plus filename/SHA-256. A values-only sales copy may still need a connection to the existing template to generate its first output.

The UI distinguishes session memory, an acknowledged device copy, saved values without a workbook, storage denial and restored values. Copies are visible to other users of the same browser, are never labeled server saved, and remain after Start next report. No automatic expiry, shared attachment retention or disposal policy is introduced. A quota/read failure preserves current in-memory work and existing saved sources; the user can still download. Snapshot/source shape validation rejects unsupported schema, credentials/unknown fields, invalid values, conflicting context/figure values and mismatched output filenames. The generated-output checksum is verified before restored application/download; it detects damaged output bytes, not business approval or source authenticity.

Resume is explicit and warns before replacing current work. It verifies context and output, then restores values/cache without original uploads. Sales requires acknowledgement again; reprocessing needs reselecting originals. Each later save gets its own UUID/key and source lineage. Other tabs refresh available-copy lists via storage events without applying another editor's data. Original/corrupt/future records remain untouched with an original-source download. A late resume cannot override a newer context/snapshot.

## Evidence — 2026-10-24

- `npm run imports:test`: 31/31 PASS (14 source-validation, 9 review/parity, 8 snapshot/output tests). Includes schema/context/figure validation, null/zero, raw-source preservation, independent editor lineage, quota/read failure and serialized identical-byte/checksum verification. The existing real-template parity tests remain green.
- Dictionary tests: 3/3 PASS via `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`: PASS.
- Python Playwright/Chromium: all three final flows PASS — `test-import-retention.py`, `test-import-review.py`, `test-import-validation.py`.
- Retention browser flow verifies identical actual downloaded sales/hours hashes, repeat downloads offline, keyboard/Escape replacement cancellation restoring the native File, Spanish Start next cancel/confirm/focus, reload with no original uploads, explicit resume/re-acknowledgement, quota failure preserving working output and old copies, independent hours-editor UUIDs/source lineage, store/period isolation, Spanish 390px layout and unsupported raw-source preservation. Earlier review/validation browser scenarios still pass, including actual Excel cells, template failure/retry, stale reads, stale cash-out suppression, duplicate prepare/export, print return and denied storage.

Browser reproduction (installed Python Playwright/Chromium):

```bash
python3 /home/wslunusn/CR-Website/.codex/skills/webapp-testing/scripts/with_server.py \
  --server 'env NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- --hostname 127.0.0.1 --port 3017' \
  --port 3017 --timeout 60 -- \
  python3 scripts/test-import-retention.py http://127.0.0.1:3017
```

All browser requests are synthetic loopback; production Worker requests fail tests. Credentials never enter a snapshot. There is no new authorized server mutation or shared revision transport to verify. Existing language/control primitives are reused, and both screen locales preserve the same record values. English workbook mapping, formulas, styles, sheets and print setup remain unchanged.

## Handoff and rollback

Stop after opening this task's PR per the latest user instruction. Leave IMPORT-02 and IMPORT-03 unmerged with auto-merge off. No further task is claimed. The [service session](imports-session.md) records imports-first/cash-out-second intent and the scoped delegated date choices; their decision record and IMPORT-04/05 are future work when instructed. Shared identity, retention and schedule-comparison dependencies remain explicit for IMPORT-06/07/08. This PR does not finish the entire imports service.

Rollback: revert the scoped code and separately publish a compatible frontend if already live. Preserve all `cr-internal-draft:` keys, original source files and downloadable draft sources; do not remove copies to simulate a successful rollback. Older code may not render import payloads, but their source bytes remain available for later compatible readers. No backend migration or resource rollback is needed.
