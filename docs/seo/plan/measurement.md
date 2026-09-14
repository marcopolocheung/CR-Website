# Baseline and measurement

Everything in this file was verified on the date shown — not carried over from the earlier research. Re-measure monthly and append; don't overwrite history, the trend is the point.

---

## 1. Baseline — 2026-09-08

### Site health (verified against production and a clean local build)

| Check | Result |
|---|---|
| `https://chinarosesa.com/` | 200 |
| `/robots.txt` | 200, correct, references the sitemap |
| `/sitemap.xml` | 200, 5 URLs, all `lastmod` frozen at `2026-08-22` |
| `/menu`, `/locations/w-military`, `/locations/sw-military`, `/careers` | 200 |
| `http://` and `https://www.` | Both 301 → `https://chinarosesa.com` |
| `/menu/`, `/locations/w-military/` (trailing slash) | **404** — see PR-6 |
| `/favicon.ico` | **404**, no `<link rel="icon">` emitted — see PR-3 |
| `noindex` on `/order`, `/order/*`, `/internal/*`, `/schedule`, `/scheduler-demo` | Present in production |
| JSON-LD | `Organization`, `WebSite`, `ItemList`, 2× `Restaurant` (geo, hours, GBP `sameAs`, drive-thru, `OrderAction`), `Menu`, `BreadcrumbList` |
| `npx tsc --noEmit` / `npm run build` / `npm run seo:check` | All pass |
| Analytics | **None installed** |
| Google Search Console / Bing Webmaster | **Not verified** — no verification file or DNS record found |

> **Updated later the same day:** PRs #51–#56 shipped and deployed. The trailing-slash 404s, the missing favicon and the frozen `lastmod` are all resolved in production, and CI now gates deploys on `tsc` and `seo:check`. The rows above are kept as the pre-fix baseline. Search Console, Bing and analytics remain outstanding.

> **Analytics, 2026-09-08:** GA4 is now built into the site and merged — the six
> conversion events, page views on every route change, and UTMs on the outbound
> ordering links. It is **not collecting yet**: the build reads the measurement
> ID from `NEXT_PUBLIC_GA_ID`, and that ID does not exist until the owner creates
> the property (`owner-actions.md` §1.10). Nothing is recorded retroactively, so
> the gap between the merge and the ID being set is data that cannot be recovered.
> The `Pickup / delivery / phone / directions clicks` row below stays blank until
> then, and the first full month of conversion data starts from the day it is set.

### Content inventory

| Metric | Value |
|---|---|
| Indexable public pages | 5 |
| Menu categories / sections / items | 6 / 12 / 63 |
| Menu items with a description | **28 of 63** (44%) |
| Menu items with an image | 41 of 63 |
| Real location photos on the site | **0** (both locations share the site banner) |
| FAQ / answer-shaped content | **None** |
| About / history page | **None** |

### Off-site, as observed 2026-09-08

Sourced from public search results; confirm each in the actual dashboard before treating as fact.

| Surface | State |
|---|---|
| Google Business Profile, both locations | Exists and is linked from the site's `sameAs`. Access, verification and attributes unconfirmed |
| Google's own summary of the business | Claims **curbside pickup**, which the project notes say is wrong |
| Yelp — 7046 W Military (`china-rose-san-antonio-3`) | ~59 reviews, 29 photos. Hours shown **Mon–Sat**, conflicting with the site |
| Yelp — 2535 SW Military (`china-rose-san-antonio-2`) | ~85 reviews, 54 photos |
| Facebook `facebook.com/chinarosesa` | ~180 likes. At least one duplicate page exists |
| Nextdoor | A China Rose page exists, claim status unknown |
| Bing Places / Apple Business Connect | No evidence of a claimed listing |
| Stale or wrong third parties | MenusWithPrice (points at `chinaroseno.com` — a different business), NetWaiter (stale hours, delivery "No"), Waze (later closing times), Zmenu, Restaurantji, restaurant.com, goto-restaurants, res-menu |

### AI / SERP visibility, as observed 2026-09-08

