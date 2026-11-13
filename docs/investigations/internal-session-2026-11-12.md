# Step 04: internal session and navigation evidence

Source baseline is merged main `61deb6a056863187ba199fda891d73236259103b`.
Application changes are identified by the source hashes in the
[production browser manifest](../internal-tools-overhaul/evidence/step-04/session/results.json).
These local artifacts use synthetic data and loopback APIs; no live service or
production record was read or written.

## Static export identity and boundaries

`rea-project analyze /home/unusn/CR-step04/out --project /home/unusn/CR-step04 --source-path _next/static/chunks/23ece687e9db837e.js --source-path _next/static/chunks/55cc09ca8b9edf42.js`
retained its raw results and diagnostics under
`.rea/runs/20261113T055250.284333Z-6e5e659d/`. Read the retained summary first;
[portable summary](../internal-tools-overhaul/evidence/step-04/rea-static-summary.json).

- Artifact SHA-256: `455c95fe843ba4fbba85c76e81fb48eff4ad5cd8582e47d42a28941275ff0900`.
- Parent evidence: `ev_9ae0fe98c7e254bc8d17a5116f85f9f725eacbdb33b65df131184904e57da44a`.
- Summary evidence: `ev_8efd79e3f917322dd2fe5b2b6d0ce4255be233104a87f6397ba79f2ef3933a73`.
- Two selected JavaScript files parsed without failures; 66 inventoried files
  remained outside the selection. Application and semantic relationship coverage
  is partial, with 66 application unknowns and 5,331 semantic unknowns. Static
  observations do not establish execution, service authorization or persistence.

The two selected modules contain the session transport boundary and its consumers.
Their appearance in an emitted build is artifact evidence only. The production
browser scenarios independently verify shared access and rejection of an old
successful write after the same manager code is reentered.

## Runtime observation

The browser suite separately performs the declared synthetic actions using
Playwright. Its final [production results](../internal-tools-overhaul/evidence/step-04/session/results.json)
record the scenarios, screenshots, source hashes and intercepted requests.

A passive REA attach to an earlier Step 04 dev preview, before the final
exited-layout unlock guard, is
retained under `.rea/runs/20261113T054424.640800Z-0f634d33/`. Its
[portable extracted summary](../internal-tools-overhaul/evidence/step-04/rea-passive-summary.json)
is a human-readable projection of the original `stdout.txt`, not a new REA
analysis-view evidence record.

- Evidence: `ev_a254a2979680fb5a977949fbb94ff864b05fd80afd322ab5c8a18328313acf5f`.
- Target: `491608B72D390C74D6E35BE813F85D75`,
  `http://127.0.0.1:3035/internal/bookkeeping#cash-out`.
- 1,159 observed DOM nodes; the attach shows the current Spanish cash state and
  permitted storage key names, with values excluded. Coverage is
  `policy_filtered` and `attach_limited`; prior actions/network, filtered console
  content, source maps and script sources are not established by this attach.

Physical touch/software keyboard, full accessibility conformance, activated
services, production redirects/base-path hosting and historical encrypted-link
browser decryption remain unverified. An intercepted successful save proves the
UI response to that fixture, not durable production persistence.
