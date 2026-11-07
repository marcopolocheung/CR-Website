Deployment for chinarosesa.com

## Scheduling agent

The scheduler has an optional LangGraph assistant that compares schedules,
independently validates them, and saves a proposal for manager review. Its Node
service uses SQLite checkpoints; GitHub Pages continues serving the frontend.
See [setup and architecture](agent/README.md) for local commands, configuration,
capabilities, verification, and production requirements.

## Environment variables

Variables prefixed `NEXT_PUBLIC_` are inlined into the static export at build
time and are visible in the page source. They are not secrets.

| Variable | Set in | Effect when unset |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Repository **variable** (Settings → Secrets and variables → Actions → Variables), read by `.github/workflows/deploy.yml`. Locally, `.env.local`. | No analytics script, no events, no console output. Dev and PR builds stay out of the property by default. |
| `NEXT_PUBLIC_BASE_PATH` | The deploy workflow, pinned to `''`. | Empty, which is correct for the custom domain. Only a GitHub project-pages deploy needs a path here; a wrong value rewrites every asset URL and canonical on the site. |
| `NEXT_PUBLIC_SCHEDULE_API` | Locally, `.env.local`, or the build environment. | The existing production schedule Worker. Set a loopback URL for local data tests. |
| `NEXT_PUBLIC_AGENT_API` | Repository **variable**, passed by the deploy workflow; locally, `.env.local`. | The scheduling assistant panel is hidden. Set the URL of the separately hosted agent service to enable it. |

Copy `.env.example` to `.env.local` to set either one locally.

## Analytics

GA4, loaded client-side from `src/components/analytics/Analytics.tsx` (a static
export has no request-time hook to inject it from). Page views are sent on every
route change, not just the first, because client-side navigation does not reload
the page.

Six events are recorded, each carrying the `location` slug it belongs to:

| Event | Fires on |
|---|---|
| `pickup_order_click` | Toast ordering links |
| `delivery_order_click` | Uber Eats ordering links |
| `phone_click` | any `tel:` link |
| `directions_click` | Google Maps links |
| `menu_view` | reaching `/menu` (no location — the menu is shared) |
| `location_select` | "View Location & Menu" |

Ordering links carry `utm_source=site&utm_medium=referral&utm_campaign=<slug>`
so Toast and Uber can attribute their volume back here. The tags are added at
render time by `orderUrl()` in `src/data/locations.ts`; the URLs published in
JSON-LD stay untagged.

The `(order-shell)` routes are deliberately untracked: they are `noindex`, and
`/order` is a disused test route.
