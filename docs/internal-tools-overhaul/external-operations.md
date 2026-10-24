# External-operations runbook

**Future execution only. Nothing in this runbook has been performed.** These procedures distinguish provisioning, bindings, migrations, Worker deployment, data cutover, frontend publication, and live verification. A future assignment must name the selected environment/slice and authorize its operations. Never use guessed account/resource IDs or include secret values in evidence.

Cloudflare dashboard navigation below is a procedure to verify at execution time, not a claim that account access, resource features, or a particular deployed configuration has been checked. No new Wrangler/D1/R2 command is presented as an existing repository script. DATA-02/07/10 and REL-02 must deliver pinned, reviewed commands and dry-run help before executable automation replaces a dashboard procedure.

## Common preflight and evidence

Before each operation, record environment (`local`, isolated `non-production`, or explicitly selected `production`), verified account/project, operator, task IDs, approved slice manifest, artifact/commit, exact target names/IDs in the appropriate protected operations record, prior configuration/version, expected change, success/stop criteria, and rollback path. Link sanitized evidence from the task; keep financial/personnel exports and credentials outside public documentation.

Required access is operation-specific: resource operator for D1/R2 creation, Worker maintainer for bindings/secrets/deploy, approved data operator for exports/migrations/restores, GitHub Pages/repository maintainer for frontend publication, and staff/pilot owner for acceptance. Verify actual access before claiming external readiness. The checked-in SCHEDULES namespace ID is `REPLACE_WITH_YOUR_NAMESPACE_ID`. Stop before any deploy using it; find the existing real binding in the verified account rather than creating a fresh namespace as a substitute.

The per-slice manifest records included task IDs, implementation/local evidence, approved policy decisions, schema/adapters, compatibility window/capability behavior, legacy baseline, intended Worker/frontend versions, data snapshot manifest, live scenarios, freeze or catch-up strategy, and rollback thresholds. No slice waits for unrelated future features. New code's production completion follows cutover; cutover requires its local evidence, not its already-complete production state. Do not add a complete-to-complete cycle when expanding the manifest.

## OP-01

### Create resources

- **Prerequisites:** reviewed environment/resource plan and approved account access; D1/R2 requires DATA-02 local schema/fixtures; production also requires DATA-08 rehearsal and DEC-03 policy. Do not provision anything for this documentation deliverable.
- **Target:** non-production for DATA-03 and conditional REL-03 staging setup; separate production resources for DATA-09.
- **Procedure:** open the verified Cloudflare account, find D1, create the approved database for that environment and record its actual ID. Find R2, create the approved private bucket and record its actual name. Apply no invented retention/lifecycle rules. Review each environment's resource list to prove separation. Never create a replacement for an existing SCHEDULES namespace. If the staging Worker/KV environment does not yet exist, REL-03 may create a separately named isolated Worker and KV namespace in the verified account, record their actual IDs, and seed only approved synthetic/sanitized fixtures. Keep its bindings separate from production and do not copy secret values into evidence. D1/R2 creation is required only for slices that use them.
- **Expected result:** intended database/bucket exist, contain no unexpected business data, and are distinct from other environments. Their existence does not establish bindings, schema, deployment, or migration.
- **Evidence:** task/environment/operator/time, resource details, private access and separation confirmation, approved configuration. Redact account identifiers from public evidence as needed.
- **Rollback:** detach only newly created unused resources after reviewing references; retain anything that has received data until exported and reconciled. Never delete existing KV/D1/R2 to reset a deploy.
- **Affected tasks:** DATA-03, DATA-09; REL-03 for an absent isolated Worker/KV environment only. LATER tasks add their own approved operations if activated.

## OP-02

### Configure bindings and environment access

- **Prerequisites:** actual resources for the selected slice (OP-01 if new), verified current Worker configuration, compatible local artifact, access to Worker settings. Confirm the real existing SCHEDULES binding before any change.
- **Target:** one named Worker/environment at a time; local configuration remains DATA-02 work.
- **Procedure:** open the selected Worker settings/bindings. Retain SCHEDULES pointing at its existing verified namespace. Add proposed D1 binding `INTERNAL_DB` and R2 binding `INTERNAL_ATTACHMENTS` only after DATA-01/02 settle the exact names and code agrees. These are proposed names, absent today. Confirm each resource selector points to the correct environment. Review environment variables and secret *presence*, including current manager/staff access settings; set approved secrets through the account secret workflow without displaying values. Record whether dashboard binding changes trigger deployment/version creation and keep that event distinct from binding review.
- **Expected result:** intended bindings and access settings recorded; no resource silently replaced with an empty one. Frontend public API origin points to the matching service; secrets never go in NEXT_PUBLIC variables.
- **Evidence:** before/after redacted configuration, verified resource mapping, secret names/presence only, resulting version if created.
- **Rollback:** restore the prior verified binding configuration and compatible Worker version; preserve resources/data. If requests wrote to the wrong target, stop writes and reconcile both targets before reopening.
- **Affected tasks:** DATA-03, DATA-09, REL-03; every CODE_AND_EXTERNAL consumer relies on these bindings through activation prerequisites.

