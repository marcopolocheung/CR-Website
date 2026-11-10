# China Rose design bank: Night shift

**Approved baseline v1.0:** Night shift + Layered paper + Patina teal, with the moving red navigation highlight. Use this bank for future internal-tool design work.

## Start here

| Reference | Purpose |
| --- | --- |
| [Design guidelines](guidelines.md) | The actual rules: hierarchy, palette, typography, icons, motion, copy, accessibility and workflow patterns |
| [Interactive examples](reference.html?depth=paper&accent=patina) | Working component specimens, icon gallery, navigation and synthetic cash entry |
| [Desktop example](previews/depth-paper.png) | Approved layered-paper composition |
| [Phone example](previews/depth-cash-phone.png) | Narrow cash-entry composition |
| [Navigation example](previews/navigation-hover.png) | Red hover surface with a separate current-item marker |
| [Step-by-step implementation guide](../../internal-tools-overhaul/implementation-guide.md) | One bounded implementation step, checks and review at a time |

The examples and rules belong together. Match the visual hierarchy and interaction behavior while preserving the real tool's business rules. The specimen's synthetic data and Preview save action are demonstrations, not a complete cash workflow or a production save.

## Reusable source and provenance

- [tokens.css](tokens.css): exact public-site red, white/ink foundation, approved teal pair and supporting tokens.
- [reference.css](reference.css), [reference.js](reference.js): component anatomy, paper framing, responsive behavior and the 220ms navigation animation.
- [Font manifest](fonts/manifest.json), [Archivo license](fonts/archivo-OFL.txt), [Grenze license](fonts/grenze-OFL.txt): bundled fonts and provenance.
- [Approved baseline manifest](approved-baseline.json): selected examples and file hashes for this version.
- [Verification](verification.json): previous local browser observations tied to the unchanged specimen sources; no staff or full accessibility-conformance claim.
- [Original reference observations](references.json) and [historical studies](studies.md): inspiration, alternatives and earlier reasoning.

Alternative depths and accents remain selectable in the portfolio for comparison. They are historical studies; future tools default to the approved combination.

## Preview locally

From the repository root:

```sh
python3 -m http.server 3038 --bind 127.0.0.1 --directory docs/design/internal-language
```

Open `http://127.0.0.1:3038/reference.html?depth=paper&accent=patina`. Direct offline opening also works.

When revising the language, update the guidelines, examples and baseline manifest together. Preserve the prior approved version in version control or a dated archive, record the reason for the change, and verify affected interactions. Do not silently turn an implementation's deviations into new design rules.
