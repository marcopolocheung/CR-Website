# Night shift: approved design guidelines

Design-bank version **1.0**, approved in the owner conversation on November 10, 2026. Visual baseline: **Night shift + Layered paper + Patina teal**, including the moving red navigation highlight. These are the rules for new internal-tool designs. The public website supplies the brand red; this approval does not request a public-site redesign.

Start with the [interactive examples](reference.html), [selected desktop](previews/depth-paper.png), [phone cash example](previews/depth-cash-phone.png) and [navigation hover example](previews/navigation-hover.png). The examples show the approved visual language; their synthetic data and demonstration actions are not production feature implementations.

## 1. Authority and reuse

Use this document for design decisions, [tokens.css](tokens.css) for values, and [reference.html](reference.html), [reference.css](reference.css) and [reference.js](reference.js) for component anatomy and interaction examples. [approved-baseline.json](approved-baseline.json) identifies the accepted files and examples by digest.

Recessed console, Illuminated edges, Ice blue, Muted citron, Service board and Rose ledger are retained studies. Their presence in the portfolio does not make them approved alternatives for individual tools. Default future work to the selected combination; avoid a different theme per tool.

Changes to the design language should be deliberate: record what changed and why, update the examples and guidelines together, and retain the preceding approved baseline through version control or a dated archive. A product implementation should match the bank; do not quietly restyle the bank merely to match an implementation.

## 2. Visual hierarchy

Use three surface levels:

1. **Frame:** charcoal navigation, header and restrained decorative surround.
2. **Work surface:** a white paper panel above a neutral gutter. The active task receives the strongest paper-layer treatment.
3. **Control:** a clear field, action or icon tile inside that surface.

The approved paper recipe uses square edges, thin dark rules, small registration tabs and short hard offset shadows. Supporting cards receive a lighter treatment than the active sheet. Do not put the same heavy border and shadow around every nested element.

The reference's active sheet uses `4px 4px 0 white`, `5px 5px 0 #555`, and `9px 9px 0 #b4b4b4`; supporting task tiles use a smaller `2px 3px` shadow. These establish relative weight. Adapt offsets to available space without clipping content or causing horizontal page scroll.

Keep grain and registration marks within nonessential framing. Data, input backgrounds, tables, errors and money remain clean, level and still. No glass panels, ambient glow or tilted controls in this baseline. Texture is decoration, never a required boundary or status.

## 3. Palette and meaning

| Role | Token / value | Use |
| --- | --- | --- |
| Paper | `--cr-white: #fff` | Main work panels and readable surfaces |
| Ink / frame | `--cr-black: #171717` | Text, mastheads and strong structure |
| Brand / primary action | `--cr-red: oklch(44.4% 0.177 26.899)` | Existing public-site `red-800`; approximately `#9f0712` in sRGB |
| Accent on dark | `--cr-accent: #7bc5be` | Icon details, small framing marks, dark-surface emphasis |
| Accent ink on light | `--cr-accent-ink: #1b6460` | Teal icons/text/boundaries on paper |
| Accent wash | `--cr-accent-wash: #eaf4f1` | Quiet icon wells and selected summary areas |
| Secondary text | `--cr-muted: #525252` | Supporting information on white |
| Control boundary | `--cr-control: #737373` | Identifiable input edges on white |
| Decorative rule | `--cr-line: #d4d4d4` | Nonessential separation; not the sole field boundary |

Use light teal on dark surfaces and its dark companion on white. Approximate contrast: white/red **8.37:1**; white/ink **17.93:1**; light teal/ink **9.03:1**; dark teal/white **6.91:1**. Red on black is about **2.14:1** and is unsuitable for required text or boundaries. Check actual state pairs after composing the component; approved swatches alone do not prove an entire screen accessible.

Red identifies the main action and the navigation highlight. Errors also need a persistent boundary, an icon and an actionable message; never rely on red alone to distinguish them. Saved, draft and review states use consistent icons and words. Teal is an accent, not a claim that a record saved successfully.

Charts can use the existing red/teal/ink vocabulary with labels, line styles or patterns and an accessible table. If a chart needs more categories, choose a better grouping or document a specific extension rather than silently adding a rainbow palette.

## 4. Typography, spacing and controls

- **Display:** locally bundled Grenze, usually weight 650–700, for page/section names. Use the clean working face inside fields and dense tables.
- **Working text:** locally bundled Archivo, weight 400–600, ordinarily 16–18px with line height around 1.55. Secondary metadata may be smaller when readable; never shrink meaningful labels to hide layout problems.
- **Money/counts:** Archivo with tabular figures; right-align comparable columns. Preserve currency, units and signs.
- **Titles:** the reference uses a 62px desktop masthead and 48px narrow title, with a more compact 46/40px cash title. These are an upper expressive treatment, not a requirement to place a large banner above every form section. Reduce title footprint when entry space matters.
- **Targets:** 48px default control height; 44px minimum product target for frequent touch and icon actions. Long labels may wrap and make the control taller.
- **Spacing:** use the existing 4px-based scale, commonly 8/12/16/24/32px. Group related information before adding a border.
- **Geometry:** mostly square paper/control edges. Reserve circles for framed emblems and tightly defined status/icon uses; avoid unrelated pill and card styles.

Keep the local font files and their licenses. Use fallbacks so slow or unavailable font loading does not hide the task.

## 5. Icon grammar

Use the inline SVG family in the reference: **24×24 viewBox, 2-unit stroke, rounded caps and joins**. Navigation icons normally render around 20px, action icons around 18px, task tiles 28–34px. Reuse the same icon for the same concept everywhere.