## OP-03

### Execute schema migrations

- **Prerequisites:** ordered migrations and exact pinned runner from DATA-02, local empty/upgrade fixture results, verified target/bindings, manifest of migration versions/checksums, export/snapshot rollback evidence. For business records, approve relevant DEC-03 handling first.
- **Target:** isolated non-production first (DATA-08), then selected production database (DATA-09); never infer remote from a local command.
- **Procedure:** review the DATA-02 runner's target/remote options and dry-run output; paste the exact reviewed command into the protected operations record before execution. No migration command exists today. Apply ordered migrations only to the explicitly confirmed database; verify version/checksum tracking, foreign keys, indexes and constraints with read-only queries provided by DATA-02. Schema-only changes do not import KV data. Use additive expand/contract changes until old clients/adapters are compatible.
- **Expected result:** intended schema version applied once; existing compatible data unchanged; repeated execution either safely skips applied migrations or reports a controlled mismatch.
- **Evidence:** command/tool version, target, before/after schema versions, checksums, dry-run/apply output, empty/upgrade validation and compatibility results.
- **Rollback:** use the rehearsed restore or forward-compatible fix from the manifest. Do not assume reverse SQL exists or drop columns/tables with accepted writes. Restore into an isolated target and reconcile post-snapshot writes before switching bindings.
- **Affected tasks:** DATA-08, DATA-09; schema-consuming CODE_AND_EXTERNAL tasks DATA-04/05/06/10, SCH-01/02/04/05, CASH-04/05/06/08, INV-01/03/05/06/07/08/09/10, IMPORT-06/07/08, FORM-04/05/06, DASH-03/04. CASH-03 may record not applicable if it changes only calculation in an existing route.

## OP-04

### Deploy Worker artifact

- **Prerequisites:** REL-02 pinned build/artifact and mirror decision, OP-02 verified bindings, appropriate OP-03 schema, backend compatibility tests, selected slice manifest and prior deploy version. A green frontend build is insufficient.
- **Target:** non-production under REL-03; production under DATA-09/REL-07 for relational slices, or a separately scoped Worker-only activation such as CASH-03 against existing KV.
- **Procedure:** build the reviewed artifact using the exact future REL-02 command. The current README supports a dashboard JavaScript paste or `wrangler deploy --config worker/wrangler.toml`; the latter is unsafe with the checked-in placeholder and is **not executed here**. For a future dashboard deployment, select the exact Worker/environment, compare current bindings, paste the approved JavaScript artifact only if REL-02 retains that path, review changes and deploy. If REL-02 adopts CLI deployment instead, use its pinned tool/config/environment command. Record deployment separately from resource/binding/schema events. Stage additive backend support before exposing frontend features.
- **Expected result:** correct artifact/version is active with preserved bindings and existing API consumers; no automatic frontend publication is implied.
- **Evidence:** source commit, toolchain, artifact checksum, environment, deployed version/time, previous rollback version, and OP-07 result. No unverified dashboard.js mirror is acceptable.
- **Rollback:** OP-08 to the last compatible version/bindings, retaining accepted records and migration compatibility. Source rollback alone does not recover data.
- **Affected tasks:** REL-03, DATA-09, REL-07, and every baseline CODE_AND_EXTERNAL feature: DATA-04/05/06/10, SCH-01/02/04/05, CASH-03/04/05/06/08, INV-01/03/05/06/07/08/09/10, IMPORT-06/07/08, FORM-04/05/06, DASH-03/04.

## OP-05

### Export, transform, import, cut over, or restore data

These are individually recorded substeps, never one inferred success event.

- **Prerequisites:** DATA-07 dry-run tools and complete key-family inventory, approved raw-data handling, target schema/version, DEC-03 policy, checksummed snapshot and retained originals, deterministic transform/reconciliation results. Production requires DATA-08 rehearsal, selected locally verified slice artifacts and an approved write-freeze or journal/catch-up plan. Ongoing automation additionally requires DATA-10's actual runner and recovery objectives.
- **Target:** isolated staging for rehearsal; selected production slices for cutover; always isolated restore target before any production binding switch.
- **Procedure:** use DATA-07's future exact export command to paginate KV including metadata and expiration, capture raw originals and manifest, then transform in dry-run mode. Review quarantined/malformed/unmapped records; no guessed matches or units. Import using its reviewed idempotent tooling into the explicit target. Reconcile key/record-family counts, unique IDs, cent totals, relationships, historical item/order details and object checksums. Test interrupted/resumed import and duplicate replay. For staging storage/recovery rehearsal, synthetic attachment objects and approved exports are sufficient; future feature services need their own activation evidence. For cutover, freeze or catch up writes, take final manifest, compare both paths, switch only selected routing/capability/binding flags implemented for that release, then run OP-07 before reopening writes. Record old/new read compatibility and the retained original KV. For ongoing backup/restore, run DATA-10's future export/restore procedures and measure recovery loss/time against approved objectives.
- **Expected result:** every source is accounted for as migrated/preserved/quarantined with a reason; no duplicate accepted writes; restored D1 and R2 references reconcile; permitted old consumers still work. No claim is made to restore records already expired before the snapshot.
- **Evidence:** each export/transform/import/reconcile/switch/restore event, commands/tool versions, snapshot checksums, source and target versions, totals, exceptions, mapping approvals, freeze/catch-up bounds, restore timing, go/no-go owner and rollback result. Link protected data manifests instead of publishing records.
- **Rollback:** stop new writes as needed, preserve and export accepted post-cutover changes, reconcile/replay them into the compatible path, restore prior routing/bindings/artifact only after comparison. Retain source and target; never blindly replace current data with an older snapshot.
- **Affected tasks:** DATA-07 supplies tooling; DATA-08/09/10 execute/verify it. All schema-consuming CODE_AND_EXTERNAL tasks listed under OP-03 use this operation for fixture/migration activation as applicable. For a change with no data movement, record that substep not applicable with a reason; still verify persisted records and compatibility.

## OP-06

### Publish static frontend

