---
id: DEC-03-FILES
parent: DEC-03
title: "Approve keep-forever retention for the company files library"
priority: P1
delivery_class: DECISION
status: complete
owner: Claude
implementation_dependencies: []
activation_dependencies: []
implementation: done
local_verification: done
external_activation: not_applicable
live_verification: not_applicable
---

# DEC-03-FILES — Approve keep-forever retention for the company files library

This independently deliverable slice keeps [DEC-03](DEC-03.md) as its stable parent. It covers the `attachment` record family only and does not complete the parent's wider policy. The owner approved it on 2026-11-27.

Approved policy `DEC-03 attachments-v1`:

- **Retention:** current files, every version, trashed files and the activity log are kept forever. No automatic purge and no "empty trash".
- **Limits:** 25 MB per file; xlsx, xls, csv, pdf, docx, doc, png, jpg/jpeg, heic. Always served as downloads.
- **Access:** anyone with the manager code can view and add. Entered names are labels, not identity.
- **Content:** no sensitive documents (SSNs, medical, bank, ID) in this slice.
- **Imports:** narrows [DEC-03-IMPORT](DEC-03-IMPORT.md)'s "no raw uploads" only for a manager's optional save of a source spreadsheet into Files. Import history itself is unchanged.

Scope, design, acceptance scenarios, rollback and release gates: [files-library.md](../files-library.md). Other families' retention, archival, export, backup and recovery objectives remain pending under DEC-03.

## Milestones

| Milestone | State | Evidence required |
| --- | --- | --- |
| Implementation | done | Decision recorded in [files-library.md](../files-library.md). |
| Local verification | done | Owner decisions confirmed in session on 2026-11-27; tracker check passes. |
| External activation | not_applicable | No external operation. |
| Live verification | not_applicable | No live claim. |

## Handoff evidence

- Scope/artifacts: [files-library.md](../files-library.md), implementation-guide Steps 14a/14b.
- Checks: `python3 scripts/check-overhaul-tracker.py`. Documentation only; no application change.
- Next owner/action: DATA-06 implementation in Step 14a, after Step 14 is reviewed and merged.
