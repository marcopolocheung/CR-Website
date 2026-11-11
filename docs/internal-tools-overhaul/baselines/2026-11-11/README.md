# Step 01 baseline — November 11, 2026

Source: `f657779` (`f657779` is the fetched main merge of the approved design bank).
Implementation branch: `chore/overhaul-step-01-baseline`, isolated worktree
`/home/unusn/CR-step01`. The original `/home/unusn/CR` checkout remains on
`docs/night-shift-design-bank`; its tracked tree was clean and its ignored data,
drafts, agent database and build outputs were left alone.

This is the existing application before the experience rewrite. No visual primitives,
navigation, calculation, record, route or service contract changed. The approved
Night shift / Layered paper / Patina teal bank v1.0 is unchanged (all 15 hashes match).
Owner review is pending at the [Step 01 checkpoint](../../checkpoints/step-01.md).

## Environment and capability table

Frontend: Node **22.22.0**, locked `npm ci`; static Next export. Exact build:

```sh
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
```

The API is a browser interception target: **no persistent Worker was started** on
8787. Playwright 1.65.0 / Chromium 158 is pinned by the fixture requirements. Tests
use fresh profiles, block service workers and external page requests, and never
open the owner's storage. On this host Chromium's missing libraries were supplied
from disposable extracted `libnspr4`, `libnss3`, `libasound2t64` packages under
`/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu`; system installation
was not changed. Prefix browser commands here with:

```sh
LD_LIBRARY_PATH=/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu
```

A normally provisioned Playwright host does not need that prefix. Browser request
isolation is not a host firewall. The baseline guards observe page requests, not
browser-internal update traffic.

| Capability | Current source evidence | Observed local activation | Production status |
| --- | --- | --- | --- |
| API selection | `src/lib/schedule-store.ts` uses the configured override, else the production Worker URL | Emitted module contains literal loopback override; baseline requests all mocked; zero external page requests | Production fallback remains intentionally unchanged; no live probe |
| Cash / dashboard | `cashout.ts`, `cashout-store.ts`, `CashOut.tsx`, `Dashboard.tsx`; Count/Amount, Extra money, fixed $100 per drawer, null comparisons, CR2/CR3 | 27 domain tests; cash browser entry/context checks; independent $300 drawer / $200 turn-in fixture; failure/resume | Worker activation unverified; legacy lookup is 30 days / 31-day expiry, not durable history |
| Inventory | `inventory-store.ts`, `Inventory.tsx`; CR3 count/catalog and free-text quantity model | Inventory/domain suite and initial locked route captured | No CR2 counting UI or new count-session API claimed; no live inventory read/write |
| Sales/hours/imports | `converter/*`, sales/hours components, mapping/history/comparison stores; review, retained snapshots and source hours already exist | 52 domain tests, hours browser suite; partial CR2/CR3 source rows; ephemeral Worker tests | Directory/history require active D1 and migrations; unverified remotely |
| Drafts / access / language | `internal-tools/*`, `InternalLanguage`, mounted Bookkeeping panels | Recovery/forms/contracts/i18n tests; browser draft/context/recovery/language suites | Device drafts are independent from server acknowledgement; token stays in memory |
| Forms | `WriteUps`, `DigitalForm`, `digital-form-store`, `writeup-store`; saved digital forms plus immutable legacy originals | 15 forms/domain tests, saved-list browser suite and empty/failure captures | KV-backed source; no live saved-form create/delete |
| Scheduler / public reader | `scheduler/*`, `schedule-store.ts`, `ScheduleViewer`, `restaurants.ts` | 145 tests; browser manager/staff layouts, all four station routes, publication/visibility/qualification checks | Public reads and separate staff-edit/manager permissions preserved; no live publish |
| Requests / atomic records | `worker/src/record-mutations.ts`, request/directory/history modules, checked-in migrations | Isolated ephemeral `getPlatformProxy` KV/D1/R2 tests, `remoteBindings:false`, `persist:false`; request suites pass | Local schema tests do not establish remote bindings, migration state or policies |
| Local vs deployment Worker | `worker/wrangler.local.jsonc`: local KV/D1/R2, `remote:false`, `workers_dev:false`; `worker/wrangler.toml`: placeholder KV ID, no D1/R2 declarations | Existing Worker tests instantiate disposable local simulations; no persistent migration/seed command run | Actual deployed config/version/capabilities unknown; health alone would not prove them |
| Optional assistant | `agent/server.ts`: optional separate service; built-in planner unless both Anthropic key/model configured; SQLite path configurable | `NEXT_PUBLIC_AGENT_API=` disables frontend panel; no assistant server/model started; 13 synthetic agent tests pass | Live assistant URL, credentials, model and SQLite persistence unverified |
| Encrypted legacy records | `worker/src/index.ts` `/api/weeks[/:id]`; opaque ciphertext, ID, revision, visibility and TTL behavior | Existing Worker handler tests (included in scheduler suite) plus lossless contract round trips | Current frontend viewer is station/public. End-to-end opening/decryption of an old encrypted link unverified; no link removed or rewritten |

