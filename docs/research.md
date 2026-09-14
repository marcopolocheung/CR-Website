# China Rose SEO, Local Search, and AI Search Deep Research

Act as a senior technical SEO, local SEO strategist, restaurant-growth researcher, information architect, and web engineer.

Your task is to perform a deep, evidence-based SEO investigation for **China Rose**, a two-location Chinese restaurant in San Antonio, Texas, and turn that research into a technically actionable strategy that can subsequently be implemented with coding agents such as Codex and OpenCode.

## Assets

Production website:

https://chinarosesa.com/

Public repository:

https://github.com/marcopolocheung/CR-Website

Hosting/deployment context:

* Next.js website
* Static export
* GitHub Pages
* Custom domain
* Domain/DNS managed through GoDaddy
* Restaurant has two physical San Antonio locations
* Pickup and third-party delivery are important conversions

## Primary objective

Determine what China Rose should do to maximize qualified discovery and conversions from:

1. Google organic search
2. Google Maps / local pack / Google Business Profile
3. Bing organic/local search
4. Google AI Overviews and AI Mode
5. Microsoft Copilot / Bing AI experiences
6. ChatGPT Search and other major LLM/search-agent discovery systems
7. Third-party restaurant/search ecosystems that materially affect entity authority and discovery

The business goal is not vanity traffic.

Optimize toward restaurant outcomes:

* pickup orders
* delivery orders
* phone calls
* directions
* menu views
* branded discovery
* new-customer discovery
* repeat-customer navigation
* visibility for relevant local and dish-level searches

## Research rules

DO NOT begin by making code changes.

Research first.

Use current sources, prioritizing primary/authoritative documentation for technical claims:

* Google Search Central
* Google Business Profile documentation
* Bing Webmaster documentation
* OpenAI crawler/search documentation
* Next.js documentation
* Schema.org where relevant
* GitHub documentation where relevant

For the local competitive investigation, use current search results, restaurant websites, Google/Maps information where accessible, local San Antonio publications, ordering platforms, review platforms, and credible food publications.

Distinguish explicitly among:

* verified facts
* observations
* reasonable hypotheses
* recommendations
* items requiring owner confirmation

Never invent restaurant history, ownership, cuisine provenance, awards, recipes, popularity claims, customer demographics, or signature dishes.

Do not fabricate keyword volumes.

If volume data is unavailable, categorize terms qualitatively by intent and explain what data source should be used to validate demand.

Pay particular attention to information freshness. Record research dates where appropriate.

## Stage 1: Audit the current production site

Crawl and inspect the production website.

Inventory all indexable routes.

For every important route inspect:

* HTTP/indexability
* title
* meta description
* canonical
* H1
* H2/H3 hierarchy
* visible textual content
* navigation/internal links
* image alt text
* structured data
* Open Graph metadata
* robots directives
* duplication
* location relevance
* conversion paths

Investigate:

* robots.txt
* sitemap.xml
* canonical host behavior
* HTTP → HTTPS behavior
* www/non-www behavior
* 404 behavior
* URL structure
* crawlability
* JavaScript dependency
* generated static HTML
* mobile usability
* Core Web Vitals / performance where measurable
* image sizes/formats
* accessibility
* structured data validity

Do not infer implementation merely from source code. Compare repository implementation with actual generated/production HTML.

Create a route-level audit table.

## Stage 2: Audit the repository

Inspect the repository architecture.

Identify:

* Next.js version
* App Router structure
* static export configuration
* route structure
* global metadata
* page-specific metadata
* image configuration
* menu data source
* location data source
* shared components
* analytics
* schema markup
* sitemap implementation
* robots implementation
* canonical implementation
* build/deployment workflow

Determine what SEO improvements should be implemented globally versus per page.

Check current Next.js documentation before recommending APIs or metadata conventions.

Account specifically for static export and GitHub Pages behavior.

For every technical recommendation, specify:

* files likely affected
* implementation approach
* expected generated HTML/output
* validation method
* possible risks

## Stage 3: Analyze China Rose as a local business entity

Determine what search engines can currently learn about China Rose.

Investigate consistency across available authoritative/public sources for:

* business name
* addresses
* phone numbers
* hours
* website
* menu
* cuisine/category
* ordering providers
* location count
* social profiles
* business history where verifiable

Flag inconsistencies.

Design an entity model for:

* China Rose brand
* W Military location
* SW Military location

Determine appropriate Schema.org / Google-supported structured data.

Evaluate `Restaurant`, `LocalBusiness`, `Organization`, `WebSite`, breadcrumb and other relevant structured data.

Avoid unsupported or deceptive schema.

Do not add self-serving review markup merely to obtain review stars.

## Stage 4: Local SEO and Google Business Profile

Research current Google local-ranking guidance.

Audit or describe the required audit for each China Rose Google Business Profile.

Evaluate:

