# China Rose SEO Strategy

Last updated: 2026-08-22

## Goals

Optimize the site for business outcomes, not vanity traffic:

- Pickup orders
- Delivery orders
- Phone calls
- Directions
- Menu views
- Branded and local discovery

The website should remain a fast restaurant landing page for two San Antonio, TX locations.

## Current Approach

- Use the canonical production host: `https://chinarosesa.com`.
- Keep indexable public pages limited to useful customer pages: homepage, menu, location pages, and careers.
- Keep internal/order utility pages out of the index unless the order flow becomes a public customer experience again.
- Use structured data only when it matches visible page facts.
- Prefer concise factual copy over SEO filler.

## Page Strategy

Homepage:

- Clarify that China Rose is a two-location Chinese restaurant in San Antonio.
- Keep location choice and order paths prominent.
- Add brand/entity structured data that connects to the two location pages.

Location pages:

- Publish address, phone, hours, services, menu link, pickup link, delivery link, and directions.
- Add `Restaurant` JSON-LD that matches visible location facts.
- Avoid neighborhood, landmark, parking, or access claims until verified.

Menu page:

- Keep menu content crawlable in HTML.
- Use natural metadata and headings for China Rose menu searches.
- Link clearly to both locations and ordering paths.
- Do not invent ingredients, dish descriptions, or popularity claims.

Internal/order pages:

- Use `noindex` for `/order`, `/order/review`, `/order/confirmation`, and `/internal/qr-generator` while they are not intended search landing pages.

## Structured Data Rules

Allowed when facts are visible and verified:

- `Organization`
- `WebSite`
- `Restaurant`
- `BreadcrumbList`
- `ItemList`

Do not add:

- Review or aggregate rating schema unless reviews are collected and displayed on the website in compliance with Google policies.
- Founder, founding date, awards, signature dishes, or ownership claims unless owner-confirmed and visible.
- Special AI/LLM schema or `llms.txt` solely for AI SEO.

## Validation

For SEO changes:

- Run `npm run build`.
- Inspect generated files in `out/`.
- Verify title, description, canonical, robots directives, structured data, sitemap inclusion, internal links, and indexability as applicable.
- Run `npm run seo:check`.
