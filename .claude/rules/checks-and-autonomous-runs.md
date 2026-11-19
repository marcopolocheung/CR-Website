# Checks and autonomous runs

- Fast check (typecheck, tracker consistency, domain suites, ~10–25 s): `npm run check`. A Stop hook (`.claude/hooks/verify-gate.sh`) runs it before a turn that changed files can end.
- Full check (adds the Worker/D1 suites, ~65 s more): `npm run check:full`. Run it before recording a step checkpoint.
- Browser scenarios: `python3 scripts/test-<area>.py` against a local dev server; run the ones the step names.
- `.next/` is a build cache. If `tsc` reports missing modules under `.next/types`, delete `.next/` and rerun.
- One overhaul step per session or `/goal` run, ending at its checkpoint record. Don't begin the next step; the owner reviews screens between steps.
- Never edit or delete an existing test to make it pass. If a test contradicts the guide, stop and explain the conflict.
- Work on a branch and never push to `main`: a push to `main` deploys. No `wrangler deploy`, remote D1 commands or secrets changes.
