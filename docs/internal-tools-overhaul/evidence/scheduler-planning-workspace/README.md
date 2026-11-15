# Planning workspace local verification

November 14, 2026. Implementation based on `origin/main` at `7c3234f`, including
the CR3 Kitchen manager, shared Back navigation and saved-cash changes. This is an
opt-in scheduler integration, not completion of every SCH-07/Step 14 requirement
or a production activation.

See the [implementation notes](../../../scheduler-planning-workspace.md).

## Verified

| Check | Result |
| --- | --- |
| `npm run scheduler:test` | 210 passed, including ten shared-repair and three employee-color tests |
| `npm run scheduler:requests:test` | 5 passed |
| `npm run scheduler:requests:worker:test` | 4 passed |
| `npm run internal:session:test` | 6 passed |
| Agent domain/service tests under Node 22 | 13 passed |
| `npm run build` | Static export passed |
| `npm exec tsc -- --noEmit` | Passed |
| `npm run seo:check` | Passed |
| Planning workspace browser suite | Passed |
| Existing scheduler-view browser suite | Passed |
| Request-entry/review browser suite | Passed |
| Standalone prototype browser suite | Passed |
| Real local scheduling-assistant browser suite | Passed, including process restart and apply/Undo |

The existing request browser suite was updated for the current request labels and
the dedicated scheduler shell's Internal tools link. Its request handler serves
every intercepted API call from fixtures, matching the scheduler-view fixture;
it does not forward requests to a production hostname.

The planning suite exercises native drag, keyboard and phone tap placement,
occupied destinations, multiple Keeps, release and rejection, one-step Undo,
confirmed approval after an unknown-save retry, approval persistence through Undo,
external approvals without automatic rearrangement, approvals outside the selected
week, stale-repair cancellation, unfinished-request retention/cancellation,
publication conflicts/retry, shared layout/language state, protected kitchen
editing, print visibility, and expanded tools at narrow widths. Person editing
focuses its panel and returns focus on Close; keyboard Move focuses the board.

Follow-up UI simplification: request-service loading is optional for board use.
The additional request-confirmation banner and prerequisite were removed. Tests
cover unavailable and unconfigured request storage, plus a request reload failing
while a draft repair is in progress. Only actual request-data changes invalidate
a repair; loading status and an unfinished request form do not.

The domain suite also verifies a 56-position synthetic kitchen week, preserving
unrelated assignments and Keeps while repairing a gap. Search limitations remain
visible; these checks do not establish global optimality or staff usability.

All browser data is synthetic. The assistant test uses a local fixture Worker and
the actual Node service with its offline planner; no paid model or production
service is contacted. The installed SQLite native binary needs Node 22, so the
agent checks used that runtime. Other checks used the installed Node 20 runtime.

The final export uses the normal environment, with no test assistant endpoint.
All four station pages remain `noindex, nofollow` and render without the public
site footer. The original main worktree and its untracked research/output folders
were left untouched.

## Captures

- [Desktop](desktop.png)
- [Phone](phone.png)
- [Spanish phone](phone-spanish.png)

Checked at 320px, 390px, 768px and desktop widths. The board scrolls within its own
region; the page does not scroll horizontally. The screenshots show a synthetic
28-position fixture, not operational staff records or proof of a live release.

The latest board supports icon-only lock toggles on assigned spots, unique employee colors (verified with a 100-person roster), and consistent colored role icons. Dropping an employee onto their own existing assignment is a no-op, including when other gaps remain.
