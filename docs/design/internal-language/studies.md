> Historical exploration notes. The approved bank is now [README.md](README.md) and [guidelines.md](guidelines.md). Earlier alternatives below are not current defaults.

# China Rose / Night shift / Surface studies 0.2

Open the [interactive reference](reference.html). **Night shift is the selected direction.** The current options explore depth and accent within that direction, rather than switching typography and overall identity.

**Latest preference:** Layered paper with Patina teal. The left workspace navigation now uses one red highlight that slides to the hovered item in 220ms and returns to the selected item on exit. It also follows keyboard focus, snaps into place when reduced motion is requested, and adapts to the phone grid. Hovering does not navigate; the white edge marker continues to identify the selected item.

The owner's latest feedback establishes plain task labels, more consistent icons, and stronger decorative framing. The greeting and motivational copy from 0.1 has been removed. White, black and the public website's red remain the foundation; a complementary accent is now explicitly authorized for exploration.

## Compare the depth treatments

Use the three Surface depth tabs in the HTML, then change the accent separately. The cash specimen keeps entered values when either setting changes.

| Treatment | How it addresses flatness | Tradeoff |
| --- | --- | --- |
| **Layered paper** | A dark backing, overlapping white sheets, registration tabs, hard offset edges and framed icon tiles | Most closely fits the printed character. Keep the offsets small and use the strongest layer for active work |
| **Recessed console** | Light work panels seated inside a dark frame; inset wells, bevels and directional control shadows | Strongest dark/light separation. More visually dense, especially for longer sessions |
| **Illuminated edges** | Raised white tiles, softer elevation shadows, accent edge strips and localized ambient light | More contemporary. Keep light around edges rather than across fields or numbers |

My starting recommendation is **Layered paper + Patina teal**. This retains the existing Night shift character and introduces visible surface hierarchy. Recessed console is the more substantial alternative; Illuminated edges is the cleaner, softer one.

Depth should come from a small hierarchy: **frame → work surface → control**. Giving every border and card the same treatment makes them compete. Dark gutters, white active surfaces, framed icons, edge highlights and brief press feedback make the hierarchy easier to see. Texture is confined to nonessential framing; field contents and tables stay clean and level.

New previews: [Layered paper](previews/depth-paper.png), [Recessed console](previews/depth-console.png), [Illuminated edges](previews/depth-signal.png), [phone cash](previews/depth-cash-phone.png). Earlier `night-desktop`, `service-desktop` and `ledger-desktop` images are retained as the superseded 0.1 studies.

## Accent studies

| Accent | Light color for dark surfaces | Dark companion for white surfaces | Character |
| --- | --- | --- | --- |
| **Patina teal** | `#7BC5BE` | `#1B6460` | Cool counterpoint to red; suits the printed, slightly weathered frame |
| **Ice blue** | `#A5C9F0` | `#245C83` | Clearer, more technical contrast |
| **Muted citron** | `#C2D677` | `#4F641C` | Brighter, more graphic; use sparingly |

All three are compositional alternatives; they are not interchangeable status colors. The accent identifies icon tiles, selected details and framing. Red remains the main action color in these specimens. Each light/dark pairing is calculated in the HTML so the light color is not mistakenly used as text on white.

The public [navigation](../../../src/components/Nav.tsx) uses `bg-red-800`. The installed Tailwind v4 value remains **`oklch(44.4% 0.177 26.899)`**, approximately `#9F0712`. No new red has been substituted. Normal white/red text contrast is approximately 8.37:1; white/`#171717` is approximately 17.93:1. Red on black remains unsuitable for ordinary labels.

## Content and icons

Use direct labels: Dashboard, Cash count, Inventory, Reports, Save, Print. Remove greetings, motivational statements and decorative instructions that do not explain the task or its state. Example data remains visibly identified as a demo.

The HTML contains one original inline SVG family on a **24×24 unit grid, 2-unit rounded strokes**. Navigation icons render at about 20px, action icons 18px and task icons 28–34px. Shared check, chevron, lock, print and warning shapes follow the existing scheduler's stroke grammar. Additional task icons cover cash, inventory, calendar, reports, forms and stores.

Icons support recognition; essential labels remain. Decorative SVGs are hidden from assistive technology and never receive focus. The shared symbol definitions are inline so opening the document directly from disk still works. The icon gallery is the reference for future additions; avoid mixing emoji, filled pictograms and unrelated outline libraries.

## Interaction and accessibility

The specimen retains 48px controls, visible focus, keyboard navigation for depth tabs, tabular money, input validation, explicit save scope, long-label wrapping and reduced-motion behavior. There are no automated production saves or shared restaurant records in this document.

Try Resume count, change a denomination, change the depth or accent, and use Preview save. The result explicitly states that no record was saved. The limited two-denomination example is not a complete cashier workflow.

The HTML shows measured contrast for accent-on-black and dark-accent-on-white. These pairs exceed 4.5:1. Color does not replace state wording, icons, field boundaries or focus. The larger 48px product control target exceeds WCAG 2.2 AA's 24px target-size minimum with exceptions. See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) and [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Component QA is not a full accessibility conformance claim.

## Reference files

| File | Purpose |
| --- | --- |
| [reference.html](reference.html) | Three depth treatments × three accents, icon gallery and interactive specimens |
| [tokens.css](tokens.css) | Brand foundation and exploratory accent pairs |
| [reference.css](reference.css) | Night shift anatomy, surface recipes, responsive layout and motion/focus states |
| [reference.js](reference.js) | Depth/accent selection, measured contrast and synthetic cash interactions |
| [verification.json](verification.json) | Current local browser observations, checked source hashes and scope |
| [references.json](references.json) | Original external-reference observations and limitations |
| [Font provenance](fonts/manifest.json) | Source hashes; [Grenze license](fonts/grenze-OFL.txt), [Archivo license](fonts/archivo-OFL.txt) |

For local HTTP preview: `python3 -m http.server 3038 --bind 127.0.0.1 --directory docs/design/internal-language`, then open `http://127.0.0.1:3038/reference.html`. Direct offline file opening is also supported. Optional initial parameters are `?depth=paper&accent=patina`, `?depth=console&accent=ice` and `?depth=signal&accent=citron`.

The [City Never Sleeps page](https://www.playdeadlock.com/cityneversleeps) and [Umbra reference](https://github.com/marcopolocheung/umbra/blob/main/docs/design/redesign-2.0/reference.html) remain the original framing/portfolio references. Their colors, assets and product instructions are not copied into this app. Previous source/runtime observations in `references.json` remain bounded historical evidence; the current changes were verified as local HTML/CSS/JS, not reverse engineered.

Future design work starts here. Carry forward the selected Night shift typography, plain labels and icon grammar. Treat the three surface recipes and accent pairs as options until a choice is made. This document revises the local design reference, not the production dashboard.
