# China Rose Website

## Project Overview

A unified, brand-focused website for China Rose restaurant (San Antonio, TX) with two locations. Primary goal: drive Pick-Up orders via Toast (higher-margin). Secondary: Delivery via Uber Eats.

---

## Tech Stack

- **Next.js 16** (App Router, static export via `output: 'export'`)
- **React 19**, **TypeScript 5**
- **Tailwind CSS v4** (`@import "tailwindcss"` in globals.css, `@tailwindcss/postcss` plugin)
- No backend — job application form currently logs to console only
- Deployed as static site (GitHub Pages), base path controlled via `NEXT_PUBLIC_BASE_PATH`

---

## Site Architecture

### Navigation
- Home
- Locations → W Military Dr / SW Military Dr
- Menu
- Careers

### Pages & Routes
| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Hero + two location cards |
| `/locations/w-military` | `src/app/locations/w-military/page.tsx` | W Military location detail |
| `/locations/sw-military` | `src/app/locations/sw-military/page.tsx` | SW Military location detail |
| `/menu` | `src/app/menu/page.tsx` | Digital menu with category filtering |
| `/careers` | `src/app/careers/page.tsx` | Job application form |

---

## Location Data

**CR3 – W Military Dr**
- Address: 7046 W Military Dr, San Antonio, TX 78227
- Phone: (210) 675-3226
- Toast: https://order.toasttab.com/online/china-rose-w-military-7046-w-military-dr
- Uber Eats: https://www.order.store/store/china-rose-7046-military/FrlPQ762VI6wc3eQe4ThOQ
- Map image: `public/imgs/WMilitaryLocation.png`

**CR2 – SW Military Dr**
- Address: 2535 SW Military Dr, San Antonio, TX 78224
- Phone: (210) 927-7339
- Toast: https://order.toasttab.com/online/china-rose-sw-military-2535-sw-military-dr
- Uber Eats: https://www.order.store/store/china-rose-sw-military/GYiGnH3mQSSS1iKIi2uHjw
- Map image: `public/imgs/SWMilitaryLocation.png`

Store hours (hardcoded — **not yet confirmed with owner**):
- Mon–Thu: 10:30 AM – 9:30 PM
- Fri–Sat: 10:30 AM – 10:00 PM
- Sun: 11:00 AM – 9:30 PM

---

## File Structure

```
src/
  app/
    layout.tsx                  Root layout (Nav + Footer)
    page.tsx                    Homepage
    globals.css                 @import "tailwindcss" only
    locations/
      w-military/page.tsx
      sw-military/page.tsx
    menu/page.tsx               Digital menu (imports menu.json)
    careers/page.tsx
  components/
    Nav.tsx                     Client component – responsive navbar with dropdown
    Footer.tsx                  3-column footer, dynamic copyright year
    LocationCard.tsx            Homepage location card (address, phone, order buttons)
    LocationPageContent.tsx     Shared layout for both location detail pages
    JobApplicationForm.tsx      Client component – full multi-section form
  data/
    menu.json                   Menu data (categories → sections → items)
public/
  imgs/
    crbanner.webp               Hero banner
    menu1.jpg / menu2.jpg / menu3.jpg   Menu images (shown on location pages)
    WMilitaryLocation.png       Static map image
    SWMilitaryLocation.png      Static map image
```

---

## Key Implementation Details

### Menu
- `src/data/menu.json` — structured as `Category[]` with sections and items
- Menu item images hosted on CloudFront CDN (`d1w7312wesee68.cloudfront.net`)
- Menu page has quick-nav buttons and smooth-scroll anchors per category
- 2-column grid on mobile, more on larger screens

### Location Pages
- Both use shared `LocationPageContent` component
- Mobile layout: order buttons above menu images
- Desktop layout: menu images (scrollable) on left, order buttons sticky on right
- Maps are static PNGs (not embedded Google Maps)

### Job Application Form (`JobApplicationForm.tsx`)
- All 7 sections from PRD implemented:
  1. Basic Information
  2. Job Interest (includes preferred location, referral, prior employment)
  3. Eligibility (age, work authorization)
  4. Education History (up to 3 institutions)
  5. Work History (up to 3 employers)
  6. Military Service (optional, conditional fields)
  7. Legal Disclosure (felony conviction, EEO statement)
- Resume upload (PDF or image, max 10 MB; accepts PDF/JPEG/PNG/WEBP/GIF/HEIC)
- Conditional rendering for relatives, prior employment, military, felony fields
- **Currently**: submits via `console.log` only — no email backend

### Colors & Styling
- Primary: `bg-red-800` / `bg-red-900`
- Accent: `text-yellow-300`
- Secondary buttons: dark gray
- All responsive via Tailwind `md:` breakpoints, mobile-first

---

## What's Not Yet Done

- [ ] Wire form submissions to email service (e.g. Resend/Nodemailer API route)
- [ ] Add reCAPTCHA/spam protection to form
- [ ] Replace static map PNGs with embedded Google Maps (needs API key)
- [ ] Confirm actual store hours with owner
- [ ] Add real food photography
- [ ] Deploy to production (Vercel or custom domain)

---

## Goals & Compliance Notes

- Pick-Up (Toast) always visually prioritized over Delivery (Uber Eats)
- Form must NOT collect SSN, Alien Registration Number, or Work Permit Numbers
- No pre-offer medical inquiries
- EEO statement included at bottom of job application form
- ADA: click-to-call `tel:` links, labeled form inputs, alt text on images

---

## Out of Scope (Phase 1)

- Loyalty program
- Online payment processing (handled by Toast / Uber Eats)
- Customer accounts
- Analytics dashboard

## Future (Phase 2+)

- Catering inquiry form
- Promotions page
- Photo gallery
- Reviews integration
- Multi-language support
