# Step 05 Home/Reports evidence — November 13, 2026

Baseline merged main: `256b3e3619915ac886aebd758100febe8fad4524`.
The [production browser manifest](../internal-tools-overhaul/evidence/step-05/screens/results.json)
identifies final working-tree source hashes and screenshots. Synthetic loopback
responses only; no activated backend or real record is implied.

## Static artifact

Raw results and diagnostics are retained under
`.rea/runs/20261113T223336.772506Z-2aa7afb6/`. Read the
[portable summary](../internal-tools-overhaul/evidence/step-05/rea-static-summary.json) first.

- Artifact: `/home/unusn/CR-step05/out`, SHA-256 `46330c6baf22944ea9753b33a4f94942fc4d8e27cfde3c6d6740e5c6914119d5`.
- Parent evidence: `ev_62bf57c5de0eb99bf479ce931e54b2a173085144ccbe8f49525a43cc01891a84`.
- Summary evidence: `ev_15cd1b938ec32dc54559592e78e9956284a0415807f5dbdd65455d31beb15da7`.
- Four selected emitted modules containing `home.tasks` parsed with no failures;
  selection paths are retained in the summary. 66 inventoried files were unselected.
  Application/semantic graph coverage is partial; 2285 semantic unknowns remain.
  Inventory identity covers the full artifact, but selected-source observations
  do not prove execution, absence of other relationships or live persistence.

Reproduce with `rea-project analyze /home/unusn/CR-step05/out --project /home/unusn/CR-step05`
and the four exact `--source-path` values from the retained summary.

## Runtime observation

The Playwright suite independently verifies 11 scenarios, including Home's zero
API requests, independent report expectations, failure versus empty, retained
inputs/Files, identical active-link selection and direct export aliases.

A passive REA attach to the final static Reports page is retained under
`.rea/runs/20261113T223335.217221Z-5abae41d/`. Its
[extracted summary](../internal-tools-overhaul/evidence/step-05/rea-passive-summary.json)
is a projection of original stdout, not a separately authored REA analysis view.

- Evidence: `ev_09e6af1e8373c5f4b371f783e8d4d798e84ecf77ca8040a4ddfb16f0b82415a3`.
- Target: `9ABEB6ED0EA34610C345D8775C567726`, `http://127.0.0.1:3039/internal/reports`.
- 1,568 observed DOM nodes; coverage is `attach_limited` and `policy_filtered`.
  The attach does not establish previous browser actions, earlier network events,
  filtered script/source-map contents or console text.

Physical touch/software keyboard, staff acceptance, full accessibility, production
hosting redirects/basePath and live services remain unknown. The artifact analysis,
passive snapshot and browser action assertions are separate evidence types.
