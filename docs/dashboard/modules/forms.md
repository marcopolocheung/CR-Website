# Forms and write-ups

`/internal/forms` — `src/app/(order-shell)/internal/forms/page.tsx` (blank forms list), `WriteUps.tsx`, `src/lib/writeup-store.ts`. Files: `public/internal/forms/`, sources in `docs/forms/`.

## Job

Give managers the right paper form fast, and keep a reliable record of the ones that are HR events (write-ups, deductions, injuries, complaints).

## What exists

- A list of 11 blank forms (download/print).
- **Write-ups** rebuilt on screen to match the paper form exactly (two printed pages), saved to the Worker, **uneditable after saving** (only a manager label can change), listed by date/employee. That immutability is the right call for a disciplinary record.

## Each paper form: what it should become

| Form | Today | Should be | Why |
|---|---|---|---|
| **Daily cash difference record** | Blank xlsx | **Retire**: the cash-out screen produces every field. Replace the download with "Use Cash out instead → [Open]", plus a monthly export in this layout (cash.md) | Duplicate data entry |
| **CR3 inventory list** | Blank xlsx | **Retire** in favor of the inventory screen, keep "Print blank sheet" there | Same |
| **Employee write-up** | Screen + saved | Keep. Add a **check-your-answers step** before the final save ("This can't be edited after saving"), a per-employee history ("3rd write-up for Ana this year"), and employee/manager sign on paper after printing | Permanent record. History is what makes progressive discipline consistent |
| **Paycheck deduction approval** (drawer short) | Blank docx | **Fill-and-print** from cash history: name, date, amount pre-filled, printed for signatures. Never stored as a deduction instruction. See research.md §6 on written authorization and minimum wage limits **(verify)** | The signature is the legal requirement; pre-filling removes errors |
| **Customer complaint** | Blank xlsx | **Screen form, saved** (location, date, shift, type checkboxes exactly as the paper: customer service / food quality / quantity / others, comments, shift manager). Then a monthly count by type on the home or cash page | Complaint *patterns* ("rice too hard ×6 in Oct") are only visible if they're data. The form is all checkboxes, so it's ideal to digitize |
| **Injury report** | Blank PDF | Keep paper (signatures, may go to insurer/workers' comp). Add a one-line "log" (date, employee, kept where) so the GM knows one exists | Sensitive medical data stays off KV |
| **Payroll change request** | Blank PDF | Keep paper, or a fill-and-print screen | Goes to payroll provider |
| **Pay rate increase application** | Blank xlsx (CR2/CR3 sheets) | Fill-and-print screen; **never store SSN** (the form asks for it) | Sensitive |
| **Hiring application** | Blank xlsx | Keep paper for now. Before digitizing, review questions (SSN, felony, medical history before an offer) with someone who knows employment law **(verify)**. A careers page already exists on the public site | Legal exposure |
| **New hire packet** | PDF | Keep. Later: a checklist per new hire (I-9, W-4, food handler card, uniform) with ✓ per item | Onboarding checklists are a core feature of Homebase/7shifts **(verify)** |
| **CR3 daily preparation list** | Blank xlsx | **Next screen to build after complaints**: same shape as inventory (ITEM, S.L. = par, INV, TO DO; units T/BU/BA/CS). Reuse the inventory components with a different item list and "TO DO" in place of "ORDER" | Daily task, same mental model as inventory, high reuse |

## Ideal page

```
Forms
  On screen (saved)
    Employee write-ups           3 this month     [Open]
    Customer complaints          6 this month     [New] [Open]
  Fill in and print
    Paycheck deduction approval                   [Fill in]
    Pay rate increase                             [Fill in]
  Blank paper forms
    Injury report · Payroll change · Hiring application · New hire packet   [PDF] [XLSX]
  Moved to a screen
    Daily cash difference → Cash out · Inventory list → Inventory · Prep list → Prep
```

- **Write-ups move to their own page** (`/internal/forms/write-ups`), not below the blank-forms list with a second code gate on the same page.
- Icons + file type words ("PDF · opens in browser", "Excel · downloads") instead of bare `XLSX`.

## Why

- Every paper form that duplicates a screen is a chance for the two to disagree. Retire it, and point people to the screen.
- Forms that are mostly checkboxes (complaints) are the cheapest to digitize and the most valuable as data.
- Forms with signatures and sensitive personal data stay on paper. That's safer and legally simpler. Fill-and-print removes the handwriting errors without storing the data.
