# The internal design language

Every internal page (`/internal/**` and the scheduler) follows this. If a page breaks a rule, the page is wrong, not the rule. Change the rule here first if it's genuinely wrong.

The test for every screen: **could a new shift lead, on a phone, with flour on their hands, finish the job without asking anyone?**

## 1. Principles (in priority order)

1. **Never lose work.** Drafts survive a reload, a closed tab, and a dead battery. Saving is obvious and its state is always visible. Nothing permanent happens without a clear, named confirmation or an Undo.
2. **Say what needs doing.** Each screen leads with the one job it's for and the one main button. Problems are listed in words, at the top, with a link to the fix.
3. **Look like the paper.** Where a paper sheet exists (inventory clipboard, write-up form, cash difference record), keep its row order, names, and spellings so staff recognize it. Improve the *behavior*, not the layout.
4. **Plain words.** Use the words staff say out loud. Never "token", "rev", "sync", "KV", "persist", "payload", "invalid".
5. **Same thing, same look, same place.** A save button looks the same and sits in the same spot on every page.
6. **Phone first, desktop better.** Every task works on a phone held in one hand. Wide screens get more columns, not different features.

## 2. Words

| Say | Don't say |
|---|---|
| Manager code | token, password, write token |
| Save / Saved / Not saved yet | persist, sync, commit, store |
| Cash out | reconciliation |
| Over / Short ($ amount, with the sign spelled out: "Short $4.25") | variance, delta, negative numbers alone |
| Count, Use, Order | quantity on hand, par level (OK in docs, not on screen; the sheet says "Use") |
| Publish (schedule goes to staff) / Hide | deploy, set visible |
| Someone else saved this while you were working | 409 conflict |
| Couldn't reach the server. Your work is still here. Try again. | Network error / Failed to fetch |

Rules:

- **Buttons are verb + thing:** "Save count", "Publish week", "Add cashier", "Copy order list". Never "OK", "Submit", "Yes".
- **Sentence case** everywhere (not ALL CAPS, not Title Case). Exception: text copied from a paper form keeps the form's casing.
- **Money:** always `$1,234.56`, tabular figures, right-aligned in tables. Short amounts read as "Short $4.25" in red with a ▼ icon; over as "Over $1.10". A blank stays "—", never "$0.00", when a figure hasn't been entered (cash out already does this: keep it).
- **Dates:** "Mon, Oct 20" on screen; ISO `2026-10-20` only in storage and file names. "Today" and "Yesterday" where they apply.
- **Stores:** "CR3 · W Military" and "CR2 · SW Military", the same everywhere (`STORE_LABELS` lives in two components today; move it to one place).

## 3. Color

Brand red stays for the logo and the header stripe. **It isn't the color of the main button.** Red means "problem" or "delete". When the main button is also red, real problems stop standing out.

| Role | Tailwind | Use for |
|---|---|---|
| Ink | `text-zinc-900` | Body text, values |
| Muted ink | `text-zinc-600` | Hints, labels of secondary info (never lighter than 600 on white, for contrast) |
| Surface | `bg-white`, page `bg-zinc-50` | Cards on a faint gray page |
| Border | `border-zinc-300` (fields), `border-zinc-200` (cards) | |
| **Primary action** | `bg-zinc-900 text-white hover:bg-zinc-700` | The one main button per screen (scheduler already uses this) |
| Secondary action | `border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100` | Everything else |
| Focus ring | `focus-visible:outline-2 outline-offset-2 outline-zinc-900` | Every interactive element |
| Brand | `bg-red-700` header stripe, logo | Identity only |
| **Status · good** | `bg-green-50 border-green-300 text-green-900` + ✓ icon | Saved, balanced, published, counted |
| **Status · warning** | `bg-amber-50 border-amber-400 text-amber-950` + ! icon | Not saved yet, unpublished changes, missing day, low stock |
| **Status · problem** | `bg-red-50 border-red-300 text-red-800` + ✕ / ▼ icon | Short drawer, failed save, rule broken, required spot empty |
| Status · info | `bg-sky-50 border-sky-300 text-sky-950` | Neutral notices, tips |
| Destructive button | `border border-red-300 text-red-700 hover:bg-red-50` | Clear, Remove, Delete. Never the default focus |

Status always pairs **color + icon + word** ("✓ Saved 2:14 PM", "▼ Short $4.25"). Never color alone.

Charts use the dataviz skill's validated palette (the cash dashboard's `#2a78d6` / `#eb6834` AM/PM pair is already validated). Status colors are never used for data series.

## 4. Type and size

| Element | Class | Notes |
|---|---|---|
| Page title (h1) | `text-2xl font-bold` | One per page. Says the job: "Cash out", "CR3 inventory" |
| Section (h2) | `text-lg font-semibold` | |
| Body | `text-base` (16px) | Up from today's `text-sm` (14px) on most internal pages |
| Hint / caption | `text-sm text-zinc-600` | |
| **Fields** | `text-base` (16px) min, `min-h-11` (44px) | 16px stops iPhone zoom on focus |
| **Buttons** | `min-h-11 px-4 text-base font-semibold` | 44px tall. WCAG 2.2 AA minimum is 24px; 44px is the comfortable target for a busy kitchen |
| Numbers | `tabular-nums` | Columns of money line up |

Icon-only buttons (✕ remove, ↑ ↓ move) are at least 44×44 and have an `aria-label` that names the thing ("Remove cashier 2").