| Concept | Reference symbol |
| --- | --- |
| Dashboard | `i-home` |
| Cash | `i-cash` |
| Inventory | `i-inventory` |
| Schedule/date | `i-calendar` |
| Reports | `i-report` |
| Forms | `i-form` |
| Store | `i-store` |
| Draft/time | `i-clock` |
| Saved/completed | `i-check` |
| Needs review | `i-warning` |
| Failed/remove | `i-close` |
| Print / Lock / Options | `i-print` / `i-lock` / `i-settings` |

Pair icons with labels for navigation and consequential actions. Icon-only controls need an accessible name and the same usable target area. Decorative SVGs use `aria-hidden="true"` and `focusable="false"`. Do not mix this family with emoji or unrelated filled/outline libraries. Add a missing icon in the same grammar and show it in the bank before spreading it across tools.

## 6. Navigation and motion

The approved navigation uses **one red surface** behind the items, moving toward the hovered item. It returns to the selected item after pointer exit, follows keyboard focus and does not navigate on hover. A separate white edge marker continues to identify the selected item while the red surface is elsewhere.

Match the demonstrated **220ms** transition with `cubic-bezier(.22, 1, .36, 1)`. Retarget the same surface during fast pointer movements instead of flashing separate red backgrounds. Recalculate its geometry after reflow; the phone grid must align just as the desktop rail does. Touch selection must not leave a phantom hover state.

Use visible focus independent of the moving surface. The work area demonstrates a 3px white outline with a black separation ring; other surfaces use an equally clear contrasting outline. Reduced-motion preference removes the slide and any press translation while retaining the final state and focus indicator.

Other motion stays brief and functional: approximately 120ms press feedback and 180ms settling transitions. No looping decoration, page parallax, bouncing controls, forced celebration delays or moving numbers. Do not expand the animation vocabulary merely because one interaction is approved.

## 7. Content and task structure

Use names and actions: **Dashboard, Cash count, Inventory, Reports, Save count, Publish schedule**. No greetings, motivational copy, atmospheric narration or decorative instruction lines in working screens. Help appears when it explains an unfamiliar field, consequence or problem.

Show store/station/date context once in a stable place. Avoid repeating page and section descriptions around every card. Keep one obvious main action per task region, plus quieter secondary controls. Place configuration, raw source details and occasional recovery exports in clearly named secondary views.

The bank's three workspace patterns are:

| Pattern | Applied to | Essential anatomy |
| --- | --- | --- |
| Focused entry | Cash, inventory | Visible context, aligned rows, live summary, save state, reachable finish action |
| Staged review | Imports, forms | Meaningful stages, preserved input, actionable issues, check-answers summary, explicit output/save result |
| Planning board | Scheduler | Week/station context, board, selected-item or next-fix panel, independent validation, publication state |

Use the layout that serves the task. Do not turn every denomination into a page, every action into a wizard, or every datum into a card.

## 8. State, context and data safety

Design states as part of each component: empty, loading, dirty, device-protected, saving, server-saved, failed, conflict and read-only where applicable. Never show success from an absent or failed response.

Use explicit scope: **Draft on this device**, **Saved**, **Download started**, **Published to staff**. Only assert the scope that actually succeeded. Preserve entered values after errors and interrupted access. Keep retries specific to the same record/context and handle existing service conflicts through the established recovery flow.

The synthetic reference is not the app's financial engine, persistence layer or complete cash workflow. Production implementations reuse existing domain calculations, records, validation and authorization. Keep business rules in their approved contracts, including the fixed $100 retained per cash drawer and current-main Extra money behavior.

English/Spanish switch the same record without losing data or position. Preserve entered names and narratives. Use existing business-date rules, readable dates, explicit units and USD amounts. Screen translation does not automatically authorize changing official printed form text.

## 9. Responsive and print behavior

Reflow the layout at narrow widths; do not scale a poster down. Navigation can become a labeled grid or compact task navigation. White work surfaces keep readable row labels and input sizes. The sample's mobile nav geometry is an example, not a reason to cram every future destination into it.

Keep focused inputs visible above or below sticky elements and the real software keyboard. Isolate genuinely two-dimensional boards/evidence tables in bounded scroll regions; ordinary pages should not scroll sideways. Check long Spanish labels, large money amounts and enlarged text.

Printed forms preserve required content, arithmetic and readable pagination; paper output does not force the on-screen editor to reproduce the paper's cramped layout. Hide navigation, controls and decorative framing in print. Avoid depending on background-color printing to communicate a value or state.

## 10. Review checklist

- [ ] Matches Layered paper + Patina teal; alternate studies have not become defaults.
- [ ] Reuses shared tokens, typography, icon family and component anatomy.
- [ ] Gives the active work surface stronger hierarchy than supporting content.
- [ ] Uses direct task labels; every visible helper sentence earns its place.
- [ ] Shows correct context, one main action, and a truthful save/output state.
- [ ] Works with pointer, touch and keyboard; focus remains visible.
- [ ] Navigation moves one red highlight, restores selection and respects reduced motion.
- [ ] No meaningful label, error, amount or action clips at narrow width or enlarged text.
- [ ] English/Spanish changes preserve work; paper output remains usable where applicable.
- [ ] Existing calculations, record identities, validation and access boundaries remain correct.

For an overhaul slice, use the [step-by-step implementation guide](../../internal-tools-overhaul/implementation-guide.md) and record the relevant evidence at its checkpoint. A matching screenshot is design evidence, not proof that saving, server activation or staff use works.
