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
