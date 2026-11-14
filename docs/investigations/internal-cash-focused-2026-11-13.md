# Step 06 focused cash evidence — November 13, 2026

Baseline merged main: `bbb18dc87ea082d0e2ba252a3b20661c3ce88a8e`.
The [production browser manifest](../internal-tools-overhaul/evidence/step-06/screens/results.json)
identifies final source and screenshot hashes. Tests use synthetic intercepted
loopback APIs, not activated services or real financial/staff records.

## Static artifact identity

`rea-project analyze /home/unusn/CR-step06/out --project /home/unusn/CR-step06 --source-path _next/static/chunks/7ee2e188e5a7f91b.js`
retained raw evidence/diagnostics under `.rea/runs/20261113T224842.121393Z-3f069e05/`.
Read the [portable summary](../internal-tools-overhaul/evidence/step-06/rea-static-summary.json) first.

- Artifact SHA-256: `c293e79141128b40801fd464f17831db08f76233672577bc4043aa2100c77746`.
- Parent evidence: `ev_5d0898659f1b668947e03c062e7651d0267ceb4056e54635721bbddb8d934e8f`.
- Summary evidence: `ev_72ef4e8c0fc5bc9ed0c9976b6ca1059511046e8cf5a8662f942f0d1acd16806d`.
- One selected emitted module parsed without failures; 69 inventoried files were
  outside the selection. Application/semantic coverage is partial and 2,639
  semantic unknowns remain. Inventory identity covers the full artifact, but
  selected static syntax/relationship candidates do not prove runtime behavior,
  arithmetic correctness or backend availability.

## Runtime observation and limitations

The browser suite independently verifies ten scenarios: drawer isolation with
mounted input retention, all-denomination alternatives/invalid correction,
independent per-drawer and Extra money figures, signed negatives, lifecycle and
keyboard/keypad navigation, storage/auth/offline recovery, all-drawer print,
late acknowledgments, explicit reload/resume and responsive financial readability.

A passive REA attach to the final static page is retained under
`.rea/runs/20261113T224818.672598Z-51827eee/`. Its
[extracted summary](../internal-tools-overhaul/evidence/step-06/rea-passive-summary.json)
is a readable projection of original stdout, not a new REA analysis-view record.

- Evidence: `ev_cfe4263db8ed0d65703ef735f632ecc635c151ef14a0df9030834fbc99a38471`.
- Target: `78513D06B261ADF20428D8BB17332BD0`,
  `http://127.0.0.1:3041/internal/bookkeeping#cash-out`.
- 858 observed DOM nodes; `attach_limited` and `policy_filtered` coverage. The
  snapshot does not establish earlier browser actions/network events, filtered
  console text, scripts or source-map contents.

The selector/summary/data-preservation assertions come from the controlled browser
scenarios, not the passive attach. The short VisualViewport and touch checks are
emulation. Real software keyboard, physical touch, staff task acceptance, full
accessibility, live persistence/retention and historical encrypted-link browser
behavior remain unverified. No production deployment or records were changed.
