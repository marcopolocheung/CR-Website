# SEO handoff — outstanding work after the PR review round

**Date:** 2026-08-23
**Repo:** `chinarosesa.com` (Next.js static export → GitHub Pages)
**Branch state:** `main` is clean, all five PRs merged and deployed.

---

## 1. What just happened (context, not work)

Five open PRs were reviewed, fixed, and merged in this order — the order mattered because three of them conflicted with each other:

| # | PR | Notes |
|---|---|---|
| 21 | ignore local codex workflow files | Also ignores `AGENTS.md` / `CLAUDE.md`. `docs/` deliberately **not** ignored. |
| 18 | remove unused map screenshots | Both PNGs confirmed unreferenced. Blobs still reachable via git history. |
| 20 | a11y heading fixes | Footer `h3`→`h2`, real `h1` on `/order`, Suspense fallback made a `role="status"` region. Added heading assertion to `seo-check`. |
| 16 | local entity signals | Fixed dangling `#organization` ref, centralized hours, added `priceRange`/`image`/`hasDriveThroughService`. Added JSON-LD validator to `seo-check`. |
| 17 | crawlable menu previews | Added full `Menu` JSON-LD on `/menu`, fixed preview subcategory sampling, build now fails on renamed menu categories. |

`main` currently passes `npx tsc --noEmit`, `npm run build`, and `npm run seo:check`.

**Verification commands** — run all three after any change here:

```bash
npx tsc --noEmit
npm run build          # static export → out/
npm run seo:check      # validates out/ : JSON-LD graph, headings, canonicals, robots, sitemap
```

---

## 2. BLOCKED — needs the owner to answer

This is the reason for the handoff. **Do not guess or fabricate any of these URLs.** They are business identity claims; a wrong one actively harms entity reconciliation.

### 2a. Google Business Profile — the highest-value item outstanding

`sameAs` pointing at the Google Business Profile is the single strongest entity-reconciliation signal for both Google and LLM-based search. It is currently **absent entirely**.

**What is needed: two URLs, one per location.** Each location is a separate `Restaurant` node with its own Business Profile, so one shared link will not do.

Accepted forms, best first:

```
https://maps.google.com/?cid=1234567890123456789        ← most stable
https://maps.app.goo.gl/xxxxxxxx                        ← Share link, fine
https://www.google.com/maps/place/China+Rose/@29.xxx,-98.xxx,17z/data=...
```

**How the owner gets them:** Google Maps → search "China Rose 7046 W Military Dr" → click the listing → **Share → Copy link**. Repeat for `2535 SW Military Dr`. Or from business.google.com, each location has a "Share profile" link.

> **Already tried and rejected:** the owner offered a `google.com/search?q=China+Rose&stick=...&authuser=6&mat=...` URL. That is a *search* URL, not a profile — `authuser=6` binds it to their logged-in account and `stick`/`mat` are ephemeral session tokens. It is not a stable identifier and must not be used.

**These URLs also unlock `geo`.** The `place/@lat,lng` form carries coordinates directly. `geo` is currently absent because the existing `mapUrl` fields in `src/data/locations.ts` are address-*query* links (`maps/search/?api=1&query=...`) with no coordinates in them.

### 2b. Yelp — needs confirmation, not discovery

Both listings were found and matched by street address in Yelp's own page titles. **Confirm these are the correct, claimed listings before committing them:**

| Location | Candidate URL |
|---|---|
| W Military (7046) | `https://www.yelp.com/biz/china-rose-san-antonio-3` |
| SW Military (2535) | `https://www.yelp.com/biz/china-rose-san-antonio-2` |

Note the slugs are counter-intuitive — `-3` is W Military and `-2` is SW Military. Do not assume the numbering maps to anything.

**Question for the owner:** are both of these yours, and are they claimed in Yelp for Business? (An unclaimed listing still works for `sameAs`, but claiming it is worth doing.)

### 2c. Facebook — needs confirmation and a scope answer

One candidate: `https://www.facebook.com/chinarosesa/` — the handle matches the `chinarosesa.com` domain, which is suggestive but not proof.

**Two questions for the owner:**
1. Is this the current official page? (Several stale/duplicate "China Rose" pages exist, including `facebook.com/pages/China-Rose/939408966146238` and `facebook.com/165851046758297`.)
2. Is there **one page for both locations, or a separate page per location?** This determines placement — see below.

### 2d. Two data-accuracy questions while the owner is in those dashboards

1. **Suite number / NAP consistency.** Aggregators list SW Military as `2535 SW Military Dr #100`. The site has `2535 SW Military Dr` (`src/data/locations.ts:77`). Name/address/phone consistency across the web is a real local-ranking factor — if the Business Profile carries the `#100`, `streetAddress` should match it exactly.
2. **SW Military Sunday hours.** One aggregator claimed Mon–Sat; another said daily 11–9, matching the site. Low confidence either way, aggregators go stale. Only the owner can settle it. This matters because hours are now published to Google via `openingHoursSpecification` — see §3.

