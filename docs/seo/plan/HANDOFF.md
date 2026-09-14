# Handoff — content & analytics phase

**Written:** 2026-09-08 · **For:** a fresh session with no prior context
**Repo:** `chinarosesa.com` — Next.js 16, static export (`output: 'export'`) → GitHub Pages, custom domain, DNS at GoDaddy

Read this file top to bottom before touching anything. §3 (Confirmed facts) is the part that will bite you if you skip it.

---

## 1. Where things stand

The technical SEO phase is **finished and deployed**. Seven PRs shipped on 2026-09-08 (#51–#57): JSON-LD entity linkage, favicon set, CI guards, git-derived sitemap `lastmod`, trailing-slash mirrors, and local-intent page titles. Don't redo any of it.

**The live problem this phase exists to solve:**

> Google has indexed **1 of 5 pages** — the homepage only. `/menu`, both location pages and `/careers` are not in the index. `site:chinarosesa.com` returns one result.

They aren't blocked: every page is `index, follow`, self-canonical, internally linked, in the sitemap, and fully marked up. Google just hasn't judged them worth indexing. Off-site signals are being handled by the owner (Business Profile links now point at the location pages). **Your job is the other half — making those pages substantively worth indexing**, and giving dish-level and question-shaped queries something to match.

Today's measured baseline, for comparison later: **brand questions 4/7 answered correctly, discovery questions 2/7 surface China Rose at all.** Full detail in `measurement.md`.

---

## 2. Ground rules

**`AGENTS.md` is mandatory.** This is not the Next.js you know — read the relevant guide under `node_modules/next/dist/docs/` before writing code. It matters: the icon/sitemap/metadata file conventions used here are version-specific.

**Every change ends with these three, all passing:**

```bash
npx tsc --noEmit
npm run build        # static export → out/  (also mirrors trailing-slash routes)
npm run seo:check    # validates out/
```

CI runs `tsc` and `seo:check` before the artifact uploads, so a break fails the deploy instead of shipping. Don't weaken `scripts/seo-check.mjs` to make something pass — it enforces canonicals, the JSON-LD graph, heading order (exactly one `h1`, no skipped levels), robots, sitemap, trailing-slash mirrors, and `noindex` on staff/order routes.

**Branch and PR per task.** `main` auto-deploys on merge. Don't commit to `main`.

**Never invent a fact about this business.** This is the single most important rule in the repo. Google, Yelp, ChatGPT and Gemini cross-check each other; a wrong fact published in structured data teaches all of them something false and is worse than saying nothing.

---

## 3. Confirmed facts — use these, and nothing beyond them

### Verified, safe to publish

| Fact | Value |
|---|---|
| Locations | **Two.** 7046 W Military Dr, San Antonio TX 78227 · 2535 SW Military Dr, San Antonio TX 78224 |
| Phones | W Military (210) 675-3226 · SW Military (210) 927-7339 |
| Hours | **11:00 AM – 9:00 PM, daily, both locations** — owner-confirmed 2026-09-08 |
| Drive-thru | **W Military only** |
| Services, W Military | Dine-in, Pick-up, Delivery, Drive-thru, Catering, Lunch specials |
| Services, SW Military | Dine-in, Pick-up, Delivery, Catering, Lunch specials |
| Reservations | **No** |
| Menu | **Identical at both locations** |
| Pickup | Toast (per-location links in `src/data/locations.ts`) |
| Delivery | **Uber Eats, live at both** — owner-confirmed 2026-09-08. `order.store`, `ubereats.com` and `postmates.com` are the *same* Uber listing (same store UUID), not three providers |
| Cuisine | Chinese |
| Price band | `$` — every item is under $15 |

### Explicitly ruled out by the owner — do not add

- **Curbside pickup** — does not exist. (Google currently claims it; that's a Business Profile fix, not a site fix.)
- **Favor delivery** — dropped.
- **VoiceBit** — dropped.
- **1431 Pleasanton Rd** — a former China Rose, now closed. Deprioritised. Never list it as a location.

### Unknown — must NOT be stated anywhere

- **Founding year.** No date confirmed. A "over 10 years" line circulates on Facebook; it is unverified.
- **Ownership / family story.** Nothing confirmed. I shipped a description calling it "a family Chinese restaurant" and had to pull it before merge — don't repeat that.
- **Awards, press, recognition.** None confirmed.
- **Proximity claims** (e.g. "near Lackland AFB"). Geographically plausible, not owner-approved. Leave out.
- **Popularity claims** ("famous", "best-selling", "customer favorite") for any dish.
- **Exact featured-dish names.** The owner wants "Combo Meal" dropped from the wording and lemon chicken leading, but has not supplied the final three names. `src/data/featuredDishes.ts` still holds the old ones. Leave it until they answer.

---

## 4. Task 1 — GA4 analytics

**Why:** there is currently **zero** conversion tracking. Search Console reports impressions and clicks *to* the site; nothing records whether anyone clicked "Order Pick-Up on Toast", tapped a phone number, or asked for directions. Those buttons are the point of the website. Without this, the whole engagement can only claim visibility, never revenue.

**Provider:** GA4 (owner's choice — free, and it links to Search Console so query → landing page → conversion sits in one view).

**Build:**

1. Measurement ID from `process.env.NEXT_PUBLIC_GA_ID`. Never hardcode it. Add it to the workflow env in `.github/workflows/deploy.yml` alongside `NEXT_PUBLIC_BASE_PATH`, and document it in `README.md`.
2. Load in `src/app/(public)/layout.tsx`. **Static export means client-side only** — no server component can inject it at request time. Render nothing when the env var is absent so local builds and PR previews stay clean.
3. Track these six, each labelled with the location where one applies:

   | Event | Fires on |
   |---|---|
   | `pickup_order_click` | Toast links |
   | `delivery_order_click` | Uber/order.store links |
   | `phone_click` | any `tel:` link |
   | `directions_click` | Google Maps links |
   | `menu_view` | `/menu` page view |
   | `location_select` | "View Location & Menu" links |

   Touch points: `src/components/LocationCard.tsx`, `src/components/LocationPageContent.tsx`, `src/components/Footer.tsx`.
4. Add UTMs to the outbound ordering URLs in `src/data/locations.ts` (`?utm_source=site&utm_medium=referral&utm_campaign=<slug>`) so Toast-side volume can be attributed back. **Verify each URL still resolves after appending** — these are third-party ordering links and breaking one costs real orders.

**Watch out:** the order/internal routes use a *separate root layout* (`src/app/(order-shell)/layout.tsx`). They're `noindex` and `/order` is a disused test route — don't add tracking there.

**Acceptance:** all three commands pass; a click on each of the six shows in GA4 realtime; no measurable Lighthouse regression; `NEXT_PUBLIC_GA_ID` unset produces no script tag and no console errors.

---

## 5. Task 2 — dish descriptions

**35 of 63 menu items have no description.** That is why "lemon chicken San Antonio" surfaces a competitor and not China Rose — the menu page has nothing for a dish-level query to match, and nothing for an AI answer to lift.

**The owner has explicitly authorised you to write these.** That authorisation has a boundary, and the boundary is the whole task.

### The rule

Describe **what the dish name already means**. Never add a fact the name doesn't carry.

| ✅ Write this | ❌ Not this | Why |
|---|---|---|
| "Lo-mein noodles stir-fried with beef and vegetables." | "Hand-pulled lo-mein in our signature house sauce." | "Hand-pulled", "signature", "house" are invented |
| "Egg drop soup with beaten egg in a light chicken broth." | "Grandma's recipe egg drop soup." | Invented provenance |
| "Chicken fried rice with egg and vegetables." | "Wok-tossed over high flame by our chefs." | Invented method |
| "Crispy egg roll." | "Our most popular appetizer." | Popularity claim — forbidden |

Plain, short, factual. One sentence. Think "what would a reasonable person expect when they order this," not "how do I sell it."

### Scope — don't describe everything

Prioritise items people actually search for:

- **Do:** the 16 rice/noodle items (fried rice variants, lo-mein, pad thai), egg drop soup, egg rolls, spring rolls, rangoon, dumplings, the combination plate.
- **Skip:** `MED DRINK`, `LG DRINK`, and the whole `OTHERS` category — those are sauces and add-ons (`LEMON SAUCE`, `GREEN ONION`, `FORTUNE COOKIES`). A description there adds nothing and only creates surface area for error. Leaving an item blank is a valid outcome.

Aim for roughly 85–90% coverage of the items that matter, not 100% of the list.

### Two data bugs to fix while you're in there

Real typos in `src/data/menu.json`, both hurting search — nobody searches for "fired rice":

- `SHRIMP FIRED RICE` → `SHRIMP FRIED RICE`
- `SEAFOOD RANGOO` → `SEAFOOD RANGOON`

Check `formatMenuItemName` in `src/lib/menuUtils.ts` and the anchor IDs in `src/lib/menuStructuredData.ts` before renaming — category renames deliberately fail the build, and `toId()` output feeds the `/menu#anchor` links used by the location-page previews.

**Acceptance:** three commands pass; the `Menu` JSON-LD graph on `/menu` still validates; no invented ingredient, method, provenance or popularity claim anywhere.

---

## 6. Task 3 — FAQ page

**Why:** nothing on the site answers a question in the shape an AI system lifts. The pattern that gets extracted into AI Overviews and chat answers is **a clear question as a heading, with a direct answer in the first sentence under it.**

Unblocked as of today — hours and delivery are both settled.

### Questions to answer (all facts confirmed in §3)

1. What are China Rose's hours? → 11 AM–9 PM daily, both locations
2. Where are the two locations? → both addresses, both phones
3. Does China Rose deliver? → yes, Uber Eats, both locations
4. How do I order pickup? → Toast, per location
5. Which location has a drive-thru? → W Military only
6. Is the menu the same at both locations? → yes
7. Does China Rose cater? → yes, both
8. Are there lunch specials? → yes, both
9. Does China Rose take reservations? → no
10. Is there dine-in? → yes, both

**Placement:** your call between a `/faq` route and a section on the homepage. A dedicated route is a sixth indexable URL that can rank on its own — probably better, given the indexing problem — but it needs adding to `indexableRoutes` in `src/lib/seo.ts` *with its `sources` array* (see how the others are shaped; `lastmod` is derived from those files' git history), and to `publicPages` in `scripts/seo-check.mjs`.

**On `FAQPage` schema:** optional, and don't oversell it. Google retired FAQ rich results in 2026, so it buys no SERP feature. It remains valid vocabulary that Bing and AI crawlers parse. **Every answer must be visible in the rendered HTML regardless** — that's the part that actually works.

**Acceptance:** every answer present in the HTML; heading order passes `seo-check`; nothing contradicts the JSON-LD on other pages.

---

## 7. Task 4 — About page (read the warning)

The owner asked for this. **There is no confirmed history to put on it** — no founding year, no origin story, no awards. See §3.

An About page padded with generic filler is worse than no About page: it's thin content on a site already struggling to get indexed, and it's exactly the "unhelpful content" pattern search quality systems target.

**So build it from what is verifiable:**

- What China Rose is: a Chinese restaurant with two San Antonio locations, on W Military Dr and SW Military Dr
- What it serves — reference the real menu categories, link to `/menu`
- How each location differs: the drive-thru at W Military; both otherwise identical, same menu
- Services: dine-in, pick-up, delivery, catering, lunch specials
- How to order at each, with links
- Hours and contact for both

That is a genuinely useful page for both a human and an AI answering "what is China Rose in San Antonio?" — the #1 brand question in the probe set. It just isn't a *story*.

**Leave a clearly marked TODO in the source** for the history section, and add a line to `owner-actions.md` §1 asking again for founding year and origin story. When it arrives, the page expands. Every competitor outranking China Rose — Golden Wok, Ding How, Hung Fong, Golden Star — has that story on their site, and it is the one thing no aggregator can scrape from them.

**If you cannot make it clear the quality bar with verified facts alone, don't ship it.** Say so in the PR and leave it for when the owner answers.

**Acceptance:** same as the FAQ, plus: not one sentence on the page is unsupported by §3.

---

## 8. Task 5 — other worthwhile SEO/GEO work

Roughly in value order.

1. **Differentiate the two location pages.** They currently share an identical 12-item menu preview, making them near-duplicates — a weak signal on pages fighting to be indexed. Needs owner input on cross-streets, parking and access. Ask; don't invent.
2. **IndexNow.** Pings Bing the moment a page changes rather than waiting for a crawl. Bing last crawled the SW Military page on **July 30** — before all the structured-data work — so its copy has no `Restaurant` schema at all. Bing is what Copilot reads and part of ChatGPT's grounding, so this is squarely a GEO item. Small build-step addition.
3. **Per-location Open Graph images.** Both `Restaurant` nodes and both pages currently share the site banner. Needs real photos (owner).
4. **Real location photos.** Zero exist. Blocked on the owner, worth chasing — GBP photo views are a weighted ranking interaction now.
5. **Internal linking from `/menu` back to the location pages.** Currently one-directional; the menu is the biggest page and passes nothing back.
6. **`hasMap` quality.** Still Google Maps *search* URLs. `geo` coordinates are published so this is minor, but a real place URL is a stronger signal.
7. **Image alt text audit** across menu images.

### Don't do these

- No `llms.txt`, AI-specific schema, or hidden instruction text. Google states plainly that AI features run on ordinary Search fundamentals; Bing treats prompt-injection content as manipulation.
- No review or `aggregateRating` schema for reviews collected elsewhere — policy violation, manual-action risk.
- No ZIP-code or per-dish doorway pages.
- Don't block crawlers in `robots.txt` for pages that are `noindex` — a blocked page can't be read as noindex. `seo-check` already enforces this.
- Don't put hours in more places than necessary. They're in the visible copy and the JSON-LD; every extra copy is another thing to update.

---

## 9. Where everything lives

| File | What it is |
|---|---|
| `docs/seo/plan/README.md` | The master plan — tracks, reasoning, PR list, 30/60/90 targets |
| `docs/seo/plan/DO-THIS-NEXT.md` | Plain-language list for the owner, non-technical |
| `docs/seo/plan/owner-actions.md` | Full reference for the browser/in-store work |
| `docs/seo/plan/measurement.md` | Baseline, the 14-question AI probe set, monthly log template |
| `docs/seo/brief.md`, `docs/seo-research-report.md` | Original research |

Key source files: `src/lib/seo.ts` (routes, metadata helper), `src/lib/structuredData.tsx` (Organization / Restaurant / WebSite / ItemList), `src/lib/menuStructuredData.ts` (Menu graph), `src/data/locations.ts` (all NAP, hours, services, order links), `src/data/menu.json`, `scripts/seo-check.mjs` (the guard).

**Update `measurement.md` and `DO-THIS-NEXT.md` as you go.** They are the client-facing record of this engagement, and a stale doc is worse than none.

---

## 10. Suggested order

1. **GA4** — biggest deliverable gap; nothing else is measurable without it
2. **Dish descriptions + the two typos** — highest content ROI, directly targets the queries currently being lost
3. **FAQ** — unblocked, high AI-extraction value
4. **About** — only if it clears the bar on verified facts alone
5. **IndexNow**, then the rest of §8

One PR per task. Each one deploys on merge, so verify against production afterwards — `curl` the page, confirm the JSON-LD, and re-run the relevant probe questions from `measurement.md` a week or two later.
