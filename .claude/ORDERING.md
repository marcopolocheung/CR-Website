# Product Requirements Document — In-House QR Code Ordering

**Project:** China Rose — Dine-In Digital Ordering  
**Version:** 1.0  
**Date:** March 3, 2026  
**Author:** Project Engineering  
**Status:** Draft

---

## 1. Executive Summary

This PRD defines a new **dine-in digital ordering** feature for the China Rose website. Customers seated at either restaurant location will scan a table-specific QR code, browse the existing menu, build a cart, and submit their order. The feature is intended **exclusively for in-house use** — it will not be exposed in the public site navigation or accessible through normal browsing flows.

The initial release (Phase 1) covers the full customer-facing ordering flow through cart submission. Integration with a kitchen display system (KDS) or printer is explicitly **out of scope** for Phase 1 and will be addressed in a future iteration.

---

## 2. Goals & Success Criteria

### Business Goals

- Reduce front-of-house labor by enabling self-service ordering at the table.
- Decrease order error rates by having customers enter items directly.
- Increase average ticket size through visible upsell/add-on opportunities in the cart.
- Lay the groundwork for a fully digital dine-in pipeline (ordering → kitchen → payment).

### Success Criteria (Phase 1)

- A customer can scan a QR code, browse the full menu, add items to a cart, and submit an order — all within 90 seconds for a typical 3-item order.
- Cart state persists through page navigation and accidental browser refresh.
- Staff can identify which table an order came from by the information attached to the submission.
- Zero disruption to the existing public website (menu page, location pages, etc.).

---

## 3. User Stories

| ID | Role | Story | Acceptance Criteria |
|----|------|-------|---------------------|
| US-1 | Dine-in customer | I scan a QR code at my table so I can view the menu on my phone. | QR code opens the ordering page with the correct location and table pre-populated. |
| US-2 | Dine-in customer | I browse categories and items so I can decide what to order. | All menu categories, sections, and items from `menu.json` are displayed with prices and images. |
| US-3 | Dine-in customer | I add items to my cart and adjust quantities so I can build my order. | Items can be added, removed, and quantity-adjusted. Cart total updates in real time. |
| US-4 | Dine-in customer | I review my full cart before submitting so I can catch mistakes. | A cart review screen shows all items, quantities, per-item subtotals, and the grand total. |
| US-5 | Dine-in customer | I submit my order so the kitchen can prepare it. | A confirmation screen is shown. The order payload (items, table, location, timestamp) is captured. |
| US-6 | Dine-in customer | I want to continue adding items after submitting so I can order more later. | After submission, the cart resets and the customer can start a new order from the same session. |
| US-7 | Restaurant staff | I need to know which table placed each order so I can deliver the food. | Every submitted order includes the location identifier and table number. |

---

## 4. Feature Scope

### 4.1 In Scope (Phase 1)

1. **QR Code Entry Point** — Each table at each location gets a unique QR code. The QR encodes a URL containing query parameters for `location` and `table`.
2. **Order Menu Page** — A new route (`/order`) that renders the existing menu data with "Add to Cart" controls on every item. This page is **not linked** from the public navbar or footer.
3. **Cart System** — A persistent, client-side cart (React state + `sessionStorage`) with add, remove, and quantity-adjust capabilities.
4. **Cart Drawer / Panel** — A slide-out or bottom-sheet panel showing the current cart contents, accessible from a floating cart icon with a badge count.
5. **Order Review & Submit** — A dedicated review step showing the full order summary. On submit, the order payload is captured client-side (logged to console and optionally stored in `localStorage` for staff retrieval).
6. **Order Confirmation** — A simple confirmation screen with an order number (client-generated), timestamp, and a "Start New Order" action.
7. **QR Code Generation Utility** — A simple script or internal tool page (`/internal/qr-generator`) that generates printable QR codes for each location + table combination.

### 4.2 Out of Scope (Phase 1)

- Kitchen Display System (KDS) integration or order transmission to any backend.
- Payment processing (handled at the register as usual).
- Item customization or special instructions (e.g., "no onions").
- Customer authentication or order history.
- Push notifications or real-time order status tracking.
- Tipping or gratuity.
- Integration with Toast or Uber Eats ordering systems.