- **Prerequisites:** REL-01 checks, activated compatible backend slices, verified frontend artifact/API base, intended selected tasks and required policy approvals, current release rollback artifact. REL-04's manifest must exclude unavailable capabilities or show their explicit disabled state.
- **Target:** existing GitHub Pages publication; hosting migration is LATER-02.
- **Procedure:** use the reviewed commit and existing Deploy to GitHub Pages workflow (push to main or workflow_dispatch under the future assignment's release authorization). Inspect type/build/SEO/service checks and Pages artifact/result. Confirm NEXT_PUBLIC_BASE_PATH and any approved NEXT_PUBLIC_SCHEDULE_API build configuration; neither may contain secrets. Record commit, workflow run, out/ artifact, publication URL and time. This workflow does not deploy the Worker, change KV, apply migrations, or provision D1/R2.
- **Expected result:** selected frontend is live with intended assets/routes and compatible service capabilities; local CODE_ONLY changes are now published only if included in this artifact.
- **Evidence:** included task IDs and frontend commit, backend version/schema, workflow checks, Pages artifact/deploy ID, API origin, OP-07 browser results in both languages.
- **Rollback:** rebuild/re-publish a prior compatible commit/artifact using the approved workflow; confirm its API compatibility and preserve current server records/local drafts. Worker rollback is separate OP-08.
- **Affected tasks:** REL-04, REL-07 and frontend changes from UX-01–07, SCH-03/06/07/08, CASH-01/02/07, INV-02/04, IMPORT-01–05, FORM-01/02/03/07, DASH-01/02/05 plus frontend consumers of activated CODE_AND_EXTERNAL tasks. Schema/tooling-only tasks need no frontend publication unless they change a consumer.

## OP-07

### Verify the live target

- **Prerequisites:** explicitly selected environment, resource/version evidence from applicable operations, safe fixture/record and approved data access. Read-only health checks alone never establish feature completion.
- **Target:** staging first; production only after its own activation. Record the two environments separately.
- **Procedure:** check resource/binding details and applied schema where applicable. Verify /api/health. The existing read-only `npm run scheduler:verify -- <verified-api-base>` checks four station routes, public template/month reads, and authorized roster read (or expected 401 without a manager token). Replace the placeholder argument with an actual verified origin and avoid logging credentials/private records. This probe does not check new services, crew behavior, all date ranges, or financial calculations. Execute each included task's three specific scenarios with approved disposable records or safe read-only equivalents; verify private GET/write authorization, stale-revision rejection, idempotent retries, and historical compatibility. Check old encrypted links, public staff views/visibility, spanning-month revisions, and CR3 Kitchen restrictions. For frontend releases, open exact record links, context switching, partial language switch, save states, tablet/keyboard flow and print output. Where a mutation is necessary, plan its cleanup/retention explicitly under policy and preserve audit lineage.
- **Expected result:** task-specific observable outcomes match authoritative records and proposed contracts; no unintended private exposure, duplicate writes, false saved state, or regressions. A staging result is not production evidence.
- **Evidence:** operator/time/environment, artifact/schema, task/scenario, expected versus observed, redacted requests/statuses, revisions/checksums, language/device/browser, screenshot/output link where useful. Record failures and stop criteria rather than checking completion boxes.
- **Rollback:** use OP-08 when stop criteria are met; isolate failures, keep drafts/evidence, and return to accepted workflow while fixing affected slices.
- **Affected tasks:** DATA-03/08/09/10, REL-03/04/07 and every CODE_AND_EXTERNAL task listed under OP-04. REL-05/06 add observed staff acceptance through OP-09.

## OP-08

### Roll back and reconcile

- **Prerequisites:** known prior compatible frontend/Worker artifact, prior bindings, schema compatibility plan, checksummed recoverable snapshot, accepted-write reconciliation procedure, named operator/go-no-go owner. Rehearse in isolation before production.
- **Target:** non-production rehearsal first; selected production slice when required.
- **Procedure:** pause or route affected writes using controls delivered for that release; export post-snapshot accepted writes and relevant local drafts; restore to an isolated target and compare/replay/deduplicate using approved tools. Roll back Worker version/bindings only to a schema-compatible state. Re-publish compatible frontend if needed. Verify original KV pointers and protected/public routes; run OP-07 and reopen only after reconciliation. If no safe automatic merge exists, preserve both versions and use reviewed manual reconciliation rather than overwrite.
- **Expected result:** prior accepted workflow works with all accepted business records accounted for, within DEC-03 recovery objectives. Code rollback and data restore are distinct events.
- **Evidence:** trigger, affected slices/times, before/after versions/bindings, snapshot and post-cutover manifests, reconciled totals/exceptions, downtime/loss measurements, operator approval, OP-07 results and follow-up defects.
- **Rollback of rollback:** retain both snapshots and a forward-compatible artifact; if comparison fails, keep writes paused and restore the verified path with reviewed reconciliation. Never delete the preserved source to force agreement.
- **Affected tasks:** DATA-08/09/10, REL-03/04/07 and activated CODE_AND_EXTERNAL tasks under OP-04. CODE_ONLY rollback remains a scoped repository revert followed by separate publication when already live.

## OP-09

### Staff evaluation and pilot acceptance

- **Prerequisites:** REL-04 selected activated release, approved Spanish terminology for evaluated labels, named staff/pilot owner, baseline/protocol, supported shared computer/tablet and printer, safe records and fallback workflow.
- **Target:** observed English/Spanish shared-device sessions, then a named store/shift pilot; staged rollout follows separately.
- **Procedure:** REL-05 observes uncoached baseline and candidate tasks from the bilingual UX reference; measure completion, errors, coaching, context/save-state comprehension, recovery and time. Include offline, second editor and mid-task language switch. REL-06 pilots only the named accepted workflows, logs defects with severity/reproduction/owner and retests blockers. Do not invent staff approval or numeric speed targets before baseline data exists.
- **Expected result:** actual staff evidence supports acceptance and agreed pilot exit criteria, or specific blocking defects remain recorded and unchecked.
- **Evidence:** protocol/build/task IDs, language/device/context, anonymized observations and timings, defects/retests, pilot scope/dates, named operational acceptance and remaining exclusions.
- **Rollback:** stop the affected trial, preserve data/drafts and observations, use the current/paper fallback; OP-08 handles any infrastructure/data rollback.
- **Affected tasks:** REL-05, REL-06; REL-07 consumes their acceptance. DEC-07 consumes terminology observations, without making initial dictionary infrastructure dependent on completed rollout.
