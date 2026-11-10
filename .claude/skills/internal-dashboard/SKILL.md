---
name: internal-dashboard
description: Design language and workflow rules for China Rose internal tools. Use before building, changing, or reviewing internal cash, bookkeeping, inventory, forms, write-ups, scheduling, or shared internal components so work matches the approved design bank and preserves existing business behavior.
---

# China Rose internal dashboard

Design for restaurant managers and shift leads using shared computers, phones
and tablets. A new shift lead should be able to identify the task, finish it
and tell whether the work was saved.

## Read before editing

1. Read `docs/design/internal-language/README.md` and `guidelines.md` there.
2. Inspect its approved examples and `tokens.css`. The baseline is **Night
   shift + Layered paper + Patina teal**, with moving red navigation.
3. For overhaul work, read the requested step in
   `docs/internal-tools-overhaul/implementation-guide.md` and its preceding
   checkpoint. Complete only the requested step and hand it back for review.
4. Check current source, the relevant module and task brief, and existing
   shared primitives before introducing another component or API contract.

The bank supersedes earlier black-only primary buttons, red-only-for-danger
rules and requirements to mirror the printed sheet on entry screens. Preserve
recognizable field names and print fidelity while improving entry workflows.
Historical module inventories must be checked against current source.

## Apply the bank and preserve behavior

- Use the public-site red for primary actions, Patina's light/dark pair on
  appropriate surfaces, square paper framing and a clear surface hierarchy.
- Use the shared 24-unit outline icon grammar and visible labels. Status needs
  words and icons as well as color. Keep copy direct; omit greetings and pep talk.
- Preserve drafts, visible save state and context boundaries. Keep manager
  credentials in memory. Do not introduce persistent credentials.
- Preserve money arithmetic, blank versus zero, imported workbook fields and
  outputs, record revisions, shared links and staff permissions unless the
  requested step explicitly changes a reviewed contract. Surface unsupported
  backend capabilities honestly; do not imply a successful save.
- Keep errors close to the affected input and retain entered values. Use
  named confirmation for destructive actions and undo for routine removals.
- Provide keyboard access, visible focus, touch targets, reduced motion,
  readable money, English/Spanish parity and a table alternative for charts.
- Do not store SSNs, medical details or bank information in the Worker.

## Verify and hand off

Use the bank's review checklist and the requested step's domain checks.
Inspect the actual changed screens at narrow and wide widths, including long
Spanish labels and failure/recovery states. Run relevant existing tests and
required type/build checks for application changes. Documentation-only work
needs documentation checks, not an application rebuild.

Record actual results, limitations and remaining release gates using
`docs/internal-tools-overhaul/checkpoint-template.md`. Local implementation,
owner review, external activation and live verification are separate evidence.
