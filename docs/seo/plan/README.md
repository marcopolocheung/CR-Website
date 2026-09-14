# China Rose — search & AI visibility plan

**Written:** 2026-09-08 · **Owner of this doc:** whoever is doing the next unit of work
**Goal:** when someone in San Antonio asks Google, Google Maps, Bing, ChatGPT, Gemini or Claude for Chinese food near W Military Dr / SW Military Dr — or asks anything about China Rose by name — China Rose is the answer, with correct hours, correct ordering links, and a click that turns into a pickup, a delivery, a call, or a drive.

**→ Picking up this work in a new session? Start with [`HANDOFF.md`](HANDOFF.md).** It is self-contained: current state, confirmed facts, and the next four tasks.

**→ If you just want to know what to do next as the owner, read [`DO-THIS-NEXT.md`](DO-THIS-NEXT.md).** It is the plain-language, current, ordered list. Everything below is the reasoning behind it.

Companion files:

- [`DO-THIS-NEXT.md`](DO-THIS-NEXT.md) — the short version: what to do, in order, right now.
- [`owner-actions.md`](owner-actions.md) — the full reference for everything that happens in a browser or in the store. Most of the remaining ranking gain is here.
- [`measurement.md`](measurement.md) — the baseline captured today, and the monthly check that tells you whether this is working.
- [`../brief.md`](../brief.md) and [`../../seo-research-report.md`](../../seo-research-report.md) — the original research brief and the 2026-08-22 audit this plan builds on.

---

## 1. Where the site actually stands (verified 2026-09-08, not assumed)

The technical SEO phase is **done**. Verified against production and a clean local build:

| Signal | State |
|---|---|
| `robots.txt`, `sitemap.xml` | Live, correct, sitemap referenced from robots |
| Canonicals, OG, Twitter cards, per-page titles/descriptions | Present on all five public pages |
| JSON-LD | `Organization`, `WebSite`, `ItemList`, two `Restaurant` nodes (with `geo`, `openingHoursSpecification`, `sameAs` → Google Business Profile, `hasDriveThroughService`, `OrderAction`), full `Menu` graph, `BreadcrumbList` |
| Utility routes | `/order*`, `/internal/*`, `/schedule`, `/scheduler-demo` all `noindex, nofollow` in production |
| `http`, `www` | Both 301 → `https://chinarosesa.com` |
| Build health | `npx tsc --noEmit`, `npm run build`, `npm run seo:check` all pass |

**So the constraint is no longer the code.** It is these ten things, in rough order of how much they are costing:

1. **No Google Search Console and no Bing Webmaster Tools.** No verification file or DNS record exists. Nobody can see which queries the site appears for, whether pages are indexed, or whether AI surfaces are citing it. Everything else in this plan is guesswork until this is fixed.
2. **No analytics.** Pickup clicks, delivery clicks, phone taps and directions taps are all invisible, so "did this work" is unanswerable in revenue terms.
3. **Hours disagree across the web.** The site and JSON-LD say daily 11:00–21:00. Yelp's W Military listing reads Mon–Sat. Waze and NetWaiter show later closes. Data inconsistency is the single most damaging signal for AI recommendation — assistants cross-check Google, Yelp, Facebook and the site, and demote what they can't reconcile.
4. **The delivery story is mid-change.** `README.md` says delivery is moving to VoiceBit (ask pickup-or-delivery → send a pay link → dispatch a driver), while the site, JSON-LD and every aggregator point at Uber Eats / `order.store`. Publishing more delivery copy before this is settled would multiply the error.
5. **The entity graph is incomplete.** Yelp and Facebook are missing from `sameAs`, so two of the biggest corroborating sources aren't tied to the site. Both listings exist and are publicly identifiable; a duplicate Facebook page also exists.
6. **No favicon.** `https://chinarosesa.com/favicon.ico` is a 404 and no `<link rel="icon">` is emitted. Google renders a generic globe next to the site on mobile — a free brand and CTR loss. The logo file already exists locally at `imgs/24-1127 ChinaRose-logo.png`.
7. **Dish-level content is thin.** 28 of 63 menu items have descriptions. "Lemon chicken" queries and "does China Rose have X" questions are answered better by scraper sites than by chinarosesa.com.
8. **No answer-shaped content.** There is no page that plainly answers "which location is closer to Lackland?", "do you deliver?", "which one has the drive-thru?", "do you cater?", "where do I park?" AI systems lift clean answers that sit under clean headings; the site currently offers facts in fragments.
9. **Not present where AI looks for "near me" answers.** A live search for Chinese food near Lackland AFB returns Uber Eats category pages, TripAdvisor, base directories and military-spouse roundups — China Rose appears in none of them, despite W Military Dr being the obvious answer.
10. **Guardrails don't run in CI.** `.github/workflows/deploy.yml` builds and deploys without running `tsc` or `seo:check`, so the checks that protect all of the above only exist on whoever's laptop remembers to run them.