---

## 5. Technical Design

### 5.1 Route Structure

| Route | File | Description |
|-------|------|-------------|
| `/order` | `src/app/order/page.tsx` | Main ordering page — menu + cart functionality |
| `/order/review` | `src/app/order/review/page.tsx` | Order review and submission |
| `/order/confirmation` | `src/app/order/confirmation/page.tsx` | Post-submission confirmation |
| `/internal/qr-generator` | `src/app/internal/qr-generator/page.tsx` | Staff-only QR code generation tool |

### 5.2 URL Schema for QR Codes

```
https://<domain>/order?location=w-military&table=7
https://<domain>/order?location=sw-military&table=12
```

**Parameters:**

- `location` — One of `w-military` or `sw-military`. Maps to the existing location data.
- `table` — Integer representing the table number. Used for display and order tagging only.

If either parameter is missing or invalid, the page should display a friendly error prompting the customer to ask staff for assistance.

### 5.3 New Components

| Component | Type | Responsibility |
|-----------|------|----------------|
| `OrderMenuPage.tsx` | Client | Renders menu data with add-to-cart buttons; reads URL params |
| `CartProvider.tsx` | Client (Context) | React Context providing cart state and actions to the component tree |
| `CartDrawer.tsx` | Client | Slide-out panel showing cart contents; item quantity controls |
| `CartIcon.tsx` | Client | Floating action button with item-count badge |
| `OrderReview.tsx` | Client | Full-page order summary with submit action |
| `OrderConfirmation.tsx` | Client | Confirmation display with order ID and timestamp |
| `MenuItemCard.tsx` | Client | Individual menu item with image, name, price, and add-to-cart button |
| `QRGenerator.tsx` | Client | Internal tool to produce QR code images per table/location |

### 5.4 Cart State Management

**Data Model:**

```typescript
interface CartItem {
  id: string;            // Unique key derived from item name + category
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;        // CDN URL from menu.json
}

interface CartState {
  location: string;      // "w-military" | "sw-military"
  table: number;
  items: CartItem[];
  createdAt: string;     // ISO timestamp of first item added
}
```

**Persistence strategy:** Cart state is managed via React Context (`useReducer`) and mirrored to `sessionStorage` on every update. This ensures the cart survives accidental page refreshes but does not persist across browser sessions (a fresh scan starts a fresh cart).

**Cart Actions:**

- `ADD_ITEM` — Adds item or increments quantity if already in cart.
- `REMOVE_ITEM` — Removes item entirely.
- `UPDATE_QUANTITY` — Sets item to specific quantity; removes if quantity is 0.
- `CLEAR_CART` — Empties cart (used post-submission).

### 5.5 Order Submission Payload

```typescript
interface OrderPayload {
  orderId: string;        // Client-generated (e.g., "CR3-T07-1709487600")
  location: string;
  table: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  total: number;
  submittedAt: string;    // ISO 8601
}
```

**Phase 1 handling:** On submit, the payload is:

1. Logged to `console.log` for debugging.
2. Stored in `localStorage` under a key like `orders:<orderId>` so staff can retrieve recent orders from a browser's dev tools or a simple internal viewer if needed.

**Phase 2 handling (future):** POST to an API route or WebSocket that forwards to a KDS.

### 5.6 QR Code Generation

Use a client-side QR library (e.g., `qrcode.react` or `qrcode` npm package) to render QR codes on the internal page. Staff inputs the location and a table number range, and the page generates a printable grid of QR codes with labels (e.g., "Table 7 — W Military Dr").

Each QR code encodes the full order URL with the appropriate query parameters.

---

## 6. UX & Interface Design

### 6.1 Order Menu Page (`/order`)

**Header bar:** Shows the China Rose logo, location name (e.g., "W Military Dr"), and table number (e.g., "Table 7"). No navigation links to the public site.

**Category quick-nav:** Horizontal scrollable pill buttons matching the existing menu page categories. Tapping a category smooth-scrolls to that section.

