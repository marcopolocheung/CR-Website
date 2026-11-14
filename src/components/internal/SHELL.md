# Internal shell adapter

`InternalShell` is the Step 03 layout adapter. It supplies product identity,
consistent language/help/local-lock positions, read-only task context and six
native link destinations using the approved primitives. Its chrome uses scoped
fonts/tokens; existing work surfaces keep their current typography and entry UI.
Chrome disappears in print. The desktop header/rail are sticky; the phone/tablet
header scrolls away so existing sticky entry summaries have room for the keyboard.

Cash/Reports links reuse `/internal/bookkeeping#cash-out` and `#sales`. Once in
Bookkeeping they preserve the exact current pathname, including slash and `.html`
variants, to avoid remounting input/File objects. Old #hours/#comparison tabs,
native Back/Forward and empty-hash Cash selection synchronize with the shell.
The skip link focuses the workspace without replacing the task hash.

`ShellTask` registers display-only context and callbacks to existing per-tool lock
behavior. It contains no token, record payload, mutable store/date selector,
authorization grant, API client or persistence layer. Registration and display
contexts are separate so updating a label does not rerender every editor or
restart its request effects. Callback refs stay current without refreshing the
registration on each keystroke. Current task keys are dashboard, cash, sales,
hours, comparison, inventory and forms, with optional child display context for
dashboard filters and form records/drafts.

Cash's header handoff delegates the existing persistence guard; a failed device
save leaves the editor/access intact. Forms/inventory preserve their mounted
local state through existing local lock callbacks. Tools still verify access
independently. Shared manager access and a new draft/context lifecycle are Step 04,
not implied by sharing a visual header. Keep callback identities stable when they
participate in existing request effects (notably the forms book).

`/scheduler-demo` retains its route group/gate and a bilingual return adapter.
It does not inherit the shell or manager authority until its requested integration
slice. Public `/schedule` and encrypted legacy APIs are untouched. QR and the
component gallery have a way home without falsely selecting a primary destination.

The [checkpoint](../../../docs/internal-tools-overhaul/checkpoints/step-03.md)
records actual checks, screenshots, staged-review gates and verification limits.

## Step 04: shared access and retained work

The internal layout now owns ManagerSession and WorkspaceHost. The host lazily
mounts each visited primary tool once, keeps its React state/File objects alive,
and hides inactive workspaces from focus, accessibility and print. Native
same-document hashes remain native; NavigationProtection routes ordinary internal
cross-document anchors through Next's router, preserving the layout. Schedule and
external departures retain confirmation/unload behavior. Reload and another tab
start locked. No universal mobile process-termination protection is claimed.

ShellTask remains display metadata; its old callbacks are compatibility metadata,
not authorization grants. The header uses the session's coordinated handoff.
Task context remains task-owned, with no global store/date selector. Hidden tools
suspend automatic reads; held operations stay bound to their original inputs.

Manual “Save drafts & lock” checkpoints every visited participant before closing
any editor or clearing shared access. A busy operation, denied storage, incomplete
import without a supported saved snapshot, or unsaved mapping blocks manual lock.
The alert leaves work open; finish/save the import snapshot or mapping, or use the
available recovery controls. No raw File is silently serialized or discarded.
Local converters remain available without manager authority as before.

Authorization failure instead clears the matching session immediately and hides
protected editors without discarding their working copies. Reauthentication
restores them; writes require deliberate retry. Transport leases reject stale
response bodies after a session change even when the same code is reentered.
Live consumers handle authorization errors after their task/context guards, so a
late failure from a closed cash editor cannot lock a newer record. Pending-request
counts prevent an old finally from enabling saves during a newer request.

Cash and Forms retain their original draft keys/readers. Inventory additionally
checkpoints `cr-inventory-day:<date>` and a validated
`cr-inventory-catalog-recovery-v1` envelope containing CR3, original base revision
and raw edited sheets. It still writes the old `cr-inventory` count format.
Catalog recovery requires explicit Resume and preserves conflicts against newer
server revisions; source downloads and UUID-keyed archives preserve original
bytes when a recovery is explicitly resolved. These are device copies, not new
backend history, revisions or durable count states.

The provider never persists credentials. Preparer labels remain user-entered
labels. API authorization, legacy conflict/retry limitations, scheduler-specific
permissions, public schedules and encrypted-link adapters remain independent.
See the [Step 04 checkpoint](../../../docs/internal-tools-overhaul/checkpoints/step-04.md).


## Step 05: Home and Reports

Home is a five-task launcher with no history fetch, credential gate, charts or
invented resume/attention signals. Reports now has a retained `/internal/reports`
workspace with cash history and links to the original sales/hours/comparison
Bookkeeping hashes. Primary Reports navigation always opens the hub. Legacy
Bookkeeping hashes and Cash's current-path aliases remain compatible; the host
keeps their editors and File objects alive while visiting either new destination.
The preceding Step 03 Cash/Reports hash-link description is historical.

`CashReports` preserves the original Dashboard cash report's populated calculations,
filters, chart/table output and endpoints. Empty selected coverage now has an
explicit empty state; failed reads have an alert/retry and do not masquerade as
empty data. No backend, parser, retention or business formula changed. Cross-tool
work signals remain Step 17. Re-selecting an identical active internal link is a
no-op to avoid reloading the memory-only session; changed hashes remain native.


## Step 06: focused cash workspace

Cash keeps the original store/date draft reader, in-memory manager session,
Bookkeeping aliases and mounted host. Its active setup/draft/export controls now
live in named context details; print/load/clear and saved-day lookup are secondary.
The drawer selector shows one AM/PM editor at a time without unmounting others.
All drawers print. Screen-only inactive state deliberately uses CSS/data attributes,
not HTML `hidden`, whose Tailwind preflight important rule would suppress paper output.

Count/Amount, raw invalid entry, legacy unknown-status metadata, per-drawer $100,
Extra money and saved-day/serialization adapters are unchanged. The existing
EntryWorkspace gets an opt-in collapsed keyboard-help mode; other consumers keep
the inline default. Cash caps its sticky summary at half the measured visual viewport
and adapts denomination rows at small widths; financial values stay unbroken.

The selector, validation-focus reveal and keypad Previous/Next share the active
drawer state. Removing/changing focus never grants access or changes record context.
This is presentation work; enhanced saved lookup/history remains Step 07.
