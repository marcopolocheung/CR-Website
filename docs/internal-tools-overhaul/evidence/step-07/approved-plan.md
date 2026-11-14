# Step 07 — Saved cash lookup and save recovery

## Summary

Implement Step 07 only, starting from merged main `68810bf` and the Step 06 checkpoint. Add a separate saved-day workspace that opens records for viewing first, as selected. Preserve the current cash draft while browsing.

Deliver a verified checkpoint and PR into `main`, then stop for review. Durable history, atomic revisions and retention changes remain Step 07b.

## Saved-day workspace

- Add retained `/internal/cash-history` workspace, selected under Cash in the shell. Link it from cash entry and Reports; keep all existing Bookkeeping links working.
- Provide store, lookup end-date and exact-day controls. Default to the 30 dates ending today; clearly label that lookup window and the service’s 31-day expiry after saving.
- Use `?store=CR2&date=YYYY-MM-DD` for direct links. Validate parameters before fetching; invalid links must not silently select another record. Links identify the current saved store/day, not an immutable historical revision.
- Open records read-only, showing store/date, saved timestamp, all drawers, comparisons and Extra money. Preserve existing paper values and English print behavior.
- Distinguish loading, populated, empty window, unavailable exact record and failed request. A 404 cannot distinguish “never saved” from “expired”; say so. Retry keeps filters.
- Do not display a saved preparer: the current service does not retain one.

## Draft-safe editing and save behavior

- Browsing never replaces, closes or checkpoints the active cash draft. Retain its fields, selected drawer and original raw Count/Amount metadata.
- “Edit a copy” explicitly identifies the destination store/date and requests a preparer label. Confirm and checkpoint any active cash draft before replacing its editor. Cancel or failed checkpoint leaves that draft intact.
- Add a scoped transition coordinator so this protection applies even when the cash editor is mounted but hidden behind lookup. Carry the selected record in memory; never place record payloads or credentials in URLs.
- Create a new device draft from the saved sheet, retaining the original saved record until an explicit save. Server counts without entry metadata retain their existing unknown-status semantics.
- Before saving, read the current store/day. If it exists, show its timestamp and require confirmation to replace it. If it changed since the editing baseline, show the newer saved copy beside the retained draft before permitting replacement. Failed preflight reads block replacement.
- Freeze each submitted payload. A response for an earlier edit/session cannot mark newer input saved. Report successful save separately from a subsequent history-refresh failure.
- After a timeout or other uncertain outcome, read the saved day before retrying. If it matches the attempted payload, report that match without another PUT. Otherwise preserve both copies and require explicit replacement confirmation; a missing record permits an explicit retry of the frozen attempt.
- State that the legacy service still allows concurrent overwrites: read-before-write comparison is not atomic conflict protection or server-side idempotency.

## Interfaces and compatibility

- Add a validated saved-record reader returning store, date, sheet, stored totals, saved timestamp and a comparison fingerprint. Preserve existing sheet-reader exports and HTTP wire contracts.
- Keep fingerprints as comparison identities, never server revisions. Reject malformed or mismatched records without replacing local work.
- Preserve existing draft schemas and keys. Store uncertain-attempt recovery in an additive, credential-free device envelope bound to draft ID and store/date; retain unreadable original bytes.
- Reuse Step 06’s editor and print content for record detail. Add a read-only presentation mode rather than duplicating cash calculations.
- Keep manager access in memory, existing authorization boundaries, fixed-$100 arithmetic and scheduler/public links unchanged. No Worker deployment, migration or policy activation.

## Verification and handoff

- Test CR2/CR3 lookup, direct links, invalid parameters, empty versus failed versus missing records, malformed responses and stale/out-of-order reads.
- Start a cash draft, browse other saved days, return unchanged, cancel editing another day, and exercise denied storage during the transition.
- Verify replacement confirmation, changed saved baseline, successful save/read-back, failed history refresh, lost acknowledgment with matching read-back, divergent retry and edits made during a pending request.
- Check blank versus zero, negative turn-in, all denominations, Extra money, legacy metadata, reload recovery, lock/expiry, EN/ES, keyboard, narrow/enlarged layouts and full-drawer print parity.
- Run cash/dashboard, recovery, draft, session, contract/i18n suites; relevant browser regressions; TypeScript, build and SEO. Use synthetic loopback APIs and retain REA evidence with its coverage limits.
- Record source identities, commands, screenshots, rollback and unverified gates in the Step 07 checkpoint. Keep Step 06’s physical-device review limitation open; do not claim live persistence or close the broader CASH-08 backend milestones.