* ownership/verification
* primary category
* secondary categories
* NAP consistency
* hours
* special hours
* dine-in/takeout/delivery attributes
* menu URL
* ordering provider links
* preferred ordering provider
* website URL
* location-specific landing page
* photos
* dish photos
* products/menu content where applicable
* Q&A where applicable
* posts where useful
* review volume
* review velocity
* review sentiment/themes
* owner responses

Develop a compliant review-acquisition process.

No incentives.
No review gating.
No fake reviews.

Explain which local-ranking factors are controllable and which are not.

## Stage 5: San Antonio competitive research

Research the current Chinese/Asian restaurant search landscape in San Antonio.

Include both citywide competitors and competitors near each China Rose location.

At minimum investigate prominent or frequently surfaced restaurants such as:

* Golden Wok
* Ding How
* Hung Fong
* Silver Star Cafe
* relevant modern Chinese/Szechuan restaurants
* relevant competitors near W Military / Lackland
* relevant competitors near SW Military / South Side

Do not limit the list to these restaurants.

For each significant competitor analyze:

* search positioning
* title/page structure
* location pages
* menu implementation
* restaurant story
* specialties
* content depth
* structured data where detectable
* Google Business Profile/local presence where observable
* reviews
* press mentions
* backlinks/citations where observable
* notable differentiators

Answer:

“Why might a search engine or AI assistant confidently recommend this restaurant instead of China Rose?”

Then answer:

“What defensible information/assets could China Rose build that competitors cannot easily copy?”

## Stage 6: Search-intent and keyword architecture

Develop a keyword/topic model rather than a giant undifferentiated keyword list.

Group opportunities into clusters such as:

### Brand

China Rose San Antonio
China Rose menu
China Rose W Military
China Rose SW Military
etc.

### Citywide commercial

Chinese restaurant San Antonio
Chinese food San Antonio
Chinese takeout San Antonio
Chinese delivery San Antonio
etc.

### Location/neighborhood

Chinese food near Lackland AFB
Chinese restaurant West Side San Antonio
Chinese food 78227
Chinese restaurant South Side San Antonio
Chinese food SW Military
Chinese food 78224
etc.

### Dish intent

Derive candidate dish searches from the actual China Rose menu.

Examples may include:
lemon chicken
orange chicken
Mongolian beef
fried rice
lo mein
egg rolls
combination plates
lunch specials

Do not assume those examples have meaningful volume. Research and validate them.

### Occasion/use-case

Only where actually supported:
lunch
family dinner
takeout
delivery
large portions
budget/value
etc.

Map each search-intent cluster to the best existing or proposed URL.

Avoid keyword cannibalization.

Do not recommend doorway pages.

Do not create a page for every keyword variant.

## Stage 7: Content strategy

Assess whether the homepage currently contains enough information to establish:

* what China Rose is
* where it operates
* what it serves
* why someone should choose it
* what makes it different

Recommend an improved homepage information architecture without destroying its usefulness as a fast restaurant landing page.

Develop a strategy for genuinely distinct location pages.

Each location page should contain useful location-specific information such as, where verified:

* neighborhood/context
* nearby landmarks
* access/parking
* service types
* popular dishes
* ordering
* hours
* dining information
* relevant photography
* FAQs
* links to menu

Determine whether an `/about` page should exist.

Identify the owner questions that must be answered before writing it.

Evaluate the central menu page.

Determine opportunities for:

* better title/H1
* category navigation
* dish descriptions
* internal linking
* signature/popular dishes
* high-quality dish imagery

Do not convert the site into an SEO-content farm.

Only recommend blog/editorial content when China Rose has something genuinely useful or locally original to publish.

## Stage 8: Authority, citations, reviews, links and PR

Investigate the restaurant's current off-site footprint.

Identify important citation/profile ecosystems such as relevant:

* Google
* Bing
* Apple
* Yelp
* TripAdvisor
* Uber Eats
* Toast
* other delivery platforms
* San Antonio restaurant directories
* local publications
* neighborhood/community sites
* chambers/business groups

Check NAP/entity consistency.

Research realistic local link and PR opportunities.

Prioritize earned links and genuine relationships.

Possible categories include:

* San Antonio food media
* neighborhood publications
* community organizations
* local events
* schools/nonprofits
* military-community organizations where legitimately relevant
* food writers
* local creators

Do not recommend:

* link buying
* PBNs
* mass guest-post spam
* fake local sites
* artificial citation spam

Develop press/story angles only from verifiable China Rose facts.

## Stage 9: AI search / LLM / GEO investigation

Research current official guidance for:

* Google AI Overviews
* Google AI Mode
* Bing/Copilot
* ChatGPT Search
* OpenAI crawlers

Separate proven recommendations from speculative GEO folklore.

Specifically research:

* Google generative-search optimization guidance
* OAI-SearchBot
* GPTBot
* ChatGPT-User where relevant
* Bing AI citations
* Bing grounding queries
* crawler controls
* machine-readable structured data
* whether `llms.txt` has demonstrated value

