# Step 07 local verification evidence

See the [checkpoint](../../checkpoints/step-07.md), [approved scope](approved-plan.md) and [REA investigation](../../../investigations/internal-cash-history-2026-11-14.md).

Final source: `/home/unusn/CR-step07`, `feat/overhaul-step-07-saved-cash`, based on merged main `68810bf`. Only Step 07 changes belong to this review. Unrelated scheduler-prototype work and the original checkout are preserved.

All service responses are synthetic/intercepted at `http://127.0.0.1:8787`. No Worker must listen there. All browser contexts block service workers and external origins. Final browser runs use the static production export on literal loopback `3042`; no live persistence/retention or physical-device claim.

## Reproduce

```sh
npm ci --no-audit --no-fund
npm run cashout:test
npm run recovery:test
npm run forms:test
npm run internal:session:test
node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts
npm exec tsc -- --noEmit
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
npm run seo:check
python3 scripts/overhaul-baseline/serve.py --port 3042
```

In another terminal, use Python with the pinned `scripts/overhaul-baseline/requirements.txt` dependencies and Chromium OS libraries. This host used `/tmp/cr-step07-venv/bin/python`, with `LD_LIBRARY_PATH=/tmp/cr-step07-browser-libs/root/usr/lib/x86_64-linux-gnu`.

```sh
python scripts/test-cashout-history.py http://127.0.0.1:3042 --artifacts docs/internal-tools-overhaul/evidence/step-07/screens --rea
python scripts/test-cashout-focused.py http://127.0.0.1:3042 --artifacts /tmp/cr-step07-final-focused
python scripts/overhaul-baseline/run-existing.py scripts/test-cashout-entry.py http://127.0.0.1:3042
```

The final external-guard replay also covers `test-cashout-context`, `test-entry-workspace`, `test-internal-drafts`, `test-internal-language`, `test-internal-recovery`, `test-internal-feedback`, `test-internal-session`, `test-internal-home-reports` and `test-internal-shell`, each as `scripts/<suite>.py` with the same loopback base. The last three accept `--artifacts /tmp/cr-step07-regression-artifacts/<suite>`; their portable final result JSON is copied into checks. All ten have exit 0 in [browser-regressions.json](checks/browser-regressions.json).

The saved-history suite's `--rea` option opens only its owned temporary Chromium CDP port 9338 and passively captures its final selected page using `rea-project run … inspect-web-page`. REA does not replay preceding Playwright actions. Exact commands/targets/digests, partial static graph coverage and attach limits are preserved in the REA summaries and investigation. Raw data remains in project `.rea/runs/`; a new run must preserve its own new identity.

## Artifacts

- [checks](checks): 73 passing unit/contract tests, type/build/SEO logs, 10-suite regression exit summary and final browser result manifests.
- [screens](screens): four saved-day screenshots (desktop, changed baseline, Spanish phone and enlarged text), saved full-drawer English PDF; two focused-entry screenshots and focused English all-drawer PDF.
- [source manifest](checks/source-hashes.json): source/test/build identities. Screenshot SHA-256 and dimensions are retained in each browser result JSON.
- [static REA summary](rea-static-summary.json) and [passive REA summary](rea-passive-summary.json): final target identities and unknowns. Static summary coverage does not establish execution or complete application-graph coverage.

Paper copies, English/Spanish screen state, keyboard, 375px and 320px enlarged layouts are local emulation evidence. No physical-device review, live API persistence, atomic overwrite protection, retained revisions, deployment or broader CASH-08 completion is asserted. Stop after this review unit.