**Menu item cards:** Each card displays the item image (from CDN), item name, price, and an "Add" button. After adding, the button transforms into a quantity stepper (– / count / +).

**Floating cart button:** Fixed to the bottom-right corner. Shows a red badge with the total item count. Tapping opens the Cart Drawer.

### 6.2 Cart Drawer

Slides in from the right (or rises from the bottom on mobile). Contains:

- List of cart items with name, unit price, quantity stepper, and line subtotal.
- A "Remove" action per item.
- Order total at the bottom.
- "Review Order" primary button.
- "Continue Browsing" secondary action that closes the drawer.

### 6.3 Order Review Page (`/order/review`)

Full-screen summary showing:

- Location and table number.
- Itemized list (name, quantity, unit price, subtotal per line).
- Grand total.
- "Submit Order" primary button (red-800, prominent).
- "Back to Menu" link.

On submit, a brief loading spinner appears, then redirects to confirmation.

### 6.4 Order Confirmation Page (`/order/confirmation`)

Displays:

- A checkmark icon and "Order Submitted!" heading.
- Order ID.
- Timestamp.
- Brief message: "Your order has been received. A server will bring your food to Table [X]."
- "Place Another Order" button that clears the cart and returns to `/order` with the same location and table parameters.

### 6.5 Design Tokens

All styling should follow the existing brand system:

- Primary background: `bg-red-800` / `bg-red-900`
- Accent text: `text-yellow-300`
- Card backgrounds: white with subtle shadow
- Buttons: red-800 primary, dark gray secondary
- Typography: existing Tailwind defaults used throughout the site
- Mobile-first, responsive via `md:` breakpoints

---

## 7. Menu Data Integration

The ordering page consumes the same `src/data/menu.json` file already used by the public `/menu` page. No duplication of data.

**Key considerations:**

- Item prices must be present in `menu.json`. If any items currently lack prices, they should be excluded from the ordering view or shown as "Market Price" with no add-to-cart option.
- Item images continue to load from the CloudFront CDN (`d1w7312wesee68.cloudfront.net`).
- If a category or item needs to be marked as unavailable (e.g., sold out), a future enhancement could add an `available: boolean` field to `menu.json`. For Phase 1, all items in the JSON are assumed available.

---

## 8. QR Code Deployment Plan

### Physical Setup

1. Determine the table count at each location (coordinate with owner).
2. Generate QR codes via the internal tool for every table at both locations.
3. Print QR codes on laminated table cards or stickers. Each card should include:
   - The QR code itself.
   - "Scan to Order" instructional text.
   - The China Rose logo.
   - A fallback short URL for manual entry (e.g., `chinarose.com/order?location=w-military&table=7`).

### Maintenance

- If tables are added or renumbered, regenerate and reprint affected QR codes.
- QR codes should be periodically checked to ensure they scan correctly (worn or damaged codes should be replaced).

---

## 9. Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing or invalid `location` param | Show error: "We couldn't identify your location. Please ask a staff member for help." |
| Missing or invalid `table` param | Show error: "We couldn't identify your table. Please ask a staff member for help." |
| Empty cart on "Review Order" | Disable the review button; show tooltip "Add items to your cart first." |
| Browser refresh during ordering | Cart restored from `sessionStorage`. Location and table re-read from URL params. |
| `sessionStorage` unavailable (private browsing edge cases) | Fall back to in-memory React state only. Cart will not survive refresh. |
| Extremely large order (>50 items) | Allow it — no artificial cap. The review page should scroll gracefully. |
| Duplicate browser tabs | Each tab maintains its own `sessionStorage` context. No conflict. |
| QR scanned outside restaurant | The page loads normally. Since there is no backend validation of physical presence, this is accepted for Phase 1. |

---

## 10. Analytics & Observability (Phase 1 — Minimal)

Since the site is a static export with no backend, analytics options are limited. Recommended lightweight approaches:

- **Client-side event logging:** Track key events (page load, item added, order submitted) via `console.log` structured entries. These can be wired into a real analytics provider in Phase 2.
- **Order count:** Maintain a running count in `localStorage` (`orderCount:<location>`) for a rough daily tally that staff can check.

