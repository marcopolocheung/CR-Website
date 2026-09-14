Deployment for chinarosesa.com

dashboard:
    sales, customer complaints

SW - zarzamora locaiton
military location

featured dishes slide 2, no combo meal, emph lemon chicken golden wok and china rose 

no curbside pickup

voicebit delivery, ask if pick up or delivery, will send link to pay online, then voicebit will search for driver to come to chia rose to delivery

## Environment variables

Both are `NEXT_PUBLIC_`, so they are inlined into the static export at build
time and are visible in the page source. Neither is a secret.

| Variable | Set in | Effect when unset |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Repository **variable** (Settings → Secrets and variables → Actions → Variables), read by `.github/workflows/deploy.yml`. Locally, `.env.local`. | No analytics script, no events, no console output. Dev and PR builds stay out of the property by default. |
| `NEXT_PUBLIC_BASE_PATH` | The deploy workflow, pinned to `''`. | Empty, which is correct for the custom domain. Only a GitHub project-pages deploy needs a path here; a wrong value rewrites every asset URL and canonical on the site. |

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