## 2. The strategy in five sentences

The site is already the cleanest, fastest, most correct source of China Rose facts on the internet; the problem is that nothing points at it and nobody is measuring it.
So: instrument first, settle the facts second, then make every other surface agree with the site.
Google's own guidance is explicit that AI Overviews and AI Mode run on ordinary Search fundamentals — there is no separate AI channel to optimize, and no AI-specific schema or `llms.txt` to add.
What actually moves a two-location restaurant is Google Business Profile completeness, review volume and velocity, identical NAP/hours everywhere, and content that answers real questions in extractable form.
Everything below is ordered by that, with owner work and code work separated because they run in parallel and block each other in only a few places.

## 3. Track A — Instrument (week 1, blocks everything)

Nothing here changes a ranking. It makes every later decision evidence-based instead of superstitious.

- [ ] **A1. Verify Google Search Console** for `chinarosesa.com`. Prefer the **Domain property** (DNS TXT record in GoDaddy) — it covers http/https and every subdomain at once. Fallback: drop the HTML verification file in `public/` (it survives `output: 'export'` untouched).
- [ ] **A2. Submit `https://chinarosesa.com/sitemap.xml`** in GSC → Sitemaps. Confirm 5 URLs discovered.
- [ ] **A3. URL-inspect all five public URLs** in GSC. Record indexed / not-indexed for each in `measurement.md`. Request indexing for any that are missing.
- [ ] **A4. Verify Bing Webmaster Tools** (import from GSC is the fast path) and submit the same sitemap. Bing is the substrate for Copilot and part of ChatGPT's search grounding, so this is not optional in an AI-visibility plan.
- [ ] **A5. Add privacy-light analytics** that works in a static export — Plausible, Umami or GA4. One script tag in `src/app/(public)/layout.tsx`.
- [ ] **A6. Instrument the six conversion clicks** with a location label: `pickup_order_click`, `delivery_order_click`, `phone_click`, `directions_click`, `menu_view`, `location_select`. Touch points: `src/components/LocationCard.tsx`, `src/components/LocationPageContent.tsx`, `src/components/Footer.tsx`.
- [ ] **A7. Add UTMs to the outbound ordering links** (`?utm_source=site&utm_medium=referral&utm_campaign=<location>`) in `src/data/locations.ts`, so Toast-side volume can be attributed back.
- [ ] **A8. Record the baseline** in `measurement.md`: GSC impressions/clicks, GBP calls/directions/website clicks for both locations, review counts and ratings on Google and Yelp, and the AI-probe answers. Do this *before* Track C lands.

**Done when:** GSC and Bing both show the sitemap accepted, and a test click on each of the six events shows up in the analytics dashboard.

## 4. Track B — Settle the facts (week 1, blocks C, E and F)

These are business-identity questions. A wrong answer published in JSON-LD is worse than no answer, because it teaches every downstream system something false. See [`owner-actions.md`](owner-actions.md) §1 for the exact list to hand the owner.