---

## 11. Security & Privacy Considerations

- No personal data is collected from the customer. No login, no name, no phone number, no payment info.
- Orders are identified only by location, table number, and timestamp.
- The `/order` route is unlisted but not authenticated. It is security-through-obscurity only. This is acceptable for Phase 1 since no sensitive operations occur, but should be revisited if payment or PII enters the flow.
- The `/internal/qr-generator` page should include a simple disclaimer ("Internal use only") but does not require authentication in Phase 1.

---

## 12. Accessibility

- All interactive elements (buttons, quantity steppers) must be keyboard-navigable and have appropriate `aria-labels`.
- Cart badge count must be announced to screen readers via `aria-live="polite"`.
- Color contrast must meet WCAG 2.1 AA standards (the existing red-800 on white palette satisfies this).
- "Add to Cart" buttons should include the item name in their accessible label (e.g., `aria-label="Add Kung Pao Chicken to cart"`).
- The cart drawer should trap focus when open and return focus to the trigger button on close.

---

## 13. Performance Requirements

- The ordering page must reach Largest Contentful Paint (LCP) under 2.5 seconds on a 4G mobile connection.
- Menu item images should be lazy-loaded below the fold.
- Cart state updates must feel instantaneous — no perceptible delay on add/remove actions.
- The total bundle size added by the ordering feature should not exceed 50 KB gzipped (excluding shared dependencies already in the main bundle).

---

## 14. Testing Strategy

| Layer | Approach |
|-------|----------|
| Unit | Test cart reducer logic: add, remove, update quantity, clear. Verify total calculation, edge cases (zero quantity, duplicate adds). |
| Component | Test `MenuItemCard` renders correctly with and without images. Test `CartDrawer` opens/closes and reflects cart state. Test URL param parsing and error states. |
| Integration | Full flow: scan URL → browse → add items → review → submit → confirmation. Verify `sessionStorage` persistence across refresh. |
| Manual / QA | Test on physical devices (iPhone Safari, Android Chrome) by scanning actual QR codes. Verify usability with one hand while seated. |

---

## 15. Rollout Plan

| Phase | Milestone | Description |
|-------|-----------|-------------|
| Phase 1a | Development | Build all components, routes, and cart logic. |
| Phase 1b | Internal testing | Staff tests at both locations with printed QR codes. Collect feedback on flow and usability. |
| Phase 1c | Soft launch | Deploy to one location only (W Military Dr). Staff manually relays submitted orders to kitchen. |
| Phase 1d | Full launch | Roll out to both locations after confirming the workflow. |
| Phase 2 | Kitchen integration | Connect order submissions to a backend service that pushes orders to a KDS, tablet, or printer. |
| Phase 3 | Enhancements | Item customization, special instructions, order status tracking, and optional payment integration. |

---

## 16. Open Questions

1. **Table counts** — How many tables does each location have? Needed to generate the correct QR code set.
2. **Item availability** — Is there a need to mark items as sold out during service? If so, how should staff toggle availability?
3. **Order relay (Phase 1)** — During Phase 1 (no KDS), how will staff monitor submitted orders? Options include a dedicated tablet with the browser console open, or a simple internal "order viewer" page that reads from `localStorage`.
4. **Tax display** — Should the cart total include estimated tax, or just the item subtotal?
5. **Combo meals / set menus** — Are there bundled items that need special pricing logic, or is everything priced individually?
6. **Multi-language** — Should the ordering interface support Spanish alongside English from launch?

---

## 17. Dependencies & Assumptions

**Dependencies:**

- Existing `menu.json` data must include accurate prices for all items.
- A QR code npm package (e.g., `qrcode.react`) must be added to the project.
- Menu item images on CloudFront must remain available and performant.

**Assumptions:**

- Customers have smartphones with camera and a modern browser (Safari 15+, Chrome 90+).
- The restaurant has adequate Wi-Fi or cellular coverage for customers to load the page.
- Staff will handle payment at the register as they do today — this feature does not change the payment flow.
- The static export deployment model (GitHub Pages) remains sufficient; no server-side rendering is required for this feature.

---

*End of document.*