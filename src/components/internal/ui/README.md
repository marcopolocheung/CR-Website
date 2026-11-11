# Shared internal UI — Night shift v1.0

Authority: [approved bank](../../../../docs/design/internal-language/README.md),
[guidelines](../../../../docs/design/internal-language/guidelines.md),
[tokens](../../../../docs/design/internal-language/tokens.css) and the preserved
reference anatomy. Application implementation never edits that bank to match itself.

`InternalTheme` opts a subtree into scoped tokens and locally bundled Archivo /
Grenze. `next/font/local` reads the existing bank binaries and handles emitted
asset/base-path URLs and swap fallbacks. The adjacent bank OFL licenses/provenance
remain in the repository. No remote font request, new dependency or alternate study.

- `Button`: native button props plus `variant`, approved `icon`, and `busy`.
  Busy/disabled use native disabled semantics. Supply meaningful children for every
  state; a busy icon alone is not a translated progress label.
- `IconButton`: requires a visible-purpose `label` for its accessible name/title;
  normal minimum target remains 48px.
- `Field`: native input props with required `id` and `label`; optional `hint` /
  `error` are linked through `aria-describedby`. Invalid input retains raw text,
  a persistent boundary and a warning icon. Validation and values belong to callers.
- `Paper`: labelled section; caller provides headings and `aria-labelledby`.
  `emphasis="active"` uses the approved layered offsets and registration tab;
  supporting panels have lighter weight.
- `Icon`: the bank's 20 symbols, 24×24 viewBox, 2-unit stroke. Decorative SVGs
  are hidden/unfocusable; actions supply their names. Seven existing scheduler
  concepts delegate here at their existing 16px size; other scheduler-only icons
  remain unchanged pending their own adoption slice.
- `MovingNavigation`: controlled `items`, `selectedId`, `onSelect`, `label`.
  Buttons retain labels and `aria-pressed` selection. Optional `items[].href` renders
  real anchors with `aria-current="page"`; callers resolve their base path and route. Hover/focus moves one red
  surface and never invokes selection; activation invokes the caller. Resize /
  font observers realign it; touch avoids pointer-hover persistence. This is a
  selector primitive. The Step 03 InternalShell adapter supplies route/hash links;
  neither primitive nor shell owns manager credentials or a global store selector.

Reuse existing behaviors:

- `Feedback.LabeledInput` delegates its existing translated-message API to `Field`.
  Its default remains `appearance="legacy"`; `appearance="paper"` opts into the bank.
- `Feedback.SaveFeedback` keeps its seven states and translated messages. Opt-in
  paper appearance adds icons/boundaries, while device/server/failure semantics
  still come from the caller's actual response. It never infers successful saving.
- `EntryWorkspace` keeps its native Tab/IME and Enter/Shift+Enter behavior, viewport
  handling, and finish-focus contract. `appearance="paper"` styles its summary.
- Existing confirmation behavior is reused; its paper anatomy is scoped by the theme.

Preview `/internal/ui-gallery` after a loopback-configured build. It is an unlinked,
noindex synthetic review fixture. Navigation, validation and completion are local
React state. No record, token, API or draft adapter is connected. The save-state
catalog is explicitly labelled as examples; the preview action says no record was
saved. Language uses the existing provider and preserves entered values. Real
record adoption and the navigation shell belong to later requested steps.

Verification: `scripts/test-internal-primitives.py` covers actual interactions,
geometry, keyboard/touch emulation, text reflow, color equivalence and print. Use
Step 01's loopback static server and external-request guard for regression scripts.
The Step 02 checkpoint records actual commands, results and device/live limitations.