- [ ] **B1. Delivery, definitively.** Is Uber Eats / `order.store` still live for both locations? Is VoiceBit replacing it, adding to it, or phone-only? Until this is answered, do not touch delivery copy, delivery `OrderAction` nodes, or GBP ordering links.
- [ ] **B2. Curbside.** `README.md` says no curbside. Google's own summary of China Rose currently claims curbside pickup — that almost certainly comes from a GBP attribute that needs switching off. Confirm and fix at the source.
- [ ] **B3. Hours, per location, on the record.** Confirm daily 11:00–21:00 for both, or give the real per-location schedule. Yelp's Mon–Sat claim for W Military must be either corrected on Yelp or corrected on the site — one of the two is wrong.
- [ ] **B4. Suite number.** Aggregators list `2535 SW Military Dr #100`. Match `src/data/locations.ts:94` to whatever the Business Profile says, character for character.
- [ ] **B5. Confirm the Yelp listings.** `yelp.com/biz/china-rose-san-antonio-3` = 7046 W Military; `yelp.com/biz/china-rose-san-antonio-2` = 2535 SW Military. Both matched by street address in Yelp's own page titles. Owner confirms ownership and, ideally, claims them.
- [ ] **B6. Confirm the Facebook page.** `facebook.com/chinarosesa` looks official (handle matches the domain). At least one duplicate exists (`facebook.com/179911882044364`). Confirm which is current, whether it covers both locations or one, and merge/delete the duplicate.
- [ ] **B7. Featured dishes wording.** `README.md` asks for no "Combo Meal" phrasing and emphasis on lemon chicken. Get the three final dish names as they should read publicly.
- [ ] **B8. History.** A Facebook-sourced claim of "over 10 years in San Antonio" is circulating. If the owner can confirm a founding year and a true, short origin story, it unlocks an About page — the single strongest remaining differentiator versus competitors who all have one. If not, skip it; do not invent one.

**Done when:** every item above has a written answer in `owner-actions.md` §1, dated and attributed to the owner.

## 5. Track C — Google Business Profile & off-site consistency (weeks 1–3, highest ROI)

This is where a two-location restaurant actually wins, and it is almost entirely non-code. Full click-by-click steps in [`owner-actions.md`](owner-actions.md) §2–§3.

- [ ] **C1.** Confirm owner access and verification status on **both** profiles.
- [ ] **C2.** Primary category `Chinese restaurant` on both. Secondaries only where true (`Takeout Restaurant`, `Delivery Restaurant`, `Asian Restaurant`).
- [ ] **C3.** Hours set to the B3 answer on both. Add holiday hours if any exist.
- [ ] **C4.** Attributes: dine-in, takeout, delivery, drive-thru (**W Military only**), catering, lunch specials — and curbside **off** per B2. Reservations off.
- [ ] **C5.** Website field → the **location page**, not the homepage: `chinarosesa.com/locations/w-military` and `/locations/sw-military`. This is the link that makes each location page rank for its own neighborhood.
- [ ] **C6.** Menu link → `chinarosesa.com/menu` on both.
- [ ] **C7.** Ordering links → whatever B1 settles, with the preferred provider set first.
- [ ] **C8.** Upload 10+ real photos per profile: exterior with signage, the drive-thru at W Military, interior, counter, and the featured dishes. Photo views are now a weighted local ranking interaction — this is not decoration.
- [ ] **C9.** Fix the aggregators, in this order of damage: **MenusWithPrice** (currently points "Official Website" at `chinaroseno.com` — wrong business), **Yelp** hours, **NetWaiter** (`chinarose3.netwaiter.com` — stale hours, claims delivery "No"), **Waze**, **Restaurantji**, **Zmenu**, **restaurant.com**, plus the scraper mirrors `china-rose.goto-restaurants.com` and `china-rose-san-antonio.res-menu.net`.
- [ ] **C10.** Claim what's claimable and unclaimed: **Bing Places**, **Apple Business Connect**, **Nextdoor** (a China Rose page already exists), TripAdvisor. Same NAP, same hours, website → location pages.
- [ ] **C11.** Post to GBP roughly weekly per location — lunch specials, holiday hours, a dish photo. Cheap, and it feeds the interaction signals that 2026's local algorithm reportedly weights more heavily.

**Done when:** name, address, phone, hours and website match exactly across GBP, Yelp, Bing Places, Apple, Facebook and the site — and a fresh search for the brand surfaces no listing contradicting the site.

## 6. Track D — Reviews (starts week 2, never stops)

Review volume, recency and *specificity* are what AI assistants read when deciding who to recommend. The QR assets already exist, unused, at `imgs/china-rose-{military,zarzamora}-google-review-qr.{png,svg}`.

