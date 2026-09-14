# Owner actions — the work that isn't code

**For:** the China Rose owner/manager, or whoever has the logins.
**Why this file exists:** the website is technically finished. Most of the remaining ranking gain now comes from things only someone with account access can do. Nothing here requires a developer.

Work top to bottom. §1 blocks work in the codebase, so do it first.

---

## §1 — Questions that block the website

Write the answer inline under each question, with the date. Anything left blank stays off the site: publishing a guess is worse than publishing nothing, because Google, Yelp, ChatGPT and Gemini all cross-check each other, and a contradiction makes every one of them trust China Rose less.

**1. Delivery — what is actually true today?**
The site, the structured data and every delivery app currently point at Uber Eats / `order.store`. The project notes say delivery is moving to VoiceBit (customer says pickup or delivery → gets a payment link → VoiceBit finds a driver).

- Is Uber Eats still live for W Military? For SW Military? _____
- Is VoiceBit live yet, or planned? Date? _____
- Once VoiceBit is live, does Uber Eats stay on, or come off? _____
- If a customer asks "how do I get delivery from China Rose?", what is the one correct answer? _____

**2. Curbside pickup.** The project notes say there is none, but Google's own description of China Rose currently mentions curbside — which means a Business Profile attribute is switched on that shouldn't be. Confirm: no curbside at either location? _____

**3. Hours, per location. ✅ ANSWERED 2026-09-08 — 9:00 PM close, both locations.**

The website and its structured data are **correct** as published: daily 11:00 AM – 9:00 PM at both stores. No code change needed.

This makes it a cleanup job, not a content job. Every listing below is publishing the wrong closing time and needs correcting to 9 PM:

- [ ] Yelp — W Military listing shows Mon–Sat (should be daily)
- [ ] Yellow Pages / Yahoo Local — showing an 11am–10pm close
- [ ] Waze — showing later weekend closes
- [ ] NetWaiter — stale
- [ ] Toast — one page shows an 8:30 PM close
- [ ] Google Business Profile — confirm it reads 11 AM–9 PM on both

**4. SW Military address.** Directory sites list `2535 SW Military Dr #100`. The site says `2535 SW Military Dr`. Which one is on the Google Business Profile, exactly? _____ (These must match character for character everywhere.)

**5. Yelp.** Two listings match China Rose by street address:
- `yelp.com/biz/china-rose-san-antonio-3` → 7046 W Military. Yours? Claimed? _____
- `yelp.com/biz/china-rose-san-antonio-2` → 2535 SW Military. Yours? Claimed? _____
(The numbering is counter-intuitive. `-3` really is the W Military one.)

**6. Facebook.** `facebook.com/chinarosesa` looks like the official page. At least one other exists (`facebook.com/179911882044364`), plus older duplicates.
- Which page is the current official one? _____
- One page for both locations, or one per location? _____
- Can the duplicates be merged or deleted? _____

**7. Featured dishes.** The project notes ask to drop "Combo Meal" from the wording and lead with lemon chicken. What exactly should the three featured dishes be called on the site? _____ / _____ / _____

**8. History.** A Facebook-sourced line about China Rose being in San Antonio "over 10 years" is circulating.
- Founding year: _____
- True short story of how it started (2–3 sentences, only if real): _____
- Any press, awards or local recognition, with a link: _____

This one is worth effort. Every competitor that outranks China Rose — Golden Wok, Ding How, Hung Fong, Golden Star — has a real story on their site. It is the one thing China Rose can publish that no aggregator can copy. If there's no story to tell, that's fine — say so and it comes off the list permanently.

**8b. History — now blocking a page.** An About page is being built. Without a founding year or a real origin story it can only describe what the restaurant *is*, not where it came from. Every competitor outranking China Rose has that story on their site, and it is the one thing no directory can copy. If there is a real one, it goes straight onto the page.

**9. Photos.** Are there real photos of each location's exterior (with signage), the drive-thru at W Military, interior, counter, and the featured dishes — that China Rose owns and can publish? _____


**10. Google Analytics — needs a property, then one ID.** The site now records
every pick-up click, delivery click, phone tap and directions tap, per location.
It cannot send them anywhere until there is a measurement ID.

