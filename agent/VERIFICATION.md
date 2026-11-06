# Local verification — 2026-11-06

Environment: Node 22.22.0, npm 10.9.4, Linux. All restaurant records and manager
credentials used for execution were synthetic. No production data was read or
changed. No model API was called, and no deployment was performed.

| Check | Observed result |
| --- | --- |
| `npm run agent:test` | 13 passed: constraints, approved leave, locks, invalid candidate rejection, strategy comparison, planner fallback, restart/review resume, authentication, idempotency, freshness, quotas, payload limits |
| `npm run scheduler:test` | 135 passed, including existing Worker/scheduler compatibility coverage |
| `npm run scheduler:requests:test` | 5 passed |
| `npx tsc --noEmit` | Passed |
| `NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790 npm run build` | Passed; static export generated successfully |
| `npm run seo:check` | Passed |
| `python3 scripts/test-scheduling-agent.py` | Passed against Chromium at 1440px and 375px, using the actual agent HTTP server with a temporary SQLite file and synthetic Worker fixtures |
| `git diff --check` | Passed |

The browser check creates a real proposal, restarts the Node process while its
LangGraph review interrupt is pending, reloads the page, and retrieves the same
proposal. It then checks stale-draft rejection, proposal application, Undo,
absence of Worker writes, absence of the manager code in browser storage,
phone layout, and minimum 44px button heights. Screenshots were inspected at
`/tmp/cr-agent-browser-artifacts/agent-desktop-review.png` and
`/tmp/cr-agent-browser-artifacts/agent-phone-review.png`.

Browser dependencies were installed under `/tmp` for this session, including
Playwright 1.64.1, Chromium 156, and extracted local system libraries. These
tools are not application dependencies. Reproduction needs a working Python
Playwright/Chromium installation; the script can optionally use
`CR_AGENT_BROWSER_EXECUTABLE` for an existing Chromium executable.

Unverified: live model-provider integration, production hosting, credential
rotation in a deployed environment, representative full-crew performance,
multi-instance operation, and manager usability with real staffing policies.
The service intentionally supports one process per SQLite database; scaling
requires additional shared persistence and coordination work.