- [ ] **D1.** Print and place the per-location review QR codes: counter, drive-thru window (W Military), receipt/takeout bag.
- [ ] **D2.** Give staff one sentence to say at handoff. No incentives, no gating unhappy customers, no filtering — that's a policy violation and a real risk to the profile.
- [ ] **D3.** Respond to every review, positive and negative, within 48 hours. Name the dish or the situation in the reply; generic replies read as boilerplate to both people and models.
- [ ] **D4.** Set a target and track it monthly in `measurement.md`: **+10 Google reviews per location per month**, no drop in rating.
- [ ] **D5.** Do **not** add review or `aggregateRating` schema to the site. Self-serving review markup for reviews collected elsewhere violates Google's policy and risks a manual action.

## 7. Track E — Code: entity graph, extractability, hygiene (weeks 2–4)

Nine small PRs. **PR-1, PR-3, PR-4, PR-5 and PR-6 shipped 2026-09-08** — all five were unblocked. The remaining four wait on Track B answers. Each is independently shippable, and each ends with the same three commands:

```bash
npx tsc --noEmit
npm run build        # static export → out/
npm run seo:check    # validates out/: JSON-LD graph, headings, canonicals, robots, sitemap
```

### PR-1 — Close the JSON-LD gaps ✅ *shipped 2026-09-08*

- [x] `src/lib/structuredData.tsx:47` — `hasMenu` is still a bare URL. Point it at the real node:
      `hasMenu: { '@type': 'Menu', '@id': `${absoluteUrl('/menu')}#menu`, url: absoluteUrl('/menu') }`.
      Keep the `@type` — `seo-check`'s validator requires a bare `@id` to be typed or defined on the same page.
