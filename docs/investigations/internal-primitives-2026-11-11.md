# Step 02: shared-primitives runtime evidence

November 11, 2026; baseline main `b800af4`, branch `feat/overhaul-step-02-primitives`.
The [checkpoint](../internal-tools-overhaul/checkpoints/step-02.md) and
[gallery evidence](../internal-tools-overhaul/evidence/step-02/README.md) record actual
local behavior, screenshots, checks and review limits.

REA observations were retained with the installed reverse-engineer-anything workflow:

| Evidence | Selected target / coverage | Observed facts and limits |
| --- | --- | --- |
| `ev_294389048b489ea69a6269e7a70de49ebd18c1a23434112edfd4b3bd3fb69508` (parent), `ev_6a2dafe95e7dc24fb44049211d591bfa137867d2e01958d395085058d9e05cef` (summary) | Local export `out/`, SHA-256 `265f06fd8c04fd6c62a6424d8e488b70b4baa7d7085d01d1a28f48b0eaf95391`; emitted `_next/static/chunks/713935395819ca43.js` only | One parsed gallery module, 66 unselected relevant files; graph/semantic coverage partial, 66 application and 1016 semantic unknowns. Syntax/configuration provenance, not runtime execution or full reconstruction. |
| `ev_bae26dd8636198cf7e83c0674f7c0fd4bb55f50e7a8fde4ff20d84f0cf29e4ff` | Attached `http://127.0.0.1:3029/internal/ui-gallery`, fresh Chromium profile | Accessibility/storage-key inventory and current DOM; no raw storage values. Attach window omits earlier network/history; selected script/resources are filtered. Passive REA did not perform the Playwright interactions. |

Portable [bundle summary](../internal-tools-overhaul/evidence/step-02/rea-bundle-summary.json)
and [browser summary](../internal-tools-overhaul/evidence/step-02/rea-browser-summary.json)
preserve IDs, target identities, coverage and limitations. Raw results/diagnostics
remain in `/home/unusn/CR-step02/.rea/runs/20261111T182705.254887Z-20ba2593`
and `20261111T182712.533712Z-02f804cd`.

Independent Playwright assertions exercised one moving surface, selection/focus
semantics, responsive and enlarged-text alignment, errors, busy/disabled controls,
EN/ES retention, touch emulation, reduced motion and synthetic print. They recorded
zero page errors and zero API/external requests across the scenario, which is
stronger network coverage than the later passive attach. Source hashes in the
result manifest identify the actual implementation above the base commit.

The initial enlarged-text failure was traced to the existing unwrapped language
control group, fixed by allowing wrapping, and reverified. Initial color assertions
assumed OKLCH serialization; the production optimizer emits equivalent Lab, so the
corrected check compares browser-rendered color values. Actual and approved red
both produced `[159, 7, 18, 255]`.

No production target, staff data, record adapter, schema or business formula was
modified. No deploy, migration or Step 03 implementation occurred. Physical
touch/software keyboard, staff acceptance, full accessibility conformance and
Step 01's live-service/encrypted-link browser limits remain unverified.