- Brand queries surface the site alongside Yelp, Postmates, Zmenu, NetWaiter, Restaurantji and several scraper mirrors — but the aggregators, not the site, supply most of the facts being summarized.
- **"Chinese food near Lackland AFB" returns no China Rose at all.** Results are Uber Eats category pages, TripAdvisor, Panda Express, Manchu Wok, base directories and military-spouse roundups. This is the clearest visible gap, and W Military Dr should own that query.
- AI-generated summaries of China Rose are already circulating with at least two errors: curbside pickup, and Mon–Sat hours at W Military.

### AI / SERP probe baseline — run 2026-09-08

Captured before any Business Profile or citation cleanup, so it is the before-picture. Method: web-search grounding, the same substrate AI answers are built on. Not identical to querying ChatGPT/Gemini directly — those carry their own indexes — so re-run the probes in those tools too when convenient. What appears here is what the underlying sources say about China Rose today.

**Brand questions**

| # | Question | Result |
|---|---|---|
| 1 | What is China Rose? | Answered. Site ranks. But descriptions come from aggregators, not the site |
| 2 | Hours? | **Wrong.** Reported as W Military 11am–**10pm**, SW Military 11am–9pm, Pleasanton 11am–10pm. Site and JSON-LD say both are 11–9 |
| 3 | Locations? | **Wrong — reports THREE.** A 1431 Pleasanton Rd listing is being counted as a China Rose location |
| 4 | Delivery? | Answered "yes" — via Uber Eats, Postmates **and Favor**. Favor was not previously known to us and is not on the site |
| 5 | Drive-thru? | Correctly attributed to W Military |
| 6 | Menu? | Answered, and **correctly**. An earlier note in this file called pad Thai and moo goo gai pan hallucinations; both are genuinely on the menu (`RICE / NOODLES → PAD THAI`, and moo goo gai pan under `OTHERS`). Corrected 2026-09-08 |
| 7 | Catering / lunch specials? | Answered yes — but sourced partly from `chinaroseno.com`, a different business |

Two systemic errors recur across answers: **curbside pickup** (which the owner says does not exist) and a **wrong website**. One answer directed users to `china-rose-chinese.com`, a domain China Rose does not own.

**Discovery questions**

| # | Question | China Rose present? |
|---|---|---|
| 8 | Chinese food near Lackland AFB | **No** |
| 9 | Chinese restaurants on Military Drive | Yes — SW Military only, W Military absent |
| 10 | Chinese takeout 78227 | **No** — despite W Military being in 78227 |
| 11 | Chinese food south side San Antonio | **Yes**, quoted as "best Chinese food in the South side" |
| 12 | Lemon chicken in San Antonio | **No** — Ding How owns this query. Lemon chicken is China Rose's #1 featured dish |
| 13 | Chinese restaurant with drive-thru | **No** — despite publishing `hasDriveThroughService` |
| 14 | Cheap Chinese lunch specials | Partial, and partly attributed to the wrong business |

**Score: brand 4/7 fully correct. Discovery 2/7 present.**

**The Pleasanton Rd problem — new, and the biggest single finding.**
A third "China Rose" at 1431 Pleasanton Rd, San Antonio TX 78221, phone (210) 977-8880, has live listings on Yelp (`china-rose-san-antonio-4`, 19 reviews, updated September 2026), Favor, Waze, allmenus, restaurantguru, MenusWithPrice, Restaurantji and edan.io. At least one source says permanently closed; others still show it as open.

**Answered by the owner 2026-09-08: it is a former China Rose location and it is closed.** The listings are outliving the restaurant. That is why question 3 returns the wrong answer — three entities, one of which no longer exists. Owner has deprioritised acting on it for now; marking it permanently closed on Google, Yelp and Favor stays on the list as a cheap, high-value cleanup whenever there is time.

**New citation sources found in this sweep** (add to the §3 cleanup list in `owner-actions.md`): Favor Delivery (three locations, including Pleasanton), Postmates, Yellow Pages (two listings), Yahoo Local, MenuPix, allmenus, RestaurantGuru, edan.io. Favor lists SW Military as `2535 Southwest Military Drive #100`, which supports the suite-number question.

---

### Numbers we don't have yet

