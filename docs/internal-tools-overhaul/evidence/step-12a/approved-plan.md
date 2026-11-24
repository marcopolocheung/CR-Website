# Step 12a — Separate inventory counting, checklist, catalog and history

## Summary

Build on fresh `main`—currently `88098c0`—and retain the approved Night shift design. Give CR3 managers four focused views within the existing inventory workspace: **Count**, **Order checklist**, **Catalog** and **History**.

Selected defaults: one retained workspace, read-only saved-day lookup plus comparison, and familiar full-report printing with an additional checklist-only print action.

This is a frontend slice. Persisted purchase orders, receiving, supplier delivery, structured units/conversions, CR2 inventory and durable count sessions remain outside Step 12a.

## Views and navigation

- Keep `/internal/inventory`, its trailing-slash and `.html` variants. Use `#count`, `#orders`, `#catalog` and `#history` for linkable views; absent or unknown hashes open Count. Support browser Back/Forward, keyboard navigation and heading focus.
- Keep one controller in `Inventory.tsx` owning working counts/date, captured catalog, skips, catalog draft and request guards. Changing views preserves work and filters without saving, discarding, remounting the controller or changing the count date. Existing context-change and lock protections remain active.
- Retain the main Inventory navigation item and moving red highlight. Use a responsive local view selector rather than adding global navigation destinations.

| View | Behavior |
| --- | --- |
| **Count** | Retain Step 11’s rows, six count states, stable progress, search/section/Remaining/Needs ordering filters, Enough, skips and order overrides. Remove the embedded checklist, catalog editor and historical tables. Keep recovery controls available; catalog-change notices link to Catalog. |
| **Order checklist** | Group the working date’s existing order values by supplier. Provide its own supplier filter, defaulting to All; Count’s filters do not restrict this view. Reuse existing quantity-edit and checkbox handlers. Preserve the clipboard format and include all displayed lines, including checked lines. |
| **Catalog** | Default to the current shared catalog in read-only form, with an explicit Edit catalog action. Preserve add/remove/reorder, fresh IDs, validation, cancellation, recovery and revision-conflict handling. Show captured-versus-current differences and the existing explicit adoption action here. |
| **History** | Provide saved-day lookup and a separate “Compare with working count” disclosure. Both remain read-only and clearly distinguish saved fields from the current working draft. |

Checklist checkboxes remain manual **Marked ordered** indications. Use **Save count & checklist**, with acknowledgement covering the existing fields only; checking or saving never claims a vendor received an order.

A catalog draft remains intact while visiting other views. Saving it changes the shared catalog but does not silently replace the working count’s captured catalog. Reviewed adoption continues to archive the prior snapshot and retain removed IDs.

## History, interfaces and compatibility

- **Saved-day lookup:** initialize its end date from the working count date on first visit, then retain an independent lookup date. Load the existing 14-calendar-date window, list returned records newest first with saved time, and select the newest returned record initially. Browsing never changes counts, checklist marks, skips or the working date; add no historical edit/resume action.
- **Independent requests:** keep browsing results separate from the history used to initialize the working count and its print comparison. Changed lookup dates mark displayed results stale. Failed reloads preserve results with their original context; late or expired-session responses cannot replace newer results. Locking hides private records.
- **Comparison:** preserve the working count plus up to four preceding saved counts from its existing baseline history. Label the working column’s save state. Browsing another history window does not alter this comparison.
- **Historical identity:** server responses provide counts without catalog snapshots. For saved-day labels, use a validated matching-date device catalog when available; otherwise use the current catalog. Identify that label source and state that the server’s historical catalog version is unavailable. Always display unknown/removed IDs and their raw values; never match by name or substitute local unsaved counts/skips.
- **API/storage:** retain the existing count PUT, catalog revision PUT and bounded history GET. Preserve all legacy keys, the strict Step 11 versioned envelope and unreadable recovery bytes. Navigation state stays outside that envelope. Add no Worker route, migration or server schema.
- **Units and calculations:** retain original supplier/Use notation, suggestions, raw fractions/text and blank-versus-zero behavior. Do not infer units, conversions or totals across incompatible quantities.

Preserve the familiar English full report with count/comparison columns and checklist. Add explicit checklist-only printing using the checklist’s supplier selection. History report printing uses the selected saved record and available preceding records, clearly labeled as saved and with catalog provenance; it never silently prints the current draft instead. Catalog editor controls and unrelated hidden views do not leak into reports. Restore language and print state afterward.

## Verification and delivery

- Extend the inventory browser coverage for all four views, direct hashes and Back/Forward; preserve a partial count and catalog draft across navigation, language changes, lock/unlock and reload.
- Verify supplier grouping, raw order overrides, checkbox save/reload, clipboard parity and count progress independent of checklist filters.
- Exercise catalog conflicts, denied storage, cancellation, rename/reorder/removal, same-name replacement and explicit adoption without losing captured identities.
- Test history window boundaries and gaps, empty/error states, stale requests, saved-versus-unsaved values, missing catalog metadata and unknown IDs. Assert browsing sends no PUT and does not change device count bytes.
- Check full-report and checklist-only PDFs against independent expected values, including five date pairs where fixtures provide them. Review desktop, tablet, phone, 320px/enlarged Spanish, keyboard/focus and reduced motion.
- Run `npm run check`, relevant existing inventory/recovery/shell browser suites, production build and SEO with explicit loopback APIs. Add focused tests for new history isolation and identity behavior. Preserve REA artifact/runtime evidence under the repository workflow; record physical-device and live-service checks as unverified unless observed.
- Implement in an isolated worktree on `feat/overhaul-step-12a-inventory-views`, preserving current untracked work. Correct Step 11’s stale progress-board status; add a Step 12a checkpoint/evidence and update affected inventory briefs without advancing unresolved backend or unit-policy milestones.
- Deliver one non-draft PR into `main`, with review scenarios and rollback guidance. Stop for review without merging or beginning Step 12b. Rollback must retain existing device envelopes, archives, recovery bytes and server records.
