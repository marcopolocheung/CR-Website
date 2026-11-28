# Forms workspace: source, artifact and local runtime evidence

November 27, 2026 / Codex (final captures November 28 UTC). Step 13 on `feat/overhaul-step-13-forms`, based on main `7c0aff9`. The [checkpoint](../internal-tools-overhaul/checkpoints/step-13.md), [approved contract](../internal-tools-overhaul/evidence/step-13/approved-plan.md) and [hash manifest](../internal-tools-overhaul/evidence/step-13/source-hashes.json) establish scope and identities.

## Artifact identity

Production export: `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build`. Static service: `http://127.0.0.1:3050`. REA 6.8.0 analyzed `/home/unusn/CR-step13/out`, selecting `_next/static/chunks/1a3d45801d2c2248.js` through `rea-project analyze ... --source-path ... --project /home/unusn/CR-step13`. The authenticated summary was read first.

- Parent static Evidence: `ev_fd7b26a80a4dacc8efe82f58fd2e36ab7b7ddc40edea7ae6f9f812c7180cb817`; summary Evidence: `ev_ef2f9202f418591a07b2d0b3bbb6ac8c2d03ead0f987f66225abe405ee60d155`.
- Export inventory SHA-256: `0544b446ad4327ca36f64e4d6165d8ced6af5ed65b771011816dd1f95090e0ac`.
- Selected emitted chunk SHA-256: `feea60dc0e776f08d2606dcd9cd0ca23f6243d8e456d8de4d34c1f792d94beda`; 65055 bytes.
- One selected JavaScript file parsed, 16741 AST nodes, zero parse failures. The other 79 inventoried source files were outside analysis scope. Application/semantic coverage remains partial, with 79 application unknowns and 4098 semantic unknowns.

[Portable summary](../internal-tools-overhaul/evidence/step-13/rea/artifact-summary.json) and run/diagnostics preserve coverage and limitations. Full raw results stay under `.rea/runs/20261128T001600.091310Z-46be39f9/`. Static syntax does not establish execution or complete application behavior.

## Runtime and behavior evidence

Playwright performed the interactions in disposable Chromium 158.0.8127.18 contexts. Mocked suites block external requests and intercept API calls at explicit loopback port 8787. The digital-form suite instead used the unchanged Worker with synthetic records in a fresh disposable local KV directory, and verified each created record was deleted and returned 404 at completion.

The installed Wrangler/workerd cannot execute the repository configuration's September compatibility date. Local verification explicitly used `--compatibility-date 2026-05-03`, `--local`, synthetic `SCHEDULE_WRITE_TOKEN`, and `/tmp/cr-step13-worker-final` persistence. This is evidence for that local runtime only; the repository configuration, Worker routes/schema and deployed service were not changed or verified.

| Question | Evidence | Observed result / limit |
| --- | --- | --- |
| Library and active-work separation | New workspace suite, 14 scenario groups | Saved/Drafts/Blank navigation, direct hashes/legacy URL forms, copied draft identity, original bytes, language/reload/storage/access recovery and preserved editor/review were asserted. Browsing/review caused no POST. |
| Record/request safety | Mocked held/reordered/expired reads and POSTs | Newest record selection wins; late 401 cannot revoke a same-code unlock; double-click Save produces one POST; old-session acknowledgement cannot mark current draft saved. Every newly saved identity requires another explicit acknowledgement before creating a separate record. No backend idempotency is inferred. |
| Existing service persistence | Local Worker digital suite | All five types saved, reopened, labeled and deleted; labels use label-only requests and immutable fields remain unchanged. Stale-list metadata retains acknowledged rows and deleted rows stay removed. This does not establish live persistence. |
| Print compatibility | Six PDFs plus existing compatibility browser suite | Original English fields, declarations, options, amounts, signature/name text and all 40 narrative lines were checked independently. The write-up's checked paper inputs were also checked against independent expected selections. Original write-up paper renderer is byte-identical after export/import extraction and sits outside the screen theme to preserve its typography and field rules; all eleven blank download bytes/formats/URLs remain compatible. |
| Local appearance and access | Screenshots at 1440/768/390/320px, enlarged Spanish, keyboard/section focus and reduced motion; existing shell/session/recovery suites | Layouts were inspected and narrow filter bounds corrected. Emulation and generated PDFs do not establish physical touch/software-keyboard or staff terminology acceptance. |

REA passively observed the final requested loopback page, after Playwright actions: Evidence `ev_f108dfa579cbd7c605ae256385efe2474c8f97cce6d5e2d967384bb7995253d3`, target `8B544A59FC3BAB50A1B4C4C1C9261A67`, URL `http://127.0.0.1:3050/internal/forms#blank`, run `.rea/runs/20261128T001743.882034Z-1ee94ebe/`. [Portable page/run](../internal-tools-overhaul/evidence/step-13/rea/workspace-page.json) retains target identity, capture window, accessibility text, storage key names and completeness `policy_filtered`. REA did not click, navigate, type or run the tests.

## Limits and rollback

Passive runtime Evidence has no artifact digest identity, omits pre-attach activity and raw headers/bodies/cookies/storage values, and includes policy-filtered/attach-limited sections. No runtime/source digest reconciliation is claimed. Build hashes and local run context support an association, not proof every bundled module executed.

Physical devices, handwritten signatures, staff-language approval, production deployment and live services remain unverified. English official form wording remains intact, including historical spelling. No new signature/approval, attachment, amendment or retention service is implied. Rollback keeps original records/readers, device drafts, source/recovery bytes and all blank file URLs.
