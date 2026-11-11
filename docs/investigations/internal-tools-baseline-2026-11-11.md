# Step 01: current-source and local-runtime baseline

November 11, 2026. Fetched main `f657779`; isolated branch
`chore/overhaul-step-01-baseline`. This investigation preserves the application
before the internal-tool redesign. See the [dated baseline](../internal-tools-overhaul/baselines/2026-11-11/README.md)
for current-source capabilities, fixtures, screenshots and exact results, and the
[checkpoint](../internal-tools-overhaul/checkpoints/step-01.md) for review gates.

Observed locally: the built frontend uses the explicit loopback API override;
requests in fresh browser profiles are mocked and externally guarded. The current
code already includes context drafts, bilingual infrastructure, Count/Amount,
Extra money, saved digital forms, import directory/history/comparison, scheduling
requests and optional assistant support. Historical absence claims are not used
as implementation requirements. Local simulations and mocked reads/writes do not
prove live service activation or deployed schema/binding state.

REA evidence retained under the implementation worktree's ignored `.rea/runs/`:

| Evidence | Target / coverage | Finding / limit |
| --- | --- | --- |
| `ev_95c7f078e6b98fc812fa2e64fce2784b240afa123a35e4f630ff3dc78310388f` (parent), `ev_68cfef110d0f5c351f3adf45969b53b4c6a7f9de5d0222a493e7c6bd7009ec43` (summary) | Local `out/`, artifact SHA-256 `b2ca29624549e6737bc579a2f052d5b783027235723afd7a4955fbeedccdd386`; selected `_next/static/chunks/b82dae5994d4afe7.js` only | Emitted API module embeds `http://127.0.0.1:8787`; production fallback remains in code but explicit override wins. One parsed file, 64 unselected; graph partial, 64 application / 1410 semantic unknowns. Static syntax is not execution evidence. |
| `ev_3c2f2fac14fdc5d29f117f3ad7b5002fecb18e4ef92b570f301bdcb73ca70cb1` | Attached loopback Bookkeeping page, fresh Chromium profile, accessibility and storage-key inventory | Empty chooser is observable; no storage values retained. Capture starts at attach; earlier network activity, scripts and runtime coverage are not established. |
| Initial full-bundle partial `ev_3d19f018356bc7e068daa613faadcc52d0a2abbe9217369a9465e7be9b8ff6e8` | Same export, `.rea/runs/20261111T165402.365059Z-829f5b2b` | Exit 1, provider timeout at 300000ms on one source. Partial raw evidence and diagnostics retained; bounded retry passed. Do not describe full analysis as complete. |

Portable [bundle summary](../internal-tools-overhaul/baselines/2026-11-11/rea-bundle-summary.json),
[browser summary](../internal-tools-overhaul/baselines/2026-11-11/rea-browser-summary.json)
and [timeout record](../internal-tools-overhaul/baselines/2026-11-11/rea-full-analysis-limit.json)
preserve identity and limits. Browser task assertions/screenshots are separate
Playwright evidence; REA's passive attach does not claim to have performed them.

Unresolved: live capability activation, real phone/software-keyboard behavior,
staff acceptance and browser decryption of an actual historical encrypted link.
Existing Worker handler tests still exercise encrypted-record lifecycle, stale
revisions and visibility; current public station reader is a different client.
No production records, drafts or links were inspected or modified. No deploy,
production writes, persistent migration or Step 02 work occurred.
