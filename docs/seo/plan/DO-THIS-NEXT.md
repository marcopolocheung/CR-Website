# Do this next

**Updated:** 2026-09-08. Start here. `owner-actions.md` is the full reference; this is the short, current, ordered list.

---

## The one thing to understand

Your website has 5 pages. **Google has only indexed 1 of them** — the homepage.

The menu page and both location pages are invisible to Google. Not ranked badly. Not there at all.

That single fact explains almost everything:

| Someone searches | What happens | Why |
|---|---|---|
| "Chinese takeout 78227" | China Rose doesn't appear | The W Military page isn't in Google |
| "Chinese drive-thru San Antonio" | Doesn't appear | Same page |
| "lemon chicken San Antonio" | Doesn't appear | The menu page isn't in Google |

Nothing else matters until this changes. A page Google hasn't indexed cannot rank for anything, and ChatGPT and Gemini can't cite it either.

**The website is not the problem.** Every page is technically perfect — crawlable, correct tags, full structured data. I checked all four. The problem is that nothing on the internet points at those pages, so Google doesn't think they're worth adding.

**The fix is links from trusted sites pointing at those exact pages.** That's what this list is.

---

## ✅ Done

- Google Search Console verified, sitemap submitted
- Bing Webmaster verified, sitemap submitted, URLs submitted
- Google Business Profile website + menu links pointed at the right pages ← *the big one*

That last one is the strongest single signal available to a local business. It may take a week or two to show up. Don't redo it.

---

## 🔜 Do these next

Ordered by value. Each takes 5–15 minutes.

### 1. Ask for reviews — ✅ DONE (QR codes placed 2026-09-08)

Keep it running: reply to every review within two days, good or bad, and mention the actual dish or the actual problem. Track the count monthly in `measurement.md` — target is +10 per location per month.

The original setup notes, for reference:

The QR codes are already made, in the `imgs/` folder:

- `china-rose-military-google-review-qr.png` → 7046 W Military
- `china-rose-zarzamora-google-review-qr.png` → 2535 SW Military

**Do:** print both at about 4×4 inches. Put them at the register, at the drive-thru window (Military location), and on takeout bags. Don't swap them between stores — each one points at that location's own review page.

Tell staff one line at handoff: *"If you liked it, a quick Google review really helps us."* That's the whole script.

**Then:** reply to every review within two days, good or bad. Mention the actual dish or the actual problem.

**Why it matters:** when someone asks ChatGPT or Google "best Chinese food near me," the answer is built largely from review text. A review saying *"the lemon chicken is the best on the south side"* is worth more to you than ten silent 5-star ratings.

**Never:** offer free food for reviews, ask only happy customers, or have staff and family post them. Any of those can get the whole profile suspended, which costs more than everything on this list combined.

---

### 2. Create the Google Analytics property — 10 minutes

The website now counts every "Order Pick-Up on Toast" click, every delivery
click, every tap on a phone number and every request for directions, separately
for each location. Until this step is done it counts them into nothing.