These are blank because Track A hasn't run. Fill them the day GSC, Bing and analytics come online — before the Track C cleanup lands, or the before/after is lost.

| Metric | Baseline |
|---|---|
| GSC impressions / clicks (28 days) | — |
| GSC indexed pages | — |
| Bing impressions / clicks | — |
| GBP calls — W Military / SW Military | — |
| GBP direction requests — W Military / SW Military | — |
| GBP website clicks — W Military / SW Military | — |
| GBP photo views — W Military / SW Military | — |
| Google review count and rating, per location | — |
| Pickup / delivery / phone / directions clicks | — (tracking shipped 2026-09-08; collection starts when `NEXT_PUBLIC_GA_ID` is set) |

---

## 2. The AI probe set

Run these monthly against **ChatGPT, Gemini, Claude, Google AI Mode and Copilot**, in a fresh chat with no memory of previous ones. Record three things per question: *did China Rose appear*, *were the facts right*, *what got cited*.

This is the only direct read available on AI visibility, and it's diagnostic: a wrong fact in an AI answer always traces back to a specific bad listing. Find that listing, fix it there, re-probe next month.

**Brand questions — must be right:**
1. What is China Rose in San Antonio?
2. What are China Rose's hours?
3. Where are China Rose's locations in San Antonio?
4. Does China Rose deliver? How do I order delivery?
5. Does China Rose have a drive-thru?
6. What's on the menu at China Rose San Antonio?
7. Does China Rose cater?

**Discovery questions — the ones worth winning:**
8. Best Chinese food near Lackland AFB.
9. Chinese restaurants on Military Drive in San Antonio.
10. Chinese takeout near 78227.
11. Chinese food on the south side of San Antonio.
12. Where can I get lemon chicken in San Antonio?
13. Chinese restaurant with a drive-thru in San Antonio.
14. Cheap Chinese lunch specials in San Antonio.

Score honestly. Questions 1–7 wrong means a data problem — fix the listing. Questions 8–14 absent means a presence problem — Track F.

---

## 3. Monthly log

Copy this block each month.

```
## YYYY-MM-DD

Search Console (28d):    impressions ___  clicks ___  avg position ___
  brand / citywide / neighborhood / dish split: ___ / ___ / ___ / ___
  indexed pages: ___
  new queries worth acting on: ___

Bing (28d):              impressions ___  clicks ___

GBP — W Military:        calls ___  directions ___  website ___  photo views ___
GBP — SW Military:       calls ___  directions ___  website ___  photo views ___
  AI-surface impressions (if shown): ___

Reviews:                 Google W ___ (__★)  Google SW ___ (__★)
                         Yelp W ___ (__★)    Yelp SW ___ (__★)

Site conversions:        pickup ___  delivery ___  phone ___  directions ___
AI referrals:            chatgpt ___  perplexity ___  copilot/bing ___

AI probes:               brand correct ___/7   discovery present ___/7
  wrong facts found, and which listing caused them: ___

Shipped this month: ___
Next month's one thing: ___
```

---

## 4. Targets

Measured against the 2026-09-08 baseline above.

| | 30 days | 60 days | 90 days |
|---|---|---|---|
| **Indexing** | 5/5 URLs indexed in Google and Bing | Stable | Stable |
| **Data consistency** | GBP complete on both; hours identical everywhere | No aggregator contradicts the site | Holds without maintenance |
| **Reviews** | Flow live in both stores | +20 total | +40 total, rating held |
| **AI probes** | Baseline recorded | Brand questions 6/7 correct | Brand 7/7; China Rose named in ≥3 discovery questions |
| **Local pack** | Both profiles complete | Appearing near each store | Ranking for "Chinese food" near both stores |
| **Conversions** | All six events tracked | Baseline established | Measurable lift in calls, directions and order clicks |

One caution on expectations: industry measurement suggests AI assistants recommend a far narrower set of local businesses than the Google local pack does — a business visible in roughly a third of local-pack opportunities may show up in a small single-digit share of ChatGPT answers. Correct data and real reviews are what move that number, and they move it slowly. The local pack is still where the orders come from; AI visibility follows the same signals rather than requiring separate ones.
