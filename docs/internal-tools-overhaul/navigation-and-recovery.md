# Navigation and retry/conflict recovery (UX-06)

UX-06 provides shared navigation protection, single-flight submission control, capability-gated v1 retry coordination, and explicit recovery/compare/copy controls. First consumers are cash-out, mounted bookkeeping converter work, and the existing revisioned inventory-list adapter. There is no Worker route, resource, authentication-model or financial-policy change.

## Navigation and retained work

`NavigationProtection.tsx` registers each consumer's dirty/device-copy state. Ordinary same-tab HTTP(S) anchor navigation asks a localized confirmation while work is pending. Same-page hash navigation, mounted bookkeeping tabs, downloads and opening another tab preserve the original editor and are not blocked. A recoverable device draft and memory-only/failed-storage work get different messages. Native beforeunload protection is attached only while dirty work exists and removed after acknowledgment/cleanup, preserving the normal clean-page lifecycle.

A canceled route/reload leaves inputs and focus intact. Cash-out context changes/handoff already require a successful device save; converter values/files remain mounted across tabs. Cash-out and inventory now keep their editor state mounted but hidden behind the existing manager gate after a 401. Reauthentication restores the same editor instead of recreating/clearing it, including when device storage failed. Tokens remain in memory and are excluded from copies/downloads.

Browser limits are explicit: beforeunload requires browser/user activation and is not reliable for every mobile/process-termination case. Its text is browser controlled. Same-document back/forward or programmatic SPA routing cannot be universally canceled by this anchor/beforeunload layer; consumers must preserve drafts and use protected navigation paths. No history-sentinel/back-stack manipulation or unsupported Next router blocker is installed. See [beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) and [popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event). This is protection plus recovery, not a promise that browsers always deliver a final event. Failed-storage feedback continues to offer an open working copy/download.

## Submission and v1 operation identity

`SingleFlight` coalesces simultaneous calls for one action until its promise settles. Cash-out saves and inventory-list saves adopt it; list fields/actions are disabled during their submission. This is client duplicate prevention, not a new KV transaction/idempotency guarantee.

`MutationRecovery` handles future v1 services only after DATA-01's capability result advertises v1 writes, atomic revisions and idempotent operations for the target family. It never falls back to a legacy endpoint. Target/store/record/action are fixed; the attempt snapshots schema/base/operation ID/data. Offline/timeout/401 retries reuse the original ID and payload; changed content cannot reuse an uncertain operation. A target-bound checkpoint can round-trip through a caller's validated draft storage without capturing the transport function or credentials. The primitive itself performs no storage or network request.

A 409 blocks blind retry. Reload obtains a separate server snapshot while retaining the local attempt/original base; copy/checkpoint preserves it. Only explicit acceptServer clears that attempt. Successful identical submissions reuse the acknowledged result, avoiding another event. Input edits made while a request is pending remain caller-owned and are not retroactively labeled acknowledged. Scalar/JSON checks use the same canonical helper as DATA-05; its function/export behavior is preserved by extraction to `json.ts`.

Future consumers must authorize their adapter, validate domain data, retain checkpoint/source data through interrupted work, and publish only real backend capabilities. No current KV endpoint receives or advertises the v1 operation protocol from this task. Current counts/cash sheets remain last-save-wins; inventory lists retain their existing optimistic-revision API and its known KV limits.

## Existing inventory-list conflict flow

Previously, a 409 fetched a newer list revision and replaced the editor's base, so the next Save could overwrite the other editor's list. Now the original base and local draft stay fixed, and Save is blocked until explicit recovery. Read server copy fetches data for comparison only. Human-readable differences use stable sheet/item IDs and original names, suppliers, raw Use values, order and notes; they do not merge by name, invent units or reinterpret history.

Copy/download exports the local list and original base revision without credentials. Use server version requires explicit confirmation; cancel keeps the local editor unchanged. The chosen observed server revision becomes the editing baseline only through that review action. Another later change can still yield a conflict. Legacy retry text makes no promise of server-side operation identity. New recovery controls/messages are English/Spanish; existing inventory paper/data labels remain compatible for subsequent domain adoption.

## Local verification

- `npm run recovery:test`: 7/7 cases for one in-flight submission, immutable data, acknowledged repeat, offline/timeout/auth retry/checkpoint identity, uncertain changed-content/target rejection, conflict reload/copy/explicit selection, capability/malformed-record rejection, retry after failure, and stable-ID raw-field comparison.
- `npm run data:test`: 10/10 local workerd D1/storage/history cases pass after shared canonical extraction.
- `npm run scheduler:test`: 128/128; `npm run cashout:test`: 16/16; contract/dictionary/draft fixtures: 15/15.
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`: pass.
- Python Playwright/Chromium: all five scripts pass against Next dev with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`. Scripts fulfill synthetic local responses and reject production Worker requests. UX-06 verifies canceled ordinary route navigation and actual native reload, retained offline/auth fields, unchanged base after a real-shaped legacy 409, comparison without another PUT, credential-free clipboard/download, Spanish confirmation/cancel, explicit server adoption/focus, two immediate clicks producing one held request, and cash-out auth recovery after quota denial. Timeout and cross-retry operation identity are proven with mocked v1 fixtures; no live capability is inferred.

Run `python3 scripts/test-internal-recovery.py http://127.0.0.1:3017` after starting the loopback-override dev server. The other browser scripts cover language, feedback, independent drafts and cash-out context/late responses. Printed controls remain hidden; the prior print/output-value regression passes. No staff observation, frontend publication, deployment, remote migration or live check occurred.

Rollback is the scoped UI/library commit, retaining every local draft/source key and recovery export. Reverting does not roll back an accepted legacy save; preserve/reconcile real accepted writes separately if a future activated service is reverted. DATA-05 deployment/cutover and REL-04 publication remain separate gates. Final terminology/output and business decisions remain unapproved.