- Create a GA4 property at [analytics.google.com](https://analytics.google.com) for `chinarosesa.com` (Admin → Create → Property; data stream type **Web**).
- Copy the **Measurement ID** — it looks like `G-XXXXXXXXXX`. It is not a secret; it ships in the page source.
- Measurement ID: _____
- Then either paste it into GitHub → Settings → Secrets and variables → Actions → **Variables** → New variable, named `NEXT_PUBLIC_GA_ID`, or send it over and it gets set for you.
- While in GA4: Admin → Property → **Product links → Search Console** and link the existing property. That is what puts query → landing page → conversion in one report.

Nothing is collected retroactively. Every day without the ID is a day of order
clicks that can never be reported on.

---

## §1b — Closed location: 1431 Pleasanton Rd

**Confirmed closed 2026-09-08.** A former China Rose. Its listings are still live on Yelp (`china-rose-san-antonio-4`), Favor, Waze, allmenus, RestaurantGuru, MenusWithPrice, Restaurantji and edan.io — and several still show it as open.

Deprioritised by the owner, kept here because it is cheap and it is the direct cause of search and AI answers reporting **three** China Rose locations instead of two.

- [ ] Mark permanently closed on its Google Business Profile (do not delete the profile — a profile marked closed stops competing; a deleted one gets recreated from aggregator data)
- [ ] Mark closed on Yelp
- [ ] Remove or mark closed on Favor
- [ ] Leave the scraper mirrors; they follow the authoritative sources once those are correct

---

## §2 — Google Business Profile (do both locations, separately)

> **Status 2026-09-08:** the website and menu links are **done** — both profiles now point at their own location page rather than the homepage. The rest of this section (categories, hours, attributes, photos, posts) is still open. See [`DO-THIS-NEXT.md`](DO-THIS-NEXT.md) for the current running order.

This is the highest-value work in the entire plan. Two-location restaurants live or die in the local pack and in Maps, and both Google's AI answers and ChatGPT read the profile.

Go to [business.google.com](https://business.google.com) and, for **each** location:

- [ ] **Access.** Confirm you're the owner (not just a manager) and the listing is verified. If it says "claim this business", claim it now — that alone is worth more than anything on the website.
- [ ] **Name.** Exactly `China Rose` on both. No keywords, no city, no "Chinese Restaurant" appended — keyword-stuffed names are a suspension risk.
- [ ] **Address.** The §1.4 answer, character for character.
- [ ] **Phone.** W Military `(210) 675-3226` · SW Military `(210) 927-7339`. Each profile gets its own number, never a shared one.
- [ ] **Primary category:** `Chinese Restaurant`. Secondary, only where true: `Takeout Restaurant`, `Delivery Restaurant`, `Asian Restaurant`.
- [ ] **Hours:** the §1.3 answer. Add special/holiday hours if any exist.
- [ ] **Attributes:** dine-in ✓, takeout ✓, delivery (per §1.1), **drive-thru ✓ on W Military only**, catering ✓, lunch specials ✓. **Curbside pickup OFF** (per §1.2). Reservations OFF.
- [ ] **Website:** the location's own page, not the homepage —
      W Military → `https://chinarosesa.com/locations/w-military`
      SW Military → `https://chinarosesa.com/locations/sw-military`
      This is what makes each page rank for its own part of town.
- [ ] **Menu link:** `https://chinarosesa.com/menu` on both.
- [ ] **Ordering links:** whatever §1.1 settles. Set the preferred provider first if Google offers the choice.
- [ ] **Photos: at least 10 per location.** Exterior with signage, the drive-thru at W Military, interior seating, the counter, and each featured dish. Google's 2026 local algorithm reportedly leans harder on profile interactions — photo views among them — so this is a ranking action, not decoration. Add a few new ones monthly.
- [ ] **Posts:** one per location per week is plenty. Lunch specials, a dish photo, holiday hours. Takes five minutes and keeps the profile active.

> Google's Q&A section was discontinued in late 2025 and is being replaced by AI-generated answers. If your dashboard still shows Q&A, read it for wrong information and correct it; if it's gone, the answers now come from your profile data and your website — which is exactly why §1 and §3 matter.

---

## §3 — Make every other site agree with yours

An AI assistant asked "is China Rose open on Sunday?" checks Google, Yelp, Facebook and the website. If they disagree, it either gives a hedged answer or recommends a competitor it *can* be confident about. This section is about removing every disagreement.

Work in this order — most damaging first.

- [ ] **MenusWithPrice** — lists China Rose's "Official Website" as `chinaroseno.com`, which is a **different business**. Highest-priority correction on the list; use their listing-correction form.
- [ ] **Yelp** (both listings) — claim via [biz.yelp.com](https://biz.yelp.com), then fix hours, address, phone, website (→ the matching location page), menu link, and add photos.
- [ ] **NetWaiter** (`chinarose3.netwaiter.com`) — stale hours and it says delivery "No". Correct or request removal.
- [ ] **Waze** — hours differ from the site; edit through the Waze partner/business flow.
- [ ] **Uber Eats / order.store / Postmates** — confirm both stores are live and hours match. Store links currently in use are in `src/data/locations.ts`.
- [ ] **Restaurantji**, **Zmenu**, **restaurant.com**, **china-rose.goto-restaurants.com**, **china-rose-san-antonio.res-menu.net** — scraped mirrors. Correct where a form exists, ignore where it doesn't. They matter mainly because they carry old hours into AI answers.
- [ ] **Toast** — the pickup pages are yours; make sure the hours there match too. Toast currently shows an 8:30 PM close on one page.

Then claim the profiles that don't exist yet or aren't claimed:

- [ ] **Bing Places** ([bingplaces.com](https://www.bingplaces.com)) — import from Google Business Profile; it takes about two minutes. Bing feeds Copilot and part of ChatGPT's search grounding, so skipping it removes China Rose from a whole class of AI answers.
- [ ] **Apple Business Connect** ([businessconnect.apple.com](https://businessconnect.apple.com)) — this is what Apple Maps and Siri use.
- [ ] **Nextdoor** — a China Rose page already exists; claim it. Nextdoor is disproportionately strong for neighborhood restaurant discovery.
- [ ] **TripAdvisor** — claim and correct.

**The rule for every one of these:** identical name, identical address (including the suite number decision from §1.4), the location's own phone, the §1.3 hours, and the website pointing at that location's page.

---

## §4 — Reviews

Reviews are the strongest thing outside your control that you can still influence, and review *text* is what AI assistants quote when they recommend a restaurant. A review that says "the lemon chicken is the best on the south side" is worth more to you than ten five-star ratings with no words.

The QR codes are already made — they're in the repo folder `imgs/`:
`china-rose-military-google-review-qr.png` (7046 W Military) and `china-rose-zarzamora-google-review-qr.png` (2535 SW Military). Each points at that location's own review form. **Don't mix them up between stores.**

- [ ] Print both at ~4×4 inches and place: at the register, at the drive-thru window (W Military), and on takeout bags or receipts.
- [ ] Give staff one line at handoff: *"If you liked it, a quick Google review really helps us."* That's the whole script.
- [ ] Respond to every review within 48 hours — good and bad. Mention the specific dish or the specific problem. Generic replies read as boilerplate to customers and to models.
- [ ] Target: **+10 Google reviews per location per month.**

**Rules that protect the profile:** no discounts or free food in exchange for reviews; no asking only happy customers; no staff or family reviews; never respond with a customer's private details. Any of these can get a profile suspended, which costs more than every gain in this plan combined.

---

## §5 — Monthly, once everything above is running

Fifteen minutes, first week of each month. Fill in `measurement.md`.

- [ ] Google Search Console → Performance. What are people typing? Anything surprising becomes next month's content.
- [ ] Google Business Profile → both locations: calls, direction requests, website clicks, photo views. If your dashboard splits impressions by surface (Maps AI summaries, AI Overviews), record that row — it's the closest thing to a direct read on AI visibility.
- [ ] Review counts and ratings, both locations, Google and Yelp.
- [ ] Ask ChatGPT, Gemini and Google's AI Mode the probe questions in `measurement.md`. Any wrong fact in their answer came from a specific listing — find it and fix it there.
- [ ] Post to both Business Profiles, and add a photo or two.
