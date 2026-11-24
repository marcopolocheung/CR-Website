# CR3 inventory views: artifact and local runtime evidence

November 23, 2026 (captures November 24 UTC). Step 12a, branch `feat/overhaul-step-12a-inventory-views`, based on `88098c0`. See the [checkpoint](../internal-tools-overhaul/checkpoints/step-12a.md), [approved plan](../internal-tools-overhaul/evidence/step-12a/approved-plan.md) and [hash manifest](../internal-tools-overhaul/evidence/step-12a/source-hashes.json).

## Identity and scope

The local production export was built with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`. Static serving used `http://127.0.0.1:3048`. Disposable Chromium 158.0.8127.18 contexts intercepted every API call at loopback, blocked external requests and used synthetic records only. No live service or physical device was observed.

REA 6.8.0 analyzed `/home/unusn/CR-step12a/out` with caller-selected source `_next/static/chunks/4e069c84a111834e.js` through `rea-project analyze ... --source-path ... --project /home/unusn/CR-step12a`. Raw results, diagnostics and provenance remain under `.rea/runs/20261124T012803.397531Z-2263222f/`. The summary was read first. Portable [artifact summary](../internal-tools-overhaul/evidence/step-12a/rea/artifact-summary.json) and [run](../internal-tools-overhaul/evidence/step-12a/rea/artifact-run.json) are retained.

- Export inventory SHA-256: `d2523604509b84edb1193586ec07a4fb56157dfe1f87b358dbdec689943ea9d2`.
- Selected emitted chunk SHA-256: `e35b64d859d8934d11d293e34ff801ca930b932489c96162030e09dfd816931e` (58349 bytes).
- Parent static Evidence: `ev_579279b31d25c8abf84a068ce3cb605637c019d90cedaf0ed6cc90edffef34a8`; summary Evidence: `ev_9b9acf3e1759a4d274e38c7014fe65cd3f235bdcfdfa9a6bd9dd76bb136c7150`.
- Parsed 1 selected JavaScript file, 16609 AST nodes, 0 parse failures. The other 79 inventoried files were outside static analysis scope. Application/semantic graphs remain partial with 79 application unknowns and 4306 semantic unknowns. Complete-within-view summary coverage does not imply complete application analysis.

A superseded whole-export analysis was terminated (143) while implementation/build output was still changing. Its raw partial results remain in `.rea/runs/20261124T011827.057707Z-56e43725/`; [run/diagnostics](../internal-tools-overhaul/evidence/step-12a/rea/superseded-wide-run.json) preserve that limit. No conclusion depends on that incomplete run.

## Observations and findings

| Question | Evidence | Conclusion and limit |
| --- | --- | --- |
| Did the local export contain the inventory implementation? | Selected emitted chunk hash and static Evidence above; source hashes | Observed inert emitted JavaScript. This establishes selected artifact presence and parse coverage; static analysis did not execute bootstrap or prove behavior. |
| Does Count retain its work and access boundary? | Playwright counting suite, passive REA `ev_4213be25748a685c05a797f3244dedd69b22a8b6b6de67a32f0f8ab5c0cbebea`; [Count capture](../internal-tools-overhaul/evidence/step-12a/rea/count-page.json) | Browser assertions exercised six count states, stable progress, retained identities, recovery, late reads/saves and unchanged wire fields. Passive REA observed the final loopback page and storage key names only. |
| Does saved browsing remain independent? | Playwright views suite, passive REA `ev_9ec635aabf44aa809986d45a7a643fec95a5de41417f57e2d0ae9404d82b443a`; [History capture](../internal-tools-overhaul/evidence/step-12a/rea/history-page.json) | Synthetic requests and byte comparisons show lookup did not issue PUTs or replace working fields/date/device bytes. Saved records used server values and validated matching-date device labels or declared fallback; stale/newer/session cases were exercised. REA did not perform those actions. |
| Do report values preserve identity? | Three independent PDF checks and full five-pair row/value assertions in `scripts/test-inventory-views.py` | Selected saved report uses server values, explicit IDs and provenance; checklist uses its supplier filter; English full report contains all captured rows and baseline columns. No unit conversion or mixed-unit total was inferred. |

## Coverage and unknowns

REA browser captures are attach-window snapshots with no artifact digest identity, prior network/console activity, raw headers/bodies/cookies/storage values or proof of unobserved interactions. Their target IDs, loopback endpoints, capture completeness and limitations remain in the portable page/run files. Script URLs and matching local build hashes support an association to the local test run; no REA runtime/source digest reconciliation is claimed.

The observed behavior is limited to local synthetic APIs, Chromium emulation, requested viewports/languages, keyboard interactions and generated PDFs. Server persistence/retention, real supplier actions, physical touch/software keyboard, staff acceptance and deployed/live behavior remain unverified. No Worker route/schema/migration was changed. Rollback retains existing device envelopes, archives, original recovery bytes and server records.
