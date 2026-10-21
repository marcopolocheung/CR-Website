# Security review (2026-10-20)

Checked against the code and the live site (`chinarosesa.com` and the Worker at `chinarose-schedule-api.crbrucecheung.workers.dev`). The live checks were read-only requests that change nothing.

## How the protection actually works

The site is a static export hosted on GitHub Pages, and the GitHub repo is public. So:

- **Every internal page is public.** Anyone can open `/internal/bookkeeping` (verified: 200) and read all of its JavaScript. The "Enter manager code" box is **not** the protection. A person can bypass it in the browser, and all they get is the empty page layout.
- **The protection is on the Worker.** Cash-outs, write-ups, and inventory are only sent by the Worker when the request carries the manager code (`SCHEDULE_WRITE_TOKEN`). Verified live: `/api/cashout/CR3` and `/api/writeups` with no code → `401 unauthorized`.
- **The manager code isn't in GitHub.** It's a Worker secret. Git history has only the test placeholder `manager-token`, no real secret, and no `.env` file ever committed.

So "load the page and skip the password" gets an attacker nothing. To get the money and HR data they need the code itself. Wrong guesses are limited to 30 per hour per internet address. That's enough against one person guessing, **if the code is long and random**. Someone with many addresses gets 30 guesses per hour from each, so a short or word-like code (`china123`) isn't safe.

## Findings, worst first

| # | Finding | Verified | Impact | Fix |
|---|---|---|---|---|
| 1 | **Staff password is `test`, published in the public repo, and works on the live Worker** | Yes: `/api/staff/verify` with `test` → `{"ok":true}` | Anyone can edit or delete the CR3 Kitchen crew (names, roles, availability) and save that station's per-week rules. Undo exists, but only one step back | `wrangler secret put STAFF_EDIT_PASSWORD` (long random value), or remove the default so the route is off until a secret is set |
| 2 | **Public staff lists show more than the schedule viewer needs** | Yes: `/api/employees?restaurant=CR3-diningroom` → 12 people, with `recurringAvailability`, `maxDaysPerWeek`, `incompatibleEmployeeIds`, `newHire`, `active` | Anyone can see who works when, and **which employees are kept apart from each other**. Suspensions and priority ranks would show too once set | Gate `GET /api/employees`, `/api/template`, `/api/staff` behind a code, or have the public read return only `id` + `name`. The viewer needs only published weeks |
| 3 | **Employee data is in the public repo** | Yes: `scheduler.md` (names + availability notes), `docs/26-00919 CR SCHEDULER RULES.xlsx`, seed data in `src/lib/scheduler/data.ts` | Same as #2, permanently. **Deleting the files doesn't remove them from git history** | Make the repo private (simplest; GitHub Pages on a private repo needs a paid plan, or deploy to Cloudflare Pages for free), or move the data out and accept that history keeps the old copy |
| 4 | Manager code strength unknown | Can't check | Everything rests on it | 20+ random characters (a password manager can generate one). Rotate it when a manager leaves |
| 5 | One shared code for everything; no record of who did what | Code | Can't tell who saved or viewed a cash out; one leak exposes everything | Per-person access (below) |
| 6 | Guess limiter fails open | Code: `checkVerifyThrottle` returns `true` if KV errors | During a KV outage guesses are unlimited (rare) | Return `false` on error for the verify throttle |
| 7 | Code comparison isn't constant-time | Code: `===` on the header | Theoretical timing leak; not practical over Cloudflare's network | Optional: compare SHA-256 digests |
| 8 | Blank forms and the Pepsi account number are public | Yes: `/internal/forms/*.xlsx` → 200 | Low: blank templates, an account number | Fine as is, or move them behind the Worker |

What's fine: cash, write-up, and inventory reads and writes are all gated server-side. The code is held in memory only, never saved in the browser. There's no unsafe HTML injection; the only `dangerouslySetInnerHTML` is JSON-LD built from site data. Internal pages are `noindex`, so search engines don't list them. CORS isn't a security boundary here, and nothing relies on it as one.

## Stronger option: real logins on the Worker

**Cloudflare Access** (free for up to 50 users) can sit in front of the Worker's private routes. Each manager signs in with their email and a one-time code; the Worker then knows *who* is asking (`Cf-Access-Authenticated-User-Email`), which also gives the audit trail in platform.md §4. This replaces the shared code for managers. The public schedule viewer keeps its open read routes.

## Order to fix

1. Set `STAFF_EDIT_PASSWORD` today (#1). Five minutes, no code change.
2. Check that the manager code is long and random (#4).
3. Trim or gate the public staff-list reads (#2): a small Worker change.
4. Decide on repo visibility (#3).
5. Later: Cloudflare Access for per-person logins (#5).