- [x] `scripts/seo-check.mjs` — flip `/menu` to `requiresJsonLd: true` (the `Menu` graph has existed since PR #17; the flag predates it).
- [x] `scripts/seo-check.mjs` — add `schedule.html` and `scheduler-demo.html` to `noindexPages`. Both are `noindex` in production today, but nothing guards them, so a future refactor can silently expose the staff schedule.
- [x] **Found while testing:** the `noindex` guard did not work. It asserted `html.includes('noindex')` across the whole document, and Next serializes the same metadata into the RSC payload lower down the page — so the check passed even with the real `<meta>` tag flipped to `index, follow`. It now parses the tag's `content` attribute. Verified by breaking it on purpose.
- **Acceptance:** `seo:check` passes with the two new pages guarded, and `out/menu.html` is validated for JSON-LD. ✅

### PR-2 — Complete `sameAs` *(blocked on B5, B6)*

- [x] `src/data/locations.ts` — fill the already-typed `yelpUrl` on both locations.
- [x] `src/lib/structuredData.tsx:108` — add the Facebook URL to the **`Organization`** node's `sameAs` if one page covers both locations; if it's one page per location, it goes on the per-location `sameAs` instead. Note there are two `Organization` literals in that file — line 54 is a deliberate typed stub so references resolve on location pages; `sameAs` belongs on **line 108 only**.
- **Acceptance:** every `Restaurant` node carries ≥2 `sameAs` entries, none of them a `/maps/search/` URL (`seo-check` already fails that).

### PR-3 — Favicon and logo ✅ *shipped 2026-09-08*

- [x] Add `src/app/icon.png` (App Router file convention) derived from `imgs/24-1127 ChinaRose-logo.png`, plus `apple-icon.png`. Google wants a square, ≥48px, multiple-of-48 icon on a stable URL.
- [x] Add `logo` to the `Organization` node in `src/lib/structuredData.tsx`.
- **Acceptance:** `curl -I https://chinarosesa.com/favicon.ico` is 200 after deploy and the homepage emits `<link rel="icon">`.

### PR-4 — CI runs the guards ✅ *shipped 2026-09-08*

- [x] `.github/workflows/deploy.yml` — run `npx tsc --noEmit` and `npm run seo:check` after `npm run build`, before upload. Right now a broken canonical or a lost `noindex` deploys clean.
- [x] While in there: bumped all five actions to current majors (checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5) and Node 20 → 22, clearing the deprecation warning on every run.
- [x] **Found while editing:** `NEXT_PUBLIC_BASE_PATH` was set from `${{ steps.pages.outputs.base_path }}`, referencing a step id that does not exist — it silently evaluated to empty. Empty is correct for a custom domain, so the site was fine by accident. Now set explicitly, with a comment saying why.
- **Acceptance:** deliberately break a canonical on a branch → the workflow fails before deploy.
- **Not done:** `npm run scheduler:test` (34 tests, all passing) could join the same job. Left out to keep this PR to its stated scope.

### PR-5 — Honest `lastmod` ✅ *shipped 2026-09-08*

- [x] `src/lib/seo.ts` — five hand-typed `'2026-08-22'` literals in `indexableRoutes`. A frozen date gets discounted the same way a build-time `new Date()` does. Derive per route from `git log -1 --format=%cI -- <that route's source files>`, which needs `fetch-depth: 0` on `actions/checkout` (it defaults to a shallow clone).
- **Acceptance:** editing only `menu.json` moves `/menu`'s `lastmod` and leaves `/careers` alone.

### PR-6 — Trailing-slash resilience ✅ *shipped 2026-09-08, by a different route than planned*

- [x] `https://chinarosesa.com/menu/` and `/locations/w-military/` returned **404**. Any citation, directory or person that adds a slash hit a dead page.
- [x] **Built differently from the plan.** `trailingSlash: true` would have made the slashed form the only form — tidier, but it migrates all five already-indexed URLs at once and depends on GitHub Pages issuing a 301 that cannot be verified from here. If that assumption were wrong, every indexed URL would 404 at once. Instead `scripts/mirror-trailing-slash.mjs` copies each indexable page to `<route>/index.html` after the export, so both forms return 200. The copy is byte-identical and carries the same canonical pointing at the unslashed form, so the pair consolidates to one URL and nothing has to move.
- [x] Routes are read from the generated `out/sitemap.xml`, so the mirror cannot drift from the published set, and staff/order routes are never mirrored.
- [x] `seo:check` now fails if a mirror is missing or its canonical does not point back at the unslashed URL. Verified by deleting one.
- **Rollback:** drop the script from `npm run build`; the previous output returns exactly. **Still verify after deploy** with `curl -I` on both forms of all five URLs.

### PR-7 — Dish descriptions and dish names *(blocked on B7 and owner copy)*

- [ ] `src/data/menu.json` — 35 of 63 items have no description. Fill them from the real menu. **Do not invent ingredients**; an unfilled description is better than a wrong one.
- [ ] `src/data/featuredDishes.ts` — apply the B7 names.
- **Acceptance:** description coverage ≥90%, `menu.html` `Menu` graph still validates, no dish claims that aren't on the physical menu.

### PR-8 — Answer-shaped content *(blocked on B1–B4, B8)*

This is the AI-extractability work. The pattern that gets lifted into AI Overviews and chat answers is: **a clear question as a heading, a direct answer in the first sentence under it.**

- [ ] Add an FAQ section — on the homepage or a `/faq` route — answering, in the site's own words: do you deliver and how; which location has the drive-thru; are the menus the same; do you cater; what are lunch specials; where do I park; what are your hours; do you take reservations.
- [ ] `FAQPage` schema is optional here. Google retired FAQ rich results in 2026, so it buys no SERP feature; it remains valid vocabulary that other engines and AI crawlers parse. **Every answer must be visible on the page either way** — that's the part that matters.
- [ ] Per-location distinguishing facts on `src/components/LocationPageContent.tsx`: cross street, parking, drive-thru, and which side of town — owner-confirmed only, no invented landmarks.
- [ ] About page **only if B8 produces real history.**
- **Acceptance:** every FAQ answer appears in the rendered HTML; heading order still passes `seo-check`; nothing on the page contradicts the JSON-LD.

### PR-9 — Real photos *(blocked on owner photos with clear rights)*

- [ ] Per-location exterior/interior/dish photos into `public/imgs/`, used on the location pages with descriptive alt text.
- [ ] Give each `Restaurant` node its own `image` array instead of both sharing the site banner.
- **Acceptance:** each location page has ≥1 image unique to that location; Lighthouse LCP does not regress.

## 8. Track F — Be where the "near me" answers come from (month 2)

The Lackland-area search that should be China Rose's home turf currently returns Uber Eats category pages, TripAdvisor, base directories and military-spouse roundups. AI assistants cite those lists. The move is to be *in* them — not to build doorway pages.

- [ ] **F1.** Get listed on the Lackland/JBSA-area restaurant roundups that already rank (`milspouses.com`, `veteranlife.com`, `basedirectory.com`, `livefromthesouthside.com`). Most accept a business submission or a correction email.
- [ ] **F2.** Make sure both locations are present and correct in the delivery-platform category pages that dominate these results.
- [ ] **F3.** Pitch San Antonio food media (MySA, San Antonio Current) **only** if B8 yields a real story. No AI-written press releases, no fabricated angles.
- [ ] **F4.** Real local relationships only — schools, nonprofits, community events near either store. No paid links, no directory spam.
- [ ] **F5.** Ask the owner whether the Lackland proximity claim is one the business actually wants to make before writing it anywhere. It's the strongest geographic hook W Military has.

## 9. Track G — Measure and iterate (ongoing, first review 30 days out)

Detail and templates in [`measurement.md`](measurement.md).

- [ ] **G1.** Monthly: GSC queries split into brand / citywide / neighborhood / dish, plus page-level clicks and CTR.
- [ ] **G2.** Monthly: GBP insights per location — calls, direction requests, website clicks, photo views. 2026's insights reportedly break impressions out by surface, including Maps AI summaries and AI Overviews; if that row is present, it is the closest thing to a direct AI-visibility metric.
- [ ] **G3.** Monthly: run the AI probe set in `measurement.md` against ChatGPT, Gemini, Claude and Google AI Mode. Log whether China Rose appears, whether the facts are right, and what got cited. Wrong facts in an AI answer trace back to a specific bad listing — go fix that listing.
- [ ] **G4.** Monthly: referral traffic from `chatgpt.com`, `perplexity.ai`, Bing/Copilot. Expect small and noisy; treat direction as signal, not volume.
- [ ] **G5.** Quarterly: local rank grid around both stores. City-center rank checks lie to two-location restaurants.

## 10. Sequence

| When | Owner | Code |
|---|---|---|
| Week 1 | B1–B8 answers; A1–A4 verification | A5–A7 analytics; **PR-1**, **PR-3**, **PR-4** |
| Week 2 | C1–C8 both profiles; D1–D3 reviews live | **PR-2**, **PR-5** |
| Week 3 | C9 aggregator cleanup; C10 Bing/Apple/Nextdoor | **PR-6**, **PR-7** |
| Week 4 | C11 posting rhythm; photo shoot for C8/PR-9 | **PR-8**, **PR-9** |
| Month 2 | F1–F5 local presence; D4 review cadence | Backlog from the first GSC data |
| Month 3 | Review against baseline; re-prioritize | Iterate on what the query data actually shows |

## 11. What "it worked" looks like

Measured against the baseline captured in `measurement.md` on 2026-09-08:

- **30 days:** all 5 public URLs indexed in Google and Bing; both GBPs complete and consistent; analytics recording all six conversion events; review flow live in both stores.
- **60 days:** brand queries ("china rose san antonio", "china rose menu") return the site *and* the right Business Profile with correct hours; no aggregator contradicts the site's hours; +20 reviews across both locations; measurable non-branded impressions for neighborhood queries.
- **90 days:** China Rose appears in the local pack for "Chinese food" searches near both stores; AI probes name China Rose for at least the W Military-area and brand questions, with correct hours and ordering method; direction requests, calls and order clicks up against baseline.

## 12. Things not to do

- Don't invent history, awards, signature dishes, landmarks or popularity claims. Every fact on this site should be traceable to the owner.
- Don't add review/`aggregateRating` schema for reviews collected elsewhere.
- Don't build ZIP-code or per-dish doorway pages.
- Don't add an `llms.txt`, AI-specific schema, or hidden instruction text. Google states plainly that AI features run on ordinary Search fundamentals and need no special files; Bing's guidelines treat prompt-injection content as manipulation.
- Don't block crawlers in `robots.txt` for pages you've `noindex`ed — a blocked page can't be read as noindex. `seo-check` already enforces this.
- Don't let a stale aggregator overwrite an owner-confirmed fact.
- Don't ship SEO copy that pushes the pickup/delivery/call buttons below the fold. Conversion first; the whole point is orders, not impressions.

---

### Reference — verification commands

```bash
npx tsc --noEmit
npm run build
npm run seo:check

# after deploy
curl -sI https://chinarosesa.com/robots.txt
curl -s  https://chinarosesa.com/sitemap.xml
curl -s  https://chinarosesa.com/locations/w-military | grep -o '<script type="application/ld+json">.*</script>'
```

Then: Google Rich Results Test and the Schema.org Validator on each location URL, and GSC URL Inspection on anything that changed.
