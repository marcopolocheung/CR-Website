# Step 06 checkpoint: focused cash entry

## Scope and baseline

- **Step 06 only**, implemented November 13, 2026; handoff November 14 / Codex. Owner and physical-device review pending.
- Source: merged main `bbb18dc87ea082d0e2ba252a3b20661c3ce88a8e` (PR #178), isolated branch `feat/overhaul-step-06-cash`, `/home/unusn/CR-step06`. Original checkout and prior worktrees preserved.
- Prior [Step 05](step-05.md) is merged; the user requested the next step. Prior access/draft/release limitations remain separate.
- Approved bank: unchanged Night shift / Layered paper / Patina teal v1.0. Reused fonts, icons, square paper surfaces, controls and save-state anatomy.
- Preview: loopback API `http://127.0.0.1:8787`; assistant/analytics/basePath empty. Dev on 3040; final static export on 3041. Every test API response is synthetic/intercepted and external origins are rejected. No service activation or production record access.
- Identity: final source/screenshot hashes in the [production manifest](../evidence/step-06/screens/results.json), plus [changed source/test hashes](../evidence/step-06/checks/source-hashes.json). The base commit alone does not identify the implementation diff.

## Result and interfaces

Cash now shows one selected AM/PM drawer with a keyboard-operable selector and explicit Add actions for either shift. Other drawers stay mounted and retain their inputs; keypad Previous/Next can cross drawer boundaries. Validation reveals and focuses an invalid inactive drawer instead of silently leaving it hidden. All drawers remain in printed output.

A consistent sticky summary shows day total, current drawer and turn-in, truthful save feedback and reachable Save. Its height is capped at half the measured visual viewport, leaving space for native entry in a reduced viewport. Count/Amount remain two synchronized alternatives with the full eleven denominations, explicit blank versus zero status and correctable invalid values. At small widths rows adapt to readable fields; monetary values and denomination labels do not split cents across lines.

Store/date/preparer selection is open before starting; active draft/context/download controls move into a named disclosure. Print/load/clear, keyboard/counting help and the existing saved-day table are named secondary controls. Saving history/lookup itself is not redesigned here (Step 07). English print behavior and familiar paper values remain compatible.

No financial, service, draft-schema or serialization changes: each drawer retains exactly $100, negative turn-in is preserved, and Extra money affects the day/Z comparison only. Raw device entry metadata and legacy unknown-status readers remain intact; server payloads still exclude device-only Count/Amount metadata. `EntryWorkspace.helpMode` is an opt-in presentation property; other consumers retain the inline-help default.

## Gates

| Gate | State | Evidence / limitation |
| --- | --- | --- |
| Local implementation and relevant behavior | pass | Focused mounted drawers, stable summary/save, secondary actions and paper parity |
| Local automated checks | pass | 64 domain/recovery/draft/session/contract/i18n tests; ten new focused scenarios; seven existing cash/language/recovery browser suites plus session/Home/Reports/shell compatibility; type/build/SEO |
| Local visual/task review | pass for emulation | Actual desktop/phone/enlarged/keypad/short-viewport captures reviewed against the bank |
| Physical touch/software keyboard and staff task review | pending | Headless touch and a simulated VisualViewport are not a real device or software keyboard |
| Owner review before Step 07 | pending | Review one real-shaped EN/ES task, especially native keyboard and paper output |
| New backend/policy readiness | not applicable | No API/Worker/migration/retention/approval model changed |
| Release/live verification | pending | PR only; existing main-push frontend deployment trigger unchanged |

## Scenario evidence

| Scenario | Expected and observed result | Evidence / boundary |
| --- | --- | --- |
| Single active drawer | AM/PM selector exposes one editor while every drawer's controls remain mounted; adding/removing drawers retains the other values | New production suite; active selector and panel semantics |
| Independent per-drawer math | $300 drawer → $200 turn-in; two → $400; $50 → −$50. Extra $20 makes day $420 without changing either Toast comparison | Literal fixture expectations, synthetic saved payload |
| All denominations | Independent $186.91 counted / $86.91 turn-in across all eleven denominations; Count and Amount stay synchronized | No calculation helper imported by browser test |
| Blank, zero and invalid | Blank Count distinct from entered 0; blank Toast/Z unavailable, entered 0 real; nonmultiple Amount and invalid inactive Count retained, blocked on save and revealed for correction | Raw drafts and payload guards verified |
| Keyboard/keypad | Native Enter/Shift+Enter/Tab retain behavior, no implicit save; arrows/Home select drawers; keypad advances AM→PM and closes with focus recovery | Existing keyboard regression plus new focused suite |
| Recovery | Denied storage, 401 and offline retry preserve fields; successful acknowledgment/reload and explicit fork/resume retain raw metadata/context; delayed saves do not mark newer edits saved | Synthetic service only, no live persistence/idempotency claim |
| Paper | Spanish screen prints English output with all AM/PM names, full denominations, Toast/Z/Extra and money; focused controls/navigation/keypad excluded | PDF assertions and prior cash output regression |
| Narrow/enlarged | 768/375/320px and 320px/200% text retain fields, no horizontal page overflow and single-line financial values | Six captures; physical device still pending |
| Reduced viewport | Simulated 430px viewport with pan offset leaves the focused penny input below the summary/above the keyboard boundary; Save/Close and 44px keypad targets remain reachable | Simulation only, explicitly not native keyboard observation |

## Checks actually run

All commands use `/home/unusn/CR-step06`. Portable output is in [checks](../evidence/step-06/checks).

| Command | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` | pass; dependency lock unchanged |
| `npm run cashout:test` | 27 pass |
| `npm run recovery:test` | 7 pass |
| `npm run forms:test` | 15 pass, including existing draft compatibility |
| `npm run internal:session:test` | 6 pass |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass |
| `npm exec tsc -- --noEmit` | pass |
| `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build` | pass; static export |
| `npm run seo:check` | pass |
| `scripts/test-cashout-focused.py` on static 3041, with `--rea` | 10 scenarios, six screenshots and full-drawer PDF; zero page errors/external attempts |
| Existing browser suites via external-request guard | cashout-entry, cashout-context, entry-workspace, internal-feedback, internal-drafts, internal-language and internal-recovery all pass |
| Cross-tool compatibility | 14 retained-session, 11 Home/Reports and 11 shell scenarios pass on static 3041 |
| Focused REA emitted-module analysis | summary and artifact identity retained; partial graph coverage disclosed in [investigation](../../investigations/internal-cash-focused-2026-11-13.md) |

Python is `/tmp/cr-step05-venv/bin/python` with the pinned baseline requirements and `LD_LIBRARY_PATH=/tmp/cr-step05-browser-libs/root/usr/lib/x86_64-linux-gnu`. The cash entry, EntryWorkspace and language suites were replayed on final static 3041; context/feedback/draft/recovery regressions also ran on dev 3040. Exact replay commands are in the [evidence README](../evidence/step-06/README.md).

Old tests explicitly open the new named disclosures and select the appropriate drawer before retaining their original calculation, focus, print, quota and conflict assertions. Initial print failure was caused by Tailwind's layered important HTML-hidden rule overriding paper CSS; inactive screen state now uses a data attribute, with print exposing every drawer. Phone financial wrapping was corrected with unbroken money and responsive denomination rows. Raw development diagnostics remain under ignored `.rea/step06-checks/`; final portable logs contain passing runs.

## Recovery and remaining work

- Rollback: revert this presentation slice and optional EntryWorkspace help mode, preserving original readers, keys, accepted records and service adapters. No storage clearing, schema migration or accepted-write reversal is required or authorized.
- Domain math, saved record shapes, formula helpers, server contracts and Worker code are unchanged. Existing legacy saved-history/retention and last-save-wins limitations remain; no approval/recount/deposit workflow was added.
- Unverified: real physical touch/software keyboard, staff review, full accessibility conformance, live service activation/persistence/retention and historical encrypted-link browser decryption. Local mock saves and native-keyboard-sized geometry do not close those gates.
- Review next: complete the real-device EN/ES scenario and inspect paper output. Step 07 (saved lookup/save-history semantics) may be requested after review; it has not begun. Stop here, with no merge/deployment or next-step work.
