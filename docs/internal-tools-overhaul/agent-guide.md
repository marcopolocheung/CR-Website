# Agent working guide

Read the root [AGENTS.md](../../AGENTS.md) and any more specific instructions before working. Read relevant installed Next.js guides before future application code. This package authorizes documentation only; task briefs describe future assignments and do not constitute a cloud deployment instruction.

## Claim and prerequisites

1. Select the narrowest ready brief from the [tracker](tracker.md); open its canonical file and verify current behavior against the linked sources. Check existing worktree changes and avoid overwriting another owner's files.
2. Confirm **needed to implement** dependencies at their stated milestone. Code prerequisites at `implemented` may have activation pending; use isolated fixtures/adapters during local work. Decisions at `complete` require an approver, date, answer, and examples. No response is an approval.
3. Set owner to a named person/agent and status to `in_progress` in both brief and tracker before editing. Record the claimed scope, expected evidence, shared files, and intended contract. Check for an existing claim; coordinate with that owner instead of assuming ownership.
4. Check **needed to activate** separately. Missing cloud access/resources must not block authorized local work. Never infer an account, resource ID, employee match, supplier unit, cash rule, retention period, or approval from a placeholder.
5. When a business subquestion blocks only part of the outcome, record that exact portion and continue independent work. Do not mark a policy-dependent feature implemented while its acceptance rules are unknown; split independently deliverable scope with a stable parent reference if necessary.

## Bounded work and shared files

Keep changes within the brief. Agree schemas and API payloads with DATA-01 before consumers diverge. Reserve ordered migration numbers with the DATA-02 owner. Coordinate edits to worker/src/index.ts, dashboard.js, API adapters, shared types, dictionaries, navigation/layout, package files, and CI before changing them. The current Worker is one shared source file; two owners must not silently replace each other's routes.

Use local fixtures and a verified local/staging API base. Several existing clients default to the production Worker: do not allow future local mutation tests to use that fallback. Keep manager/staff credentials in memory or the approved secret store and out of URLs, drafts, fixtures, commits, logs, and handoffs. Authentication redesign remains LATER-01.

Use existing components/helpers and free reusable packages selectively. Follow the supporting research's licensing boundaries; record adopted package/version/license and notices. Retain independent domain validation. Do not install every shortlisted package or import vendor screens/assets as implementation.

Parallel work is possible across translation infrastructure, local draft repair, import validation, compatibility fixtures, and export tooling. Owners still coordinate shared files and interfaces. No automatic sub-agent delegation is required.

## Milestones and statuses

| Status | Entry condition |
| --- | --- |
| planned | Scope exists; implementation prerequisites remain unsatisfied. |
| ready | Implementation prerequisites are satisfied; task is available to claim. |
| in_progress | Named owner is actively executing the brief. |
| blocked | A specific unresolved decision or external condition prevents the remaining scoped work; state which milestone is blocked. |
| implemented | Implementation and local verification pass; required external/live evidence remains pending. |
| complete | All applicable milestones and acceptance checkboxes have linked evidence. |
| deferred | Activation criterion has not been approved; unrelated baseline work remains independent. |

Milestone values in front matter are `pending`, `done`, or `not_applicable`; use the same values in the milestone table. Tracker shorthand is P, D, or NA in I/L/E/V order. CODE_ONLY and DECISION external/live milestones are not applicable; publication does not become implied. EXTERNAL_ONLY implementation means a concrete reviewed execution plan/artifact; local verification means preflight/dry-run/config review. USABILITY implementation means an agreed protocol; external activation means the actual session/pilot occurred; live verification means observed acceptance and retests were recorded.

An `implemented` milestone gate is satisfied by a complete task too. For relational CODE_AND_EXTERNAL tasks, DATA-03 and REL-03 gate staging availability; DATA-09 gates production completion. CASH-03 can deploy a calculation-only change against existing KV without D1/R2 cutover. UI consumers also require REL-04 publication. DATA-09 selects only locally implemented slices in its release manifest. Its prerequisites depend on local code milestones, so a feature need not complete production activation before the cutover that activates it. Do not introduce a circular complete-to-complete dependency.

The tracker views are snapshots. Recompute availability after each handoff, including transitive decision blockers; don't merely change an ID's row and leave an outdated ready view. Duplicate rows in views must agree with the canonical brief.

## Verification and external execution

Run applicable commands from the brief. Existing package scripts are verified in [current state](current-state.md); absent future test/build/migration commands are deliverables, not commands that can already be executed. Record exact commands, environment, observed results, and failures. Read-only probes can still expose personnel/cash data: redact evidence and link protected artifacts rather than copying records into public docs.

Follow the [runbook](external-operations.md) per environment. Before production, provide a concrete release/slice manifest, local/staging evidence, verified target/bindings, rollback artifact and write-reconciliation procedure, and required access/authorization for that future assignment. The frontend deployment never substitutes for a Worker deployment or migration. Record resource creation, bindings, migration execution, Worker deployment, frontend publication, and live checks as separate events.

## Handoff before stopping

Update both the canonical brief and tracker even when incomplete:

- Commit IDs or exact uncommitted artifact paths and bounded changes; do not claim a commit that does not exist.
- Commands/scenarios performed, expected/observed outcomes, language/device coverage, and evidence locations.
- Four milestone states, environment, deployed artifact/version, record revisions, operator, and time where applicable.
- Remaining steps, unresolved policies/access, accepted limitations, shared-file reservations, and the next owner/action.
- Rollback readiness and any writes that must be preserved/reconciled.

Leave unchecked acceptance items that were not executed. A source inspection, passing build, health response, or documented runbook alone never establishes live completion. Return ownership explicitly or name the continuing owner. Do not commit user-owned research/templates or unrelated work as part of a task.