**Do:**
1. Go to [analytics.google.com](https://analytics.google.com) and create a property for `chinarosesa.com` (Admin → Create → Property). When it asks for a data stream, choose **Web**.
2. Copy the **Measurement ID**. It looks like `G-XXXXXXXXXX`.
3. Send it over — or set it yourself in GitHub → Settings → Secrets and variables → Actions → **Variables** → New variable, named `NEXT_PUBLIC_GA_ID`. It is not a password; it is visible in the page source by design.
4. While you're in there: Admin → Property → **Product links → Search Console**, and link the property you already verified.

**Why it matters:** right now we can prove people *find* the site and nothing
about whether they *order*. Search Console stops at the click. These six numbers
are the ones that translate into money, and they are the only way to tell which
of the two locations the website is actually feeding.

**One catch:** analytics never fills in the past. The day this is switched on is
day one of the data.

---

### 3. Bing Places — 5 minutes

Separate from Bing Webmaster Tools, which you already did.

**Do:** go to [bingplaces.com](https://www.bingplaces.com) → **Import from Google Business Profile**. It pulls both locations across with everything already filled in.

Then check that each location's website field points at its own page, same as you did in Google:
- Military → `chinarosesa.com/locations/w-military`
- Zarzamora → `chinarosesa.com/locations/sw-military`

**Why it matters:** Bing is what Copilot reads, and it's part of how ChatGPT looks things up. Being in Google does not put you in Bing.

---

### 4. Apple Business Connect — 10 minutes

**Do:** go to [businessconnect.apple.com](https://businessconnect.apple.com), sign in with an Apple ID, search for each location, claim it. Verification is usually a phone call to the store or a postcard.

Set the same website links as above.

**Why it matters:** this is what Apple Maps and Siri use. Every iPhone that asks for directions to a Chinese restaurant is reading this.

---

### 5. Facebook — 5 minutes

You have access to this one already.

**Do:** on `facebook.com/chinarosesa` → Edit Page Info → set **Website** to `https://chinarosesa.com`. Check the address, phone and hours match the website exactly.

Also: there's at least one duplicate China Rose page floating around. If you can merge or delete it, do — duplicates split your reviews and confuse search engines about which page is real.

---

### 6. Toast and Uber Eats — 5 minutes

**Do:** in each store's profile, if there's a website field, point it at that location's page.

**Why it matters:** these are high-trust sites that already link to you. Pointing them at the location pages instead of nowhere helps those pages get found.

---

## ⏸️ Blocked, and how to unblock

### Yelp — needs a phone call at the store

This is almost certainly what's stopping you. Claiming a Yelp listing requires **verification**, and Yelp verifies by calling the restaurant's phone number and reading out a code. You have to be standing at that phone to answer it.

**Do:**
1. Go to [biz.yelp.com](https://biz.yelp.com) → search "China Rose" + the street address.
2. Two listings are yours:
   - `yelp.com/biz/china-rose-san-antonio-3` → **7046 W Military**
   - `yelp.com/biz/china-rose-san-antonio-2` → **2535 SW Military**
   (The numbering is backwards from what you'd guess. `-3` is the Military location.)
3. Click **Claim this business**.
4. **Be at that location** when you do it, with someone able to answer the restaurant's phone. Yelp calls immediately with a code.
5. Repeat at the other store, on another visit.

Once claimed: fix the hours (Yelp currently says the Military location is Monday–Saturday, which contradicts your website), set the website field to that location's page, and add photos.

There's also a **third listing that is not yours to keep** — `china-rose-san-antonio-4`, the closed Pleasanton Rd store. Marking that one closed is what stops search engines saying you have three locations.

**Why it matters:** Yelp is one of the main sources AI assistants read for restaurant recommendations. The "best Chinese food in the South side" line that shows up in search results today came from Yelp.

### Nextdoor — you're in the wrong flow

Nextdoor pushes ads hard, but the **free business page is separate and you don't need to pay**.

**Do:** go to [business.nextdoor.com](https://business.nextdoor.com) and look for **"Claim your free Business Page"** — not "Advertise" or "Create an ad." A China Rose page already exists, so you're claiming an existing page rather than making a new one.

If the only option you're offered is an ad, park it. It's worth doing but it's the lowest-value item here, and it isn't worth paying for.

**Don't buy ads for any of this.** Nothing on this list needs paid placement.

---

## 🔒 Waiting on you (blocks work on the website)

I can't publish these without real answers, because a wrong fact in the website's data teaches Google, ChatGPT and Gemini something false — which is worse than saying nothing.

1. ~~**Hours.**~~ ✅ Answered: **9 PM**, both locations. The website is correct; the directories are wrong. Fixing them moved to the cleanup list in `owner-actions.md` §1.3.
2. **Delivery.** There are now four stories in circulation: Uber Eats, Postmates, Favor, and your note about VoiceBit. If a customer asks "how do I get China Rose delivered?", what is the single correct answer today?
3. **Curbside.** Google currently tells people you offer curbside pickup. Your notes say you don't. Confirm and I'll flag it for the profile.
4. **Featured dish names.** You wanted "Combo Meal" dropped and lemon chicken leading. What should the three be called exactly?
5. **Dish descriptions.** 35 of your 63 menu items have no description. Any you can write get published; I won't invent them.
6. **History.** Founding year and a true short story, if there is one. Every competitor beating you has one on their site, and it's the one thing no directory can copy from you.

---

## 💻 Ready to ship on your word

Nothing is waiting on a yes right now. The page-title rewrite that used to sit
here shipped on 2026-09-08 — all four titles and descriptions now name the city,
the cuisine and the street.

Next up in the code, in order: descriptions for the 35 menu items that have none,
an FAQ page, and an About page. The first two need no input from you. The About
page needs §🔒 item 6 below.

---

## How you'll know it's working

Check Google Search Console in about two weeks:

- **Performance → Pages** should list more than just the homepage. That's the win condition for this whole list.
- Search `site:chinarosesa.com` in Google — more than one result means it worked.

Nothing here shows up instantly. Business Profile changes take days; indexing takes one to three weeks. Do the list, then leave it alone.
