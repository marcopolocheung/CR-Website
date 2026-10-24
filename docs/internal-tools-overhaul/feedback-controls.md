# Shared controls and feedback (UX-03)

`src/components/internal/Feedback.tsx` supplies labeled inputs with associated field errors, a linked error summary, an empty state, explicit save indicators, and an async confirmation dialog. Consumers use stable dictionary keys; original field values are retained. Keyboard focus identifies the actionable field rather than clearing/replacing input. The cash-out code gate and sales context checks are the first field/error consumers.

`useConfirmation` opens a named native modal dialog, initially focuses Cancel, contains Tab/Shift+Tab between its actions, supports Escape, and returns focus to the connected trigger. Cancel is the initial action for destructive questions. Language changes update labels without reopening the dialog. Cash-out remove, clear and saved-sheet replacement use it instead of blocking native confirmations. The dialog/status controls are hidden in print and do not change the familiar report.

`SaveFeedback` has distinct unsaved, device, sending, server, waiting, failed and conflict states with words and a polite atomic status announcement. Consumers must select server only after a real acknowledgment for the current record AND current edit. Acknowledging an earlier version leaves newer edits marked device/unsaved and explains which earlier version was saved. Changing store/date invalidates server status. Network failure retains input and shows waiting, while denied local writes show device-save failure. A failed history refresh after a successful save does not revoke the acknowledgment; it has a separate concrete history message.

Cash-out uses its existing API/calculations and legacy local key. The current device copy contains sheet values only, so its feedback explicitly asks the user to confirm store/date when resuming. Complete labeled drafts and legacy assignment remain UX-05/CASH-01. This task catches device write failures to report them, but does not claim corrupt-read/schema recovery or contextual draft restoration. Existing KV cash writes remain last-save-wins; the reusable conflict indicator is for consumers that actually receive a revision conflict, not a new concurrency guarantee.

## Local acceptance evidence

Python Playwright/Chromium: `scripts/test-internal-feedback.py` passes against Next dev configured with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787`, with all backend operations fulfilled by local synthetic fixtures and production Worker requests rejected. The scenario verifies:

- Invalid manager code retained, focused, marked aria-invalid and connected to the localized error.
- A valid unrelated preparer/date remains when missing location triggers a linked, actionable error summary; Spanish switching retains values and focus targets.
- Modal entry, forward/reverse focus containment, Escape, Cancel and trigger focus restoration by keyboard and touch in both languages.
- Device, pending send, server acknowledgment, waiting connection, denied-storage failure and context-change states.
- Editing during a held save cannot label newer data server-saved; acknowledged data stays acknowledged when only history refresh fails.

The UX-01 browser regression also passes after its confirmation expectation was adapted to the new dialog. That regression verifies language switching, retained mounted fields/files, held acknowledgment in a new language, canceled confirmation, denied preference storage, print recovery, portrait/landscape layout and credential absence from storage. Dictionary key/placeholder parity, TypeScript, build, SEO and existing cash-out calculation tests pass. No UI test called a live backend.

To reproduce, start the loopback API override dev server on 3017, then run `python3 scripts/test-internal-feedback.py http://127.0.0.1:3017` and `python3 scripts/test-internal-language.py http://127.0.0.1:3017`. The webapp-testing skill helper can manage the server. No new package is required. There is no deployment, staff observation, production write or live verification. Frontend publication remains REL-04; final Spanish/output policy remains DEC-07.

Rollback is the scoped UI/control commit, preserving all existing drafts and API records. API wire shapes and financial calculations are unchanged. Subsequent draft/navigation/conflict tasks should reuse these controls, with independently verified backend guarantees and explicit recovery rather than inferring a successful save.
