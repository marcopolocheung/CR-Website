# Dated restaurant hours: implementation plan for items 1–6

Authorized November 20, 2026 as one complete delivery after the publication foundation. Preserve the uncommitted foundation and hand back after all six items, rather than stopping at another prerequisite.

## Data and interfaces

Use one D1 `records` entry per store/date under family `schedule`, ID `hours-YYYY-MM-DD`, day context. The data holds version, exact date, normal/closed/early mode, nullable closing minute and optional label. Cancellation is a new normal-hours revision. Reuse the existing atomic mutation receipts and history; no new table or destructive migration.

Keep station review records separate (`hours-review-{station}-{date}`). Each contains the reviewed event data/revision, the normal day-slot fingerprint and complete decisions for affected slot IDs. This prevents reviewing kitchen from invalidating dining. Normal templates never contain holiday exceptions. Review persistence does not save assignment drafts or publish.

Manager-authenticated range GET and dated PUT endpoints live under `/api/internal/special-hours/{store}`. Station review PUTs use `/api/internal/special-hours/{store}/{date}/review/{station}` and preserve existing rule-edit authorization. Range reads include station baseline fingerprints and published event/review references. Validate store/station/date boundaries and stale event references; reuse operation IDs for uncertain retries.

## Slots and drafts

Expand normal slots first, then apply a pure dated resolver preserving surviving IDs and order. Closed days remove all required/optional slots. Early-close decisions cover every crossing/late spot: suggest clipping crossing shifts, dropping shifts starting after closing, and permit explicit cleanup finishes no later than the original finish. Unaffected shifts remain unchanged. The same effective slots feed generation, repair, manual validation, totals, the assistant, publication and print.

Keep the last reviewed draft visible if restaurant hours change elsewhere. Mark review pending and disable generation, Adjust and Publish until it is reviewed. Template changes invalidate review fingerprints. Failed reads stay unknown; an unconfigured service disables the new feature without falsely asserting normal hours. Source revisions and effective slots participate in stale-job fingerprints.

Save the shared event and station review before changing the current board. If only the event succeeds, show that exact partial result and keep the board unchanged. Retain operation identities through retry. Applying removes assignments only for removed slots and reports removed Keeps. One Undo restores the local draft and its previous applied review selection; it does not undo shared saves. The remaining latest event stays visible as requiring review. No auto-publication or automatic rearrangement of the other station.

## Experience and publication

All manager layouts receive a visible Hours control at each date. A shared accessible, bilingual dialog names the full date and restaurant-wide scope and leads with the three modes. Early closing adds a closing-time field. Labels and affected-shift cleanup finishes are optional under collapsed More options; the main form summarizes draft changes and assigned/kept shifts being removed. Dining/kitchen Needs review, Ready to publish and Published statuses and exact station/week/date links remain on the schedule page.

Snapshots add the reviewed dated labels and event/review revisions. Publication rechecks current event/review data and effective slots on the server; stale or omitted hours cannot be forced through a legacy client. Staff desktop, phone and paper display closure/early-close labels and actual shift finish times. Explicitly all-closed weeks may publish without assignments; ordinary empty/unconfigured weeks remain distinct.

Copying and navigation seed only normal rules; destination events are fetched for destination dates. Existing manually edited holiday templates are not guessed or migrated. Public-site operating-hours widgets and recurring holidays are outside this delivery.

## Verification and handoff

Cover closed days, early closing and cleanup, normal-hours restoration, event edits across stations, confirmed/failed/uncertain writes, conflicts, reload, Undo, copying, navigation, rule changes, stale jobs/proposals, legacy snapshot compatibility and zero-assignment closed weeks. Exercise real disposable D1/KV services plus synthetic browser APIs. Verify Current/Classic/Planning, English/Spanish, keyboard, narrow/enlarged layouts and printed output.

Run scheduler, requests, assistant, relevant imports/report and Worker suites, types, frontend/Worker builds, SEO and tracker/whitespace checks. Record actual evidence for each of items 1–6 in a combined checkpoint, distinguish local completion from deployment/staff usability, and stop after that delivery. No deployment or live holiday data entry is authorized.

## Implemented workflow

Items 1–6 are implemented locally; see the [completion checkpoint](checkpoints/special-hours.md) for observed checks, screenshots, limits and release gates.

1. Open the restaurant's week and choose **Hours** beside the affected date in Planning, Current or Classic.
2. Choose **Closed all day**, or **Close early** and review the customer closing time. The suggested 7 PM value is editable and is not an automatically saved holiday policy. Add a label if useful.
3. Review the short explanation of draft changes. Closed days remove all of that date's shifts. Early closing shortens crossing shifts and removes later-starting shifts automatically. If needed, open **More options** to add a label or retain a later employee finish for cleanup. Finish choices cannot extend a shift beyond its normal finish. Existing custom finishes remain selected when reopening and saving.
4. **Save hours** saves the store event and this station's staffing review before changing the board. A failed or uncertain review leaves the board unchanged. Retry reuses the same operation; Reload latest preserves entered choices for a new review after a conflict.
5. Review dining and kitchen separately, using their status links. These links select the exact week/date and wait for actual staff/rules to load. Existing unsaved-work protection and CR3 Kitchen's UI staff unlock remain in force.
6. Publish each station. Published staff schedules retain prior hours until that station's Publish succeeds. The staff desktop/phone views and printed sheet show the dated labels and actual employee finishes.

**Normal hours** creates a cancellation revision and restores normal staffing positions after review. It does not automatically reassign people. **Undo** restores local assignments, Keeps and the previous applied review selection; the shared event/review saves remain and can require another review. Assignment drafts and local Undo retain the existing session lifecycle; saving hours does not introduce shared assignment-draft storage.

Review/publication badges describe the hours step, not an assertion that every staffing requirement is filled. Other validation and coverage warnings remain on the board. A full week explicitly reviewed as closed can publish with zero assignments. Historical manual holiday edits are retained as ordinary saved rules; the feature does not guess how to migrate them.

The [compact Hours UI checkpoint](checkpoints/special-hours-ui.md) records the follow-up simplification and its local checks. It changes the frontend presentation, not the existing service or publication contract.

## Service and rollout contract

- D1 uses existing `records`, mutation receipts and immutable change events; no new migration or binding type is introduced. An initialized `INTERNAL_DB` binding is required to activate the service in a target environment.
- A store activation marker, `r:{store}:special-hours:active`, is written in KV before hours mutations. If the D1 binding later disappears, reads become unavailable and publication remains blocked rather than falling back to normal hours. Retain this marker on rollback; do not clear it to work around a failed service.
- Public snapshots add optional `specialHours` entries containing the reviewed date, mode, closing minute, label and event/review revisions. Current staff URLs, legacy layout capture and existing assignment indexes are preserved. New readers validate the metadata and cannot silently fall back from an invalid snapshot.
- Publication checks current D1 events/reviews against saved normal rules and the proposed effective slots. The underlying golden publication remains KV-based: checks across D1 and KV are not a cross-store transaction or atomic CAS. Subsequent edits mark an older publication as needing review; they never rewrite that staff snapshot automatically.
- Ordinary weeks retain the prior assistant wire shape. Weeks with dated events send the effective layout plus an hours fingerprint and require the compatible Node assistant. The assistant remains optional and cannot publish.
- Coordinate compatible frontend readers, Worker/D1 capability and the optional assistant before release. The checked-in production Wrangler config does not establish an active D1 binding. No deployment, real holiday entry, notification or live-system verification was performed for this delivery.