---

## 3. Where each answer gets wired in

All structured data lives in `src/lib/structuredData.tsx`.

**`sameAs` per location** → `restaurantNode()`, alongside `hasMenu` at line ~42. Sourced from a new `sameAs: string[]` field on `RestaurantLocation` in `src/data/locations.ts`, so each location carries its own GBP + Yelp URLs:

```ts
sameAs: [location.googleBusinessUrl, location.yelpUrl].filter(Boolean)
```

**`sameAs` for the org** → the `Organization` node in `homepageJsonLd()` at `src/lib/structuredData.tsx:100`. The Facebook URL goes **here** if it covers both locations. If there turns out to be one Facebook page per location, it goes on the per-location `sameAs` instead. This is why question 2c.2 matters.

Note there are *two* Organization literals in that file — line 46 is the typed stub inside `restaurantNode` (deliberate: it makes the reference resolve on location pages where the full node is absent), line 100 is the real node. `sameAs` goes on **line 100 only**; adding it to the stub would duplicate it into every page.

**`geo`** → `restaurantNode()`, as a `GeoCoordinates` node:

```ts
geo: { '@type': 'GeoCoordinates', latitude: ..., longitude: ... }
```

**Hours** (if the Sunday answer changes anything) → `src/data/locations.ts`. Hours live on the location record as `standardHours`; both locations currently reference the same object. If SW Military genuinely differs, give it its own `OpeningHours` and the homepage prose will automatically drop its "both restaurants are open…" claim — that guard is already built and tested.

---

## 4. UNBLOCKED — two small code follow-ups, no owner input needed

Both were deferred purely because they spanned two unmerged branches. They are now trivially doable and should ship as one PR.

1. **`hasMenu` should reference the `Menu` node, not a bare URL.**
   `src/lib/structuredData.tsx:42` currently has `hasMenu: absoluteUrl('/menu')`. Since PR #17 landed, `/menu` emits a real `Menu` node with `@id` of `https://chinarosesa.com/menu#menu` (see `src/lib/menuStructuredData.ts:70`). Point at it:

   ```ts
   hasMenu: { '@type': 'Menu', '@id': `${absoluteUrl('/menu')}#menu`, url: absoluteUrl('/menu') }
   ```

   Keep the `@type` — the JSON-LD validator in `seo-check` requires a bare `@id` reference to be either typed or defined on the same page, and `Menu` is defined on `/menu`, not on the location pages.

2. **Flip `/menu` to `requiresJsonLd`.**
   `scripts/seo-check.mjs`, in the `publicPages` table: `{ route: '/menu', file: 'menu.html' }` → add `requiresJsonLd: true`. It was left off only because the Menu schema did not exist when the flag was introduced.

---

## 5. Also still open (lower priority, no blockers)

- **`OrderMenuPage.tsx` type duplication.** PR #17 centralized `MenuItem`/`MenuSection`/`MenuCategory` into `src/lib/menuUtils.ts`, but `src/components/order/OrderMenuPage.tsx` still declares its own copies. Straight dedup.
- **Hand-typed `lastmod` dates.** `src/lib/seo.ts` has five `'2026-08-22'` literals in `indexableRoutes`. Better than a build-time `new Date()` (which makes every page look freshly modified on every deploy), but a date that never moves gets discounted the same way. Options: derive from git commit dates for each route's source files, or add a check that flags dates older than the files they describe. Note GitHub Actions' `actions/checkout` defaults to `depth: 1`, so a git-based approach needs `fetch-depth: 0`.
- **Deleted image blobs remain in git history.** PR #18 deleted `public/imgs/{SW,}WMilitaryLocation.png` at HEAD. If the driver was genuine content-rights risk rather than repo hygiene, that is not closed — it needs a history rewrite.
- **Node 20 deprecation warning** on every deploy run — `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5` and a nested `actions/upload-artifact@v4` are being force-run on Node 24. The workflow (`.github/workflows/deploy.yml`) also pins `upload-pages-artifact@v3` and `deploy-pages@v4`. Not blocking, worth bumping.
- **Five merged branches still on origin.** `--delete-branch` did not take effect; they can be pruned.

---

## 6. Judgment calls made, so they are not silently reversed

- **Menu preview duplication on both location pages was left in place.** The menu genuinely is identical at both locations, so differentiating them would mean inventing differences. The duplication is bounded (12 item names per page), every card links to the canonical `/menu#anchor`, and the visible copy says the menu is shared — which is the correct handling of intentional shared content. Reopen only if there is evidence of a duplicate-content penalty.
- **`priceRange` is `'$'`,** not a derived `$1–$15`. Every item on the menu is under $15; `$` is the band Google renders and the literal range would include $1 drinks, which misrepresents the entrée pricing.
- **`docs/` is not gitignored** even though `AGENTS.md`/`CLAUDE.md` are. The research reports in here are project documentation, not local scratch. They remain untracked — committing them is the owner's call.