Source paths above are rooted at the source commit, not assertions copied from the
October inventory. In particular, the current source has bilingual infrastructure,
context-bound drafts, D1 migrations/import history/requests, digital forms,
Bookkeeping comparison, Count/Amount, Extra money and the assistant. Historical
absence claims in `current-state.md` are superseded for these facts by this dated
record; their old test results and task milestones remain historical.

## Compatibility entry points

The fixture harness checks HTTP 200 and a hydrated title for these 15 routes:

- `/internal`, `/internal/bookkeeping`, `/internal/inventory`, `/internal/forms`, `/internal/qr-generator`.
- `/scheduler-demo` and `/schedule` station pickers.
- `/scheduler-demo/{station}` and `/schedule/{station}` for `CR2-diningroom`,
  `CR2-kitchen`, `CR3-diningroom`, `CR3-kitchen`.

It verifies selected tabs and visible panels at Bookkeeping `#cash-out`, `#sales`,
`#hours`, `#comparison`. The existing scheduler browser suite additionally exercises
`.html` station URLs. Source station default remains CR3 Dining Room; CR3 Kitchen
remains the special schedule-only station. Preserve query `restaurant` as station
identity and cash store CR2/CR3 as physical-store identity.

Encrypted entry points remain `/api/weeks`, `/api/weeks/{id}` and their existing
ciphertext/ID/revision contract. This work does not fabricate an encrypted browser
URL or decrypt an owner record. Public viewer source does not implement that old
reader; access through an actual historical client/link remains an explicit gap.

Local review uses [serve.py](../../../../scripts/overhaul-baseline/serve.py), which
resolves exported HTML for extensionless and slash URLs. This convenience is **not**
verification of GitHub Pages slash/redirect behavior. No production HTTP requests
or writes were made. `.github/workflows/deploy.yml` deploys on a main push: the PR
must remain unmerged until release/review authorization; this task deploys nothing.

## Fixtures and rendered states

[Fixture tooling](../../../../scripts/overhaul-baseline/README.md) describes replay,
disposal and dependencies. Identity: `step01-2026-11-11-v1`; only synthetic people,
names, codes, financial entries and CSV rows are used.

The generated [browser manifest](browser-results.json) records exact viewport sizes,
scenario observations, API request paths and screenshot SHA-256s. Baseline widths
are **1440×1000** and **375×1000**. Existing suites add **768×1024** touch emulation
and **390×844** phone coverage, as well as scheduler desktop/phone layouts. These
are headless browser observations, not real touch/software-keyboard evidence.