## 5. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ▌China Rose · Internal   [CR3 · W Military ▾]      [Lock]    │  ← shell header (every page)
│  Home  Cash  Bookkeeping  Inventory  Schedule  Forms         │  ← tool nav (scrolls sideways on phones)
├──────────────────────────────────────────────────────────────┤
│ Cash out                                    ✓ Saved 2:14 PM  │  ← h1 + save status, same spot always
│ Mon, Oct 20 · CR3                                            │
│ ┌ ! 2 problems ─────────────────────────────────────────┐    │  ← problem summary (only when there are any)
│ │ PM cashier "Ana" is short $4.25 → go to it            │    │
│ │ Z report expected cash is empty → go to it            │    │
│ └───────────────────────────────────────────────────────┘    │
│  …the work…                                                  │
├──────────────────────────────────────────────────────────────┤
│                         [Print]  [Save cash out]             │  ← action bar: sticky at the bottom on phones
└──────────────────────────────────────────────────────────────┘
```

- Content width: `max-w-6xl` for work pages; tables may go full width.
- **Action bar:** the primary button is always last (right on desktop, full width at the bottom of a phone screen). Sticky on phones (`sticky bottom-0`) for long sheets like cash out and inventory.
- Cards: `rounded-xl border border-zinc-200 bg-white p-4`. No shadows stacking on shadows.
- Spacing: Tailwind 4 / 6 / 8 steps only.

## 6. Components (one of each, shared)

These live in `src/components/internal/ui.tsx` (to be created by moving the scheduler's `ui.tsx` primitives and the dashboard's `Segmented`, `Tile`, `Card` into one place). Pages import them instead of re-declaring class strings. Today `inputClass`, `button`, and `today()` are copy-pasted in five files.

| Component | Behavior |
|---|---|
| `Button` (`tone: primary \| secondary \| danger`, `busy`) | Shows "Saving…" text while busy. Disabled state still readable |
| `Field` (label above, hint, error, "(optional)") | Error text sits under the field, red, with the fix; the field gets `aria-invalid` and `aria-describedby` |
| `MoneyInput` | `inputMode="decimal"`, accepts `$12`, `12.5`, `12.50`; shows `$` prefix |
| `CountInput` | `inputMode="numeric"`, big tap target, accepts `1/2` where the sheet uses halves |
| `DateField` | Defaults to today; "Today" shortcut |
| `StoreSwitcher` | In the header; remembered per device (it's not secret) |
| `SaveStatus` | "✓ Saved 2:14 PM" / "! Not saved yet" / "Saving…" / "✕ Couldn't save — try again". Always top-right of the page title |
| `ProblemSummary` | List of problems at top, each a link that scrolls to and focuses the field |
| `StatusBadge` | good / warning / problem / info, icon + word |
| `Tile` | Label, big number, one-line note. Optional link "Fix it" |
| `Segmented` | 2–4 choices (store, range) |
| `Tabs` | Real `role="tablist"` with arrow keys; hash in URL so a link opens the right tab |
| `ConfirmDialog` | Replaces `window.confirm`. Title names the thing; buttons say the outcome ("Clear 23 counts" / "Keep counts"); no default on the destructive button |
| `UndoToast` | After a non-destructive removal (remove cashier, remove row): "Removed Ana · Undo" for 10 s. Used **instead of** a confirmation where possible |
| `EmptyState` | Why it's empty + one button ("No write-ups yet. [New write-up]") |
| `CodeGate` | One gate for the whole internal area (see platform.md) |

## 7. Behavior patterns

### Saving
- **Draft autosaves to the device** on every keystroke (cash out and inventory do this already via `localStorage`). The page says "Draft on this device" until it's saved to the server.
- **Saving to the server is one obvious button**, plus a status that changes to "✓ Saved 2:14 PM". If the screen changes after a save, the status flips to "! Not saved yet".
- **Leaving with unsaved work** asks first (the scheduler already uses `beforeunload`; do the same in cash out and inventory).
- **Conflicts:** "Someone else saved this at 2:10 PM. [See theirs] [Keep mine and save]". Never silently overwrite. The inventory list editor already does this well.
- **Offline:** "Couldn't reach the server. Your work is saved on this phone. [Try again]".

### Confirming and undoing
- Undo for routine removals (a row, a cashier). Confirmation dialog only for: clearing a whole sheet, overwriting the screen with a saved day, publishing to staff, saving an uneditable record.
- Uneditable records (write-ups) get a **check-your-answers** step before saving.

### Errors and warnings
- Validation runs when the person leaves a field or presses Save, not on every keystroke while typing.
- **Soft warnings don't block.** "Count is 40 — usually 2–4. Typo?" shows inline in amber; Save still works.
- **Hard errors block, and say why and how to fix:** "Pick a date before saving."

### Loading and empty
- Loading shows the page layout with "Loading…" in place, never a blank screen.
- Empty states say why and offer the next step.

### Printing
- Every sheet that exists on paper prints like the paper (already done for inventory and write-ups). The shell header, nav, and action bar are `print:hidden`.

### Accessibility floor
- Every input has a visible label. Every icon button has an `aria-label`.
- Keyboard: Tab reaches everything in visual order; Enter submits; Esc closes dialogs.
- Focus moves to the problem summary after a failed save, and to the new row after "Add".
- Color contrast ≥ 4.5:1 for text. Don't use `text-gray-400`/`500` for anything people need to read.

## 8. Checklist for a new or changed internal page

- [ ] Uses the internal shell (header, nav, store switcher, lock)
- [ ] One h1 that names the job; one primary button, labeled verb + thing
- [ ] Save status visible; draft survives reload; unsaved-leave warning
- [ ] No `window.confirm`; destructive actions use `ConfirmDialog` or Undo
- [ ] Fields 16px+, buttons/targets 44px, correct `inputMode`
- [ ] Problems listed at the top in plain words with links to the field
- [ ] Status = color + icon + word
- [ ] Works at 375px wide; prints like the paper if a paper version exists
- [ ] Empty, loading, offline, and conflict states written
- [ ] Words from the table in §2
