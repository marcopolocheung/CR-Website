---
name: internal-dashboard
description: Design language and workflow rules for China Rose internal tools (/internal/**, cash out, bookkeeping, inventory, forms, write-ups, scheduler). Use before building, changing, or reviewing any internal page or component in src/components/internal, src/components/scheduler, or src/app/(order-shell)/internal, so the result matches one consistent, non-technical-friendly design.
---

# China Rose internal dashboard

The users are restaurant managers and shift leads, often on a phone, often in a hurry, often not confident with software. The test for every screen: **could a new shift lead, on a phone, finish the job without asking anyone?**

## Before writing code

1. Read `docs/dashboard/design-language.md` (rules, words, colors, sizes, components, patterns).
2. Read the module page in `docs/dashboard/modules/` for the tool you're touching.
3. Check `docs/dashboard/improvements.md` to see if the change is already planned, and in what form.
4. If `src/components/internal/ui.tsx` exists, use its components. Don't re-declare button or field class strings.

## Hard rules

- **Never lose work:** drafts in `localStorage` keyed by module + store + date; visible save status; `beforeunload` warning when unsaved; server saves send `baseRev` and handle 409 with "Someone else saved this…".
- **One primary button per screen**, labeled verb + thing ("Save count"). Primary = `bg-zinc-900 text-white`. **Red is only for problems and delete**, never the main button.
- **Status = color + icon + word** (✓ Saved, ! Not saved yet, ▼ Short $4.25). Never color alone.
- **Sizes:** fields `text-base` and `min-h-11`; buttons and icon buttons ≥ 44px; `tabular-nums` for money; no `text-gray-400`/`500` for readable text.
- **Words:** plain, from the restaurant ("Manager code", "Cash out", "Use", "Order", "Publish"). Never "token", "rev", "sync", "invalid", "error 409".
- **No `window.confirm`.** Use a named confirm dialog ("Clear 23 counts" / "Keep counts") only for destructive or rare actions; use Undo for routine removals.
- **Errors:** next to the field, say how to fix, keep the input. Soft warnings (outliers) never block saving.
- **Paper parity:** where a paper form exists, keep its rows, names, spellings, and print layout.
- **Money:** integer cents (`src/lib/cashout.ts`); a not-yet-entered figure is `null` and shows "—", never $0.
- **Manager code** stays in memory only. Never in `localStorage`/`sessionStorage` unless the owner decides otherwise.
- **Converter output is frozen** (`src/lib/converter/*`): same fields, cells, and file. Restyle only.
- **Charts:** use the `dataviz` skill; every chart has a table view.
- **Don't store** SSNs, medical details, or bank info in the Worker.

## Before calling it done

Run through the checklist at the end of `docs/dashboard/design-language.md`, run the relevant tests (`npm run cashout:test`, `npm run scheduler:test`), and check the page in the browser at 375px and desktop width (use the `run` skill).