Determine appropriate robots policy for China Rose.

Treat search discovery and model-training permission as separate decisions.

Optimize the website so machines can answer factual restaurant questions confidently.

Test questions such as:

* What is China Rose in San Antonio?
* Where are its locations?
* Which location is close to Lackland?
* When does it open?
* Does it offer takeout?
* Does it deliver?
* What does it serve?
* What are its notable dishes?
* How do I order?
* Which China Rose location should I visit?

Identify which answers are currently ambiguous, absent, image-only, inconsistent, or poorly sourced.

Recommend ways to make those facts explicit, visible and verifiable.

Do not recommend AI-generated filler.

Do not recommend `llms.txt` merely because it is fashionable.

## Stage 10: Structured-data specification

Produce a concrete schema plan.

Include sample JSON-LD based only on verified facts for:

* restaurant/location entities
* brand/organization where appropriate
* breadcrumbs where appropriate

Use stable `@id` identifiers.

Link related entities appropriately.

Specify what belongs on:

* homepage
* each location page
* menu page
* about page

Cross-check against current Google structured-data documentation.

Provide a test/validation procedure.

## Stage 11: Analytics and measurement

Design measurement around business outcomes rather than traffic alone.

Recommend tracking for events such as:

* pickup-order click
* delivery-order click
* phone click
* directions click
* menu view
* location selection

Define Search Console reporting for:

* branded queries
* non-branded queries
* location queries
* dish queries
* pages
* CTR
* impressions
* ranking trends

Define Google Business Profile metrics.

Define Bing Webmaster metrics.

Include Bing AI Performance metrics if currently available.

Define ChatGPT referral measurement, including current OpenAI referral attribution behavior.

Explain how local rankings should be measured geographically around each store rather than from one arbitrary search location.

Create baseline, 30-day, 60-day and 90-day KPIs.

## Stage 12: Technical implementation roadmap

Convert recommendations into engineering tickets appropriate for Codex/OpenCode.

Organize approximately as:

### PR 1 — SEO infrastructure

metadata
canonical configuration
robots
sitemap
schema infrastructure

### PR 2 — Location SEO

location-specific metadata
Restaurant JSON-LD
location content/data structure
internal links

### PR 3 — Homepage/entity content

brand information
location connections
about/story architecture

### PR 4 — Menu SEO

metadata
intro/content
navigation
dish image/alt improvements
internal links

### PR 5 — Performance/accessibility

images
Core Web Vitals
semantic HTML
ARIA/accessibility

### PR 6 — Analytics

conversion events
Search/AI referral measurement

Adjust the PR structure if repository architecture indicates a better separation.

For each ticket provide:

* objective
* rationale
* files likely changed
* acceptance criteria
* tests
* SEO validation
* rollback/risk considerations

Keep PRs small and reviewable.

## Stage 13: Agent workflow

Design an efficient workflow for Codex and OpenCode.

Use separate roles where useful:

### Research/audit agent

Read-only.
Produces evidence and recommendations.
Does not modify code.

### Implementation agent

Receives one narrowly scoped ticket.
Makes code changes.

### Review agent

Does not trust the implementation agent.
Builds the project and inspects actual generated output.

The reviewer should validate at minimum:

* successful production build
* generated static files
* titles
* descriptions
* canonicals
* JSON-LD
* robots.txt
* sitemap.xml
* internal links
* no accidental `noindex`
* no broken routes
* mobile behavior
* accessibility regression
* structured-data validation

Require evidence rather than statements such as “SEO has been improved.”

## Stage 14: Prioritization

Score every recommendation on:

* expected SEO/local impact
* conversion impact
* implementation effort
* confidence/evidence
* dependency on owner information
* dependency on third-party access

Separate recommendations into:

### Do immediately

High confidence / high impact / low-to-medium effort.

### Do after factual research

Requires restaurant history, operational information, photography, etc.

### Ongoing

Reviews, local citations, PR, content maintenance, measurement.

### Experimental

AI-search experiments and other tactics without strong causal evidence.

## Required final deliverables

Return:

1. Executive summary
2. Current-state technical audit
3. Route/page audit
4. Local SEO audit
5. Competitive landscape
6. Search-intent/keyword architecture
7. Content/entity strategy
8. Structured-data plan
9. Google Business Profile plan
10. Reviews/citations/backlink/PR plan
11. AI/LLM/GEO analysis
12. Analytics/KPI plan
13. 30/60/90-day roadmap
14. Prioritized implementation backlog
15. Codex/OpenCode engineering tickets
16. Validation checklist
17. Owner-information questionnaire
18. Risks and anti-patterns to avoid
19. Sources with dates and links

Conclude with the **10 actions most likely to produce measurable restaurant revenue/search visibility improvement**, ranked in order.

Do not make code changes until the research report is complete.
