# Digital form template inventory

Inspected the existing `public/internal/forms` artifacts on 2026-11-07 to retain
paper fields in the four new digital editors. Original downloads are unchanged.

| Target | SHA-256 |
| --- | --- |
| `injury-report.pdf` | `40b745e7b8b9737d670e7674710a53713e68215bcae365217117037b91b4f8eb` |
| `customer-complaint.xlsx` | `433520f8d1e3d3aa240598daddbd3544cc929b387f11609e6afffb35923a73d1` |
| `payroll-change-request.pdf` | `90f80ebbbe114db3e2192f55ae6c63a1455b337e520930451c2ff8a19471d143` |
| `pay-rate-increase.xlsx` | `711c639f314b6d9611e4d95f82f00d9d1521f271eb73b0cc250715896c6271f4` |

## Evidence and limits

`rea-project analyze /home/unusn/CR/public/internal/forms/customer-complaint.xlsx
--project /home/unusn/CR` retained run
`.rea/runs/20261107T182957.868383Z-1d7658e6/`. Read `run.json` and
`evidence.json`; no summary or evidence ID was produced. REA 6.8.0 returned
`capability_unavailable` / `unsupported_provider`: its auto-selected native
providers do not support this spreadsheet archive and are not configured.
This establishes no form-field coverage. No provider was installed or configured.

Used ZIP/XML inspection of shared strings and worksheet cells for both Excel
files, and rendered both single-page scanned PDFs with PyMuPDF for visual
inspection. PDF text extraction returned no text. These observations establish
visible labels and spreadsheet cells, not formulas, embedded-image content,
validation macros, external payroll behavior, or legal sufficiency. The digital
layout preserves field meaning rather than reproducing exact paper coordinates.

## Field mapping decisions

- Injury: company/store; injured-person category, name, phone/address; incident
  date/time and manager; initial response; 911/reference/paramedic and police
  case/officer; location; two witnesses and their contacts/addresses; evidence
  and incident narrative; report preparer/date. The common form date is separate
  from the incident date. Evidence is a text description/location, not a file upload.
- Complaint: store, date, shift, optional customer; all four checkbox groups
  (service, food quality, food quantity, other); comments and manager/date.
  Added action/resolution for follow-up. Unnamed customers list as anonymous.
- Payroll: company/store, employee number/name, period ending; hours/pay short,
  other discrepancy and explanation; name/address/tax/other changes; employee
  signature/name and date, manager and office approval. Retained the paper's
  supporting-ID and W-4 instructions in the printable view.
- Pay increase: both workbook sheets share the same fields for CR2/CR3, so one
  editor uses the chosen store. Includes department/position, employee number,
  current/proposed rates, raise/effective dates, manager/date, approval, and
  denial reason. Added pay basis and performance rationale. Omitted the SSN
  field from both saved data and device drafts; unrecognized fields are rejected.

See `docs/dashboard/modules/forms.md` for storage, deployment, and verification.
