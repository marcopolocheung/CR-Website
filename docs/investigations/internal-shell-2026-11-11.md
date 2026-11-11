# Step 03: internal-shell runtime evidence

November 11, 2026; baseline main `6281dee`, branch `feat/overhaul-step-03-shell`.
The [checkpoint](../internal-tools-overhaul/checkpoints/step-03.md) and
[review evidence](../internal-tools-overhaul/evidence/step-03/README.md) record
the actual implementation, local checks, screenshots and review limitations.

REA observations were retained using the installed reverse-engineer-anything workflow:

| Evidence | Selected target / coverage | Observed facts and limits |
| --- | --- | --- |
| `ev_f41b47c015d77a9c11f8871e409923318b303415f209d9e9003e91bb86af8c82` (parent), `ev_2c11a8c5782e898ea7f28443c2d7aa0c940d40f61dd0e6d1fae1dfb289f13a5d` (summary) | Local export `out/`, SHA-256 `92cafbb079157d3f599fbd18e15f0b6d91b3916136540bab90dbed4cf7a18c0d`; selected emitted `_next/static/chunks/1d12c6e9350a620b.js` | One parsed shell module, 67 unselected inventoried files. Application/semantic coverage partial, with 67 application and 1603 semantic unknowns. Summary pagination is complete within its view; this does not mean complete application analysis. Syntax is inert, not evidence of execution. |
| `ev_ddb8ba8cb3166e5d65161541ea03e2844e9ad0d9bda84437de5870c03d1a3098` | Passive attach to `http://127.0.0.1:3031/internal/bookkeeping.html#cash-out`, fresh Chromium profile | Current DOM/accessibility and storage-key inventory; storage values excluded. Capture is attach-limited and policy-filtered, with scripts/resources omitted. It does not prove activity before attachment or perform the Playwright interactions. |

Portable [bundle summary](../internal-tools-overhaul/evidence/step-03/rea-bundle-summary.json)
and [browser summary](../internal-tools-overhaul/evidence/step-03/rea-browser-summary.json)
preserve target identities, evidence IDs, coverage and limitations. Raw results,
diagnostics and provenance remain in this worktree's ignored directories:

- `/home/unusn/CR-step03/.rea/runs/20261111T192016.787329Z-aabb5bc7`
- `/home/unusn/CR-step03/.rea/runs/20261111T192016.767969Z-e78e7709`

Independent Playwright assertions passed eleven shell scenarios: six destinations,
active navigation, old hash/slash/HTML routes, actual task context, exact mounted
File identity, retained cash/sales/hours fields, Back/Forward, skip focus, canceled
departure, quota denial, existing local lock callbacks, EN/ES, responsive/enlarged
shell, motion, print and scheduler/public links. Seven screenshots and a Cash PDF
are retained. Browser requests used synthetic GET/OPTIONS responses only; writes
were refused, with zero external attempts and zero page errors. This action-level
coverage is separate from the later passive REA observation.

The manifest records 40 actual source/test hashes above the base commit and seven
screenshot hashes. A separate `/review` dev preview checked six prefixed links,
same-document Cash/Reports navigation and the Inventory route. It does not verify
production hosting redirects.

Development failures and corrections are recorded in the checkpoint, including
metadata refresh feedback, sticky-header geometry, exact path/hash retention and
transient moving-surface overflow on resize. No unexplained failing scenario is
represented as passing.

No production target, record schema, draft serialization, business formula or API
adapter was modified. No deploy, migration or Step 04 implementation occurred.
Physical touch/software keyboard, owner/staff acceptance, full accessibility
conformance, deployed service/persistence behavior, production redirects and
historical encrypted-link browser decryption remain unverified.