| State | Representative image | Observation |
| --- | --- | --- |
| Initial Home | [Home](internal-initial.png) | Existing tool launcher and cash gate |
| Initial inventory/forms | [Inventory](internal-inventory-initial.png), [Forms](internal-forms-initial.png) | Existing locked entry points |
| Empty cash | [Cash](cash-empty-desktop.png) | Explicit store/date/preparer draft chooser |
| Empty forms / unavailable history | [Empty](forms-empty-desktop.png), [Failed](forms-history-failed.png) | Failure is distinct from no saved forms |
| Populated cash | [CR2 desktop](cash-CR2-populated.png), [CR3 phone](cash-CR3-populated.png) | AM $300 drawer, $200 turn-in, entered-zero Toast +$200; untouched PM remains a blank $0 drawer with −$100 turn-in |
| Interrupted cash | [CR2](cash-CR2-interrupted.png), [CR3](cash-CR3-interrupted.png) | Reload relocks; choosing original store/date reveals preserved draft; resume opens a copy |
| Failed cash save | [CR2](cash-CR2-save-failed.png), [CR3 phone](cash-CR3-save-failed.png) | Mock 503 reports failed, retains count/name; no successful write |
| Partial hours | [CR2 desktop](hours-CR2-partial.png), [CR3 phone](hours-CR3-partial.png) | 2 rows, 1 included/1 excluded, 8 included hours; missing ID/open punch visible and download disabled |
| Public initial | [CR2 Kitchen](schedule-CR2-kitchen-initial.png) | Empty publication state; no invented staff shifts |
| Scheduler populated | [Desktop](scheduler-schedule-new-desktop.png), [Phone](scheduler-schedule-mobile.png) | Synthetic Sample Employee; screenshots produced by the existing scheduler suite |

Only the populated AM drawer has the $200 oracle. The incomplete day is $100
because its untouched PM drawer also retains $100; no new blank-day arithmetic
policy was introduced. “Synthetic matched” is a fixture name, not a claim that
shared employee identity has been approved; its mapping is still unmatched.

## Actual checks and evidence limits

[Domain command results](checks/domain-results.json) contain exact commands,
counts and exit statuses: **283 tests passed**, no failures/skips across ten command
families. [Contracts/i18n/business dates](checks/contracts-i18n-dates.log) add **12**
passing tests. [Build](checks/build.log), [types](checks/typecheck.log) and
[SEO](checks/seo.log) exited zero. [Eight existing browser suites](checks/browser-suite-results.json)
passed under the guard, with zero external attempts. Portable build output normalizes terminal progress-line endings/trailing spaces; raw bytes remain in `.rea/step01-checks/build.log`. The custom capture results
and actual counts are in `browser-results.json` and `checks/browser-baseline.log`.

The first browser attempt failed before launch because of missing host libraries.
After the disposable library repair, all existing suites passed. During development,
the new capture harness was corrected for same-document hash navigation, explicit
store/preparer selection after reload, the actual “Resume as a copy” control and
save-feedback role, and the forms reload path. Those were tooling assumptions,
not pre-existing application regressions. Final results refer to the corrected
harness. No application behavior was changed to make a check pass.

[REA bundle summary](rea-bundle-summary.json) identifies the local export digest and
the selected emitted API module. Its analysis is deliberately limited to one of
65 inventoried relevant files; 64 are outside analysis scope. Graph/semantic
coverage remains partial (64 application and 1410 semantic unknowns), so this is
artifact/configuration provenance, not a full behavioral reconstruction.
[REA browser summary](rea-browser-summary.json) identifies the attached local page,
observed accessibility/storage-key inventory and its filtering/attach limitations.
No storage values are retained. The full raw runs and diagnostics remain in this
worktree's ignored `.rea/runs/`; the portable summaries preserve IDs and limitations.
[Full-analysis limit](rea-full-analysis-limit.json) records the initial whole-bundle
300000ms per-source timeout; its raw partial observation was preserved, and the
retry selected only the API module instead of claiming whole-bundle success.

Staff acceptance, live APIs/bindings/retention, current deployed artifact identity,
real phone keyboard/touch, full accessibility conformance, new 320px/enlarged-text
review, reduced-motion review and old encrypted-link browser decryption remain
**unverified**. Existing browser scripts cover selected keyboard, English/Spanish,
print/PDF and mocked save/reload/conflict behavior; that is not live persistence.
No redesign or Step 02 implementation is included.
