# Internal-tools task tracker

Individual briefs are canonical. Update the brief and this summary together when claiming, changing a gate, or handing off. Current implementation and evidence are recorded in the canonical briefs; external/live work remains separately gated. P0 establishes safety/compatibility or early workflow foundations; P1 completes core workflows; P2 follows core adoption. Priority is not a dependency.

Milestones: I = implementation, L = local verification, E = external activation, V = live verification. P = pending; NA = not applicable; use done only with linked evidence in the brief. A CODE_ONLY completion does not claim frontend publication; REL-04 owns shared publication.

Dependency cells list stable IDs. Each brief specifies the milestone required. Implementation dependencies gate code; activation dependencies permit local implementation first and gate production completion. Status ready means no unsatisfied implementation prerequisite; it does not grant cloud access or establish a live environment.

## Code-only work available now

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-02 | Create navigation and visible working context | P0 | `CODE_ONLY` | UX-01 | — | ready | unassigned | P/P/NA/NA | [UX-02](tasks/UX-02.md) |
| UX-04 | Establish keyboard and tablet interaction patterns | P1 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [UX-04](tasks/UX-04.md) |
| DATA-07 | Prepare KV export and reconciliation tooling | P0 | `CODE_ONLY` | DATA-01 | — | ready | unassigned | P/P/NA/NA | [DATA-07](tasks/DATA-07.md) |
| SCH-08 | Verify existing scheduler and public compatibility | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [SCH-08](tasks/SCH-08.md) |
| INV-02 | Add progress, remaining filters, and search | P0 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [INV-02](tasks/INV-02.md) |
| FORM-01 | Add searchable employee/date/type lists | P1 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [FORM-01](tasks/FORM-01.md) |
| FORM-02 | Add recoverable drafts and navigation protection | P0 | `CODE_ONLY` | UX-05, UX-06 | — | ready | unassigned | P/P/NA/NA | [FORM-02](tasks/FORM-02.md) |
| FORM-07 | Verify blank downloads and saved compatibility | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [FORM-07](tasks/FORM-07.md) |
| DASH-01 | Define the outstanding-work summary contract | P0 | `CODE_ONLY` | DATA-01 | — | ready | unassigned | P/P/NA/NA | [DASH-01](tasks/DASH-01.md) |
| REL-01 | Integrate internal-service checks into CI | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [REL-01](tasks/REL-01.md) |
| REL-02 | Make Worker builds reproducible and resolve the mirror | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [REL-02](tasks/REL-02.md) |

## Code work requiring later external activation

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DATA-04 | Implement employee directory and legacy mappings | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-04](tasks/DATA-04.md) |
| DATA-05 | Implement atomic revisions and change history | P0 | `CODE_AND_EXTERNAL` | DATA-02 | DATA-03, REL-03, DATA-09 | implemented | Codex | D/D/P/P | [DATA-05](tasks/DATA-05.md) |
| DATA-06 | Implement attachment metadata, upload, and retrieval | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-06](tasks/DATA-06.md) |
| DATA-10 | Implement and verify backup/export/restore procedures | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-07, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-10](tasks/DATA-10.md) |
| SCH-01 | Persist dated time off and temporary availability | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-01 | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [SCH-01](tasks/SCH-01.md) |
| SCH-02 | Add manager-entered requests and review | P1 | `CODE_AND_EXTERNAL` | SCH-01, UX-03 | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [SCH-02](tasks/SCH-02.md) |
| SCH-04 | Add publication revisions and readable comparisons | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | ready | unassigned | P/P/P/P | [SCH-04](tasks/SCH-04.md) |
| SCH-05 | Detect cross-station assignment conflicts | P1 | `CODE_AND_EXTERNAL` | DATA-04, DATA-05, DEC-01 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [SCH-05](tasks/SCH-05.md) |
| CASH-03 | Recalculate financial totals on the server | P0 | `CODE_AND_EXTERNAL` | DATA-01, DEC-02 | REL-03, REL-04 | blocked | unassigned | P/P/P/P | [CASH-03](tasks/CASH-03.md) |
| CASH-04 | Add incomplete, submitted, and reviewed states | P0 | `CODE_AND_EXTERNAL` | CASH-03, DATA-05, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-04](tasks/CASH-04.md) |
| CASH-05 | Add discrepancy explanations and correction history | P1 | `CODE_AND_EXTERNAL` | CASH-04 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [CASH-05](tasks/CASH-05.md) |
| CASH-06 | Record actual versus expected deposits | P1 | `CODE_AND_EXTERNAL` | CASH-04, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-06](tasks/CASH-06.md) |
| CASH-08 | Improve history, filters, output, and recovery | P1 | `CODE_AND_EXTERNAL` | CASH-04, UX-07, DEC-03 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-08](tasks/CASH-08.md) |
| INV-01 | Add explicit count sessions and line states | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | ready | unassigned | P/P/P/P | [INV-01](tasks/INV-01.md) |
| INV-03 | Add units, packs, and clear target labels | P1 | `CODE_AND_EXTERNAL` | DATA-02, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-03](tasks/INV-03.md) |
| INV-05 | Generalize catalogs and counts for CR2/CR3 | P1 | `CODE_AND_EXTERNAL` | INV-01, INV-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-05](tasks/INV-05.md) |
| INV-06 | Persist supplier orders and issued snapshots | P1 | `CODE_AND_EXTERNAL` | INV-03, INV-05, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-06](tasks/INV-06.md) |
| INV-07 | Implement partial receiving and discrepancies | P1 | `CODE_AND_EXTERNAL` | INV-06 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-07](tasks/INV-07.md) |
| INV-08 | Include outstanding orders in suggestions | P1 | `CODE_AND_EXTERNAL` | INV-07 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-08](tasks/INV-08.md) |
| INV-09 | Add agreed waste and transfer records | P2 | `CODE_AND_EXTERNAL` | INV-07, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-09](tasks/INV-09.md) |
| INV-10 | Verify historical counts after catalog changes | P0 | `CODE_AND_EXTERNAL` | INV-01, INV-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-10](tasks/INV-10.md) |
| IMPORT-06 | Map employee IDs and show unmatched rows | P1 | `CODE_AND_EXTERNAL` | IMPORT-05, DATA-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-06](tasks/IMPORT-06.md) |
| IMPORT-07 | Add import history and duplicate handling | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, IMPORT-02, IMPORT-05, DEC-03-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-07](tasks/IMPORT-07.md) |
| IMPORT-08 | Add scheduled-versus-actual reporting | P2 | `CODE_AND_EXTERNAL` | IMPORT-06, IMPORT-07, SCH-06-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-08](tasks/IMPORT-08.md) |
| FORM-04 | Add attachments and append-only amendments | P1 | `CODE_AND_EXTERNAL` | DATA-06, DATA-05, FORM-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [FORM-04](tasks/FORM-04.md) |
| FORM-05 | Add follow-up dates, assignment, and resolution | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DATA-04 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [FORM-05](tasks/FORM-05.md) |
| FORM-06 | Implement the selected next digital form | P2 | `CODE_AND_EXTERNAL` | DEC-06, FORM-02, FORM-03, DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [FORM-06](tasks/FORM-06.md) |
| DASH-03 | Surface closes, differences, and count progress | P1 | `CODE_AND_EXTERNAL` | DASH-01, DASH-02, CASH-05, INV-01 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [DASH-03](tasks/DASH-03.md) |
| DASH-04 | Surface deliveries, schedule changes, and follow-ups | P1 | `CODE_AND_EXTERNAL` | DASH-01, DASH-02, INV-07, SCH-04, FORM-05 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [DASH-04](tasks/DASH-04.md) |
| DATA-04-IMPORT | Persist reviewed import directory snapshots | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [DATA-04-IMPORT](tasks/DATA-04-IMPORT.md) |

## External operations ready to perform

Readiness does not authorize cloud execution. Verified targets, explicit execution authorization and activation gates remain required.

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DATA-03 | Provision and bind non-production D1/R2 | P0 | `EXTERNAL_ONLY` | DATA-02 | — | ready | unassigned | P/P/P/P | [DATA-03](tasks/DATA-03.md) |

## Work blocked by a business decision

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-07 | Standardize print layouts and bilingual output | P1 | `CODE_ONLY` | UX-01, DEC-07 | — | blocked | unassigned | P/P/NA/NA | [UX-07](tasks/UX-07.md) |
| DATA-04 | Implement employee directory and legacy mappings | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-04](tasks/DATA-04.md) |
| DATA-06 | Implement attachment metadata, upload, and retrieval | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-06](tasks/DATA-06.md) |
| DATA-08 | Rehearse migration and recovery in non-production | P0 | `EXTERNAL_ONLY` | DATA-03, DATA-07, DATA-02, DEC-03, REL-03 | — | blocked | unassigned | P/P/P/P | [DATA-08](tasks/DATA-08.md) |
| DATA-09 | Execute production resource setup and verified cutover | P0 | `EXTERNAL_ONLY` | DATA-08, DEC-03 | — | blocked | unassigned | P/P/P/P | [DATA-09](tasks/DATA-09.md) |
| DATA-10 | Implement and verify backup/export/restore procedures | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-07, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-10](tasks/DATA-10.md) |
| SCH-06 | Add combined hours and agreed warnings | P1 | `CODE_ONLY` | DATA-04, SCH-05, DEC-04 | — | blocked | unassigned | P/P/NA/NA | [SCH-06](tasks/SCH-06.md) |
| CASH-03 | Recalculate financial totals on the server | P0 | `CODE_AND_EXTERNAL` | DATA-01, DEC-02 | REL-03, REL-04 | blocked | unassigned | P/P/P/P | [CASH-03](tasks/CASH-03.md) |
| CASH-04 | Add incomplete, submitted, and reviewed states | P0 | `CODE_AND_EXTERNAL` | CASH-03, DATA-05, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-04](tasks/CASH-04.md) |
| CASH-06 | Record actual versus expected deposits | P1 | `CODE_AND_EXTERNAL` | CASH-04, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-06](tasks/CASH-06.md) |
| CASH-08 | Improve history, filters, output, and recovery | P1 | `CODE_AND_EXTERNAL` | CASH-04, UX-07, DEC-03 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-08](tasks/CASH-08.md) |
| INV-03 | Add units, packs, and clear target labels | P1 | `CODE_AND_EXTERNAL` | DATA-02, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-03](tasks/INV-03.md) |
| INV-09 | Add agreed waste and transfer records | P2 | `CODE_AND_EXTERNAL` | INV-07, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-09](tasks/INV-09.md) |
| FORM-06 | Implement the selected next digital form | P2 | `CODE_AND_EXTERNAL` | DEC-06, FORM-02, FORM-03, DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [FORM-06](tasks/FORM-06.md) |
| REL-05 | Conduct bilingual shared-device staff tests | P1 | `USABILITY` | REL-04, DEC-07 | — | blocked | unassigned | P/P/P/P | [REL-05](tasks/REL-05.md) |

## Deferred work

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LATER-01 | Authentication redesign | P2 | `CODE_AND_EXTERNAL` | — | — | deferred | unassigned | P/P/P/P | [LATER-01](tasks/LATER-01.md) |
| LATER-02 | Frontend hosting migration coordination | P2 | `CODE_AND_EXTERNAL` | — | — | deferred | unassigned | P/P/P/P | [LATER-02](tasks/LATER-02.md) |
| LATER-03 | Optional Toast API integration | P2 | `CODE_AND_EXTERNAL` | IMPORT-07 | — | deferred | unassigned | P/P/P/P | [LATER-03](tasks/LATER-03.md) |
| LATER-04 | Barcode and shelf-QR scanning | P2 | `CODE_ONLY` | INV-03, INV-05 | — | deferred | unassigned | P/P/NA/NA | [LATER-04](tasks/LATER-04.md) |
| LATER-05 | Personal calendars and notifications | P2 | `CODE_AND_EXTERNAL` | DATA-04, SCH-04 | — | deferred | unassigned | P/P/P/P | [LATER-05](tasks/LATER-05.md) |
| LATER-06 | Advanced scheduling optimization | P2 | `CODE_AND_EXTERNAL` | SCH-03, SCH-05, SCH-06 | — | deferred | unassigned | P/P/P/P | [LATER-06](tasks/LATER-06.md) |
| LATER-07 | Ordering and QR prototype disposition | P2 | `DECISION` | — | — | deferred | unassigned | P/P/NA/NA | [LATER-07](tasks/LATER-07.md) |

## Completed work with verification evidence

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-01 | Confirm business-date and shift-boundary rules | P0 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-01](tasks/DEC-01.md) |
| UX-01 | Establish translations and local dictionaries | P0 | `CODE_ONLY` | — | — | complete | Codex | D/D/NA/NA | [UX-01](tasks/UX-01.md) |
| UX-03 | Standardize controls, feedback, and save indicators | P0 | `CODE_ONLY` | UX-01 | — | complete | Codex | D/D/NA/NA | [UX-03](tasks/UX-03.md) |
| UX-05 | Implement labeled drafts and shared-device handoff | P0 | `CODE_ONLY` | UX-03 | — | complete | Codex | D/D/NA/NA | [UX-05](tasks/UX-05.md) |
| UX-06 | Handle unsaved changes, retries, and edit conflicts | P0 | `CODE_ONLY` | DATA-01, UX-03, UX-05 | — | complete | Codex | D/D/NA/NA | [UX-06](tasks/UX-06.md) |
| DATA-01 | Establish record and API compatibility contracts | P0 | `CODE_ONLY` | — | — | complete | Codex | D/D/NA/NA | [DATA-01](tasks/DATA-01.md) |
| DATA-02 | Add D1 migrations, local configuration, and fixtures | P0 | `CODE_ONLY` | DATA-01 | — | complete | Codex | D/D/NA/NA | [DATA-02](tasks/DATA-02.md) |
| DATA-05 | Implement atomic revisions and change history | P0 | `CODE_AND_EXTERNAL` | DATA-02 | DATA-03, REL-03, DATA-09 | implemented | Codex | D/D/P/P | [DATA-05](tasks/DATA-05.md) |
| CASH-01 | Correct store/date-specific draft restoration | P0 | `CODE_ONLY` | UX-05 | — | complete | Codex | D/D/NA/NA | [CASH-01](tasks/CASH-01.md) |
| IMPORT-01 | Validate source files with actionable errors | P0 | `CODE_ONLY` | UX-01, UX-03, UX-06 | — | complete | Codex | D/D/NA/NA | [IMPORT-01](tasks/IMPORT-01.md) |
| IMPORT-02 | Add sales previews and reconciliation | P0 | `CODE_ONLY` | IMPORT-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-02](tasks/IMPORT-02.md) |
| IMPORT-03 | Preserve inputs and repeat downloads | P0 | `CODE_ONLY` | IMPORT-01, IMPORT-02 | — | complete | Codex | D/D/NA/NA | [IMPORT-03](tasks/IMPORT-03.md) |
| IMPORT-04 | Unify date/store handling and cash-out linkage | P1 | `CODE_ONLY` | IMPORT-02, DEC-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-04](tasks/IMPORT-04.md) |
| IMPORT-05 | Add hours previews and explicit date ranges | P0 | `CODE_ONLY` | IMPORT-01, DEC-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-05](tasks/IMPORT-05.md) |
| IMPORT-06 | Map employee IDs and show unmatched rows | P1 | `CODE_AND_EXTERNAL` | IMPORT-05, DATA-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-06](tasks/IMPORT-06.md) |
| IMPORT-07 | Add import history and duplicate handling | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, IMPORT-02, IMPORT-05, DEC-03-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-07](tasks/IMPORT-07.md) |
| IMPORT-08 | Add scheduled-versus-actual reporting | P2 | `CODE_AND_EXTERNAL` | IMPORT-06, IMPORT-07, SCH-06-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-08](tasks/IMPORT-08.md) |
| DEC-04-IMPORT | Approve explicit identity mappings for imports | P1 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-04-IMPORT](tasks/DEC-04-IMPORT.md) |
| DATA-04-IMPORT | Persist reviewed import directory snapshots | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [DATA-04-IMPORT](tasks/DATA-04-IMPORT.md) |
| DEC-03-IMPORT | Approve reviewed import history without raw uploads or disposal | P1 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-03-IMPORT](tasks/DEC-03-IMPORT.md) |
| SCH-06-IMPORT | Read published schedule estimates for import comparison | P1 | `CODE_ONLY` | DATA-04-IMPORT, DEC-01, DEC-04-IMPORT | — | complete | Codex | D/D/NA/NA | [SCH-06-IMPORT](tasks/SCH-06-IMPORT.md) |

## All tasks

| ID | Title | Priority | Class | Implement dependencies | Activate dependencies | Status | Owner | Milestones I/L/E/V | Brief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-01 | Confirm business-date and shift-boundary rules | P0 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-01](tasks/DEC-01.md) |
| DEC-02 | Confirm starting-cash, adjustment, and discrepancy-review rules | P0 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-02](tasks/DEC-02.md) |
| DEC-03 | Define retention, archival, export, and recovery requirements | P0 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-03](tasks/DEC-03.md) |
| DEC-04 | Define shared employee identity and station membership | P0 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-04](tasks/DEC-04.md) |
| DEC-05 | Confirm inventory units, packs, suppliers, and targets | P0 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-05](tasks/DEC-05.md) |
| DEC-06 | Choose the next digital form and review requirements | P1 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-06](tasks/DEC-06.md) |
| DEC-07 | Review Spanish terminology, money, dates, and print language | P1 | `DECISION` | — | — | ready | unassigned | P/P/NA/NA | [DEC-07](tasks/DEC-07.md) |
| UX-01 | Establish translations and local dictionaries | P0 | `CODE_ONLY` | — | — | complete | Codex | D/D/NA/NA | [UX-01](tasks/UX-01.md) |
| UX-02 | Create navigation and visible working context | P0 | `CODE_ONLY` | UX-01 | — | ready | unassigned | P/P/NA/NA | [UX-02](tasks/UX-02.md) |
| UX-03 | Standardize controls, feedback, and save indicators | P0 | `CODE_ONLY` | UX-01 | — | complete | Codex | D/D/NA/NA | [UX-03](tasks/UX-03.md) |
| UX-04 | Establish keyboard and tablet interaction patterns | P1 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [UX-04](tasks/UX-04.md) |
| UX-05 | Implement labeled drafts and shared-device handoff | P0 | `CODE_ONLY` | UX-03 | — | complete | Codex | D/D/NA/NA | [UX-05](tasks/UX-05.md) |
| UX-06 | Handle unsaved changes, retries, and edit conflicts | P0 | `CODE_ONLY` | DATA-01, UX-03, UX-05 | — | complete | Codex | D/D/NA/NA | [UX-06](tasks/UX-06.md) |
| UX-07 | Standardize print layouts and bilingual output | P1 | `CODE_ONLY` | UX-01, DEC-07 | — | blocked | unassigned | P/P/NA/NA | [UX-07](tasks/UX-07.md) |
| DATA-01 | Establish record and API compatibility contracts | P0 | `CODE_ONLY` | — | — | complete | Codex | D/D/NA/NA | [DATA-01](tasks/DATA-01.md) |
| DATA-02 | Add D1 migrations, local configuration, and fixtures | P0 | `CODE_ONLY` | DATA-01 | — | complete | Codex | D/D/NA/NA | [DATA-02](tasks/DATA-02.md) |
| DATA-03 | Provision and bind non-production D1/R2 | P0 | `EXTERNAL_ONLY` | DATA-02 | — | ready | unassigned | P/P/P/P | [DATA-03](tasks/DATA-03.md) |
| DATA-04 | Implement employee directory and legacy mappings | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-04](tasks/DATA-04.md) |
| DATA-05 | Implement atomic revisions and change history | P0 | `CODE_AND_EXTERNAL` | DATA-02 | DATA-03, REL-03, DATA-09 | implemented | Codex | D/D/P/P | [DATA-05](tasks/DATA-05.md) |
| DATA-06 | Implement attachment metadata, upload, and retrieval | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-06](tasks/DATA-06.md) |
| DATA-07 | Prepare KV export and reconciliation tooling | P0 | `CODE_ONLY` | DATA-01 | — | ready | unassigned | P/P/NA/NA | [DATA-07](tasks/DATA-07.md) |
| DATA-08 | Rehearse migration and recovery in non-production | P0 | `EXTERNAL_ONLY` | DATA-03, DATA-07, DATA-02, DEC-03, REL-03 | — | blocked | unassigned | P/P/P/P | [DATA-08](tasks/DATA-08.md) |
| DATA-09 | Execute production resource setup and verified cutover | P0 | `EXTERNAL_ONLY` | DATA-08, DEC-03 | — | blocked | unassigned | P/P/P/P | [DATA-09](tasks/DATA-09.md) |
| DATA-10 | Implement and verify backup/export/restore procedures | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-07, DEC-03 | DATA-03, REL-03, DATA-09 | blocked | unassigned | P/P/P/P | [DATA-10](tasks/DATA-10.md) |
| SCH-01 | Persist dated time off and temporary availability | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-01 | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [SCH-01](tasks/SCH-01.md) |
| SCH-02 | Add manager-entered requests and review | P1 | `CODE_AND_EXTERNAL` | SCH-01, UX-03 | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [SCH-02](tasks/SCH-02.md) |
| SCH-03 | Apply approved exceptions to generation and validation | P1 | `CODE_ONLY` | SCH-01 | — | ready | unassigned | P/P/NA/NA | [SCH-03](tasks/SCH-03.md) |
| SCH-04 | Add publication revisions and readable comparisons | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | ready | unassigned | P/P/P/P | [SCH-04](tasks/SCH-04.md) |
| SCH-05 | Detect cross-station assignment conflicts | P1 | `CODE_AND_EXTERNAL` | DATA-04, DATA-05, DEC-01 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [SCH-05](tasks/SCH-05.md) |
| SCH-06 | Add combined hours and agreed warnings | P1 | `CODE_ONLY` | DATA-04, SCH-05, DEC-04 | — | blocked | unassigned | P/P/NA/NA | [SCH-06](tasks/SCH-06.md) |
| SCH-07 | Improve planning and staff views in both languages | P1 | `CODE_ONLY` | UX-02, UX-04 | — | planned | unassigned | P/P/NA/NA | [SCH-07](tasks/SCH-07.md) |
| SCH-08 | Verify existing scheduler and public compatibility | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [SCH-08](tasks/SCH-08.md) |
| CASH-01 | Correct store/date-specific draft restoration | P0 | `CODE_ONLY` | UX-05 | — | complete | Codex | D/D/NA/NA | [CASH-01](tasks/CASH-01.md) |
| CASH-02 | Add guided cashier entry | P0 | `CODE_ONLY` | UX-03, UX-04 | — | planned | unassigned | P/P/NA/NA | [CASH-02](tasks/CASH-02.md) |
| CASH-03 | Recalculate financial totals on the server | P0 | `CODE_AND_EXTERNAL` | DATA-01, DEC-02 | REL-03, REL-04 | blocked | unassigned | P/P/P/P | [CASH-03](tasks/CASH-03.md) |
| CASH-04 | Add incomplete, submitted, and reviewed states | P0 | `CODE_AND_EXTERNAL` | CASH-03, DATA-05, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-04](tasks/CASH-04.md) |
| CASH-05 | Add discrepancy explanations and correction history | P1 | `CODE_AND_EXTERNAL` | CASH-04 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [CASH-05](tasks/CASH-05.md) |
| CASH-06 | Record actual versus expected deposits | P1 | `CODE_AND_EXTERNAL` | CASH-04, DEC-02 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-06](tasks/CASH-06.md) |
| CASH-07 | Use the employee directory for cashier selection | P1 | `CODE_ONLY` | DATA-04, UX-03 | — | planned | unassigned | P/P/NA/NA | [CASH-07](tasks/CASH-07.md) |
| CASH-08 | Improve history, filters, output, and recovery | P1 | `CODE_AND_EXTERNAL` | CASH-04, UX-07, DEC-03 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [CASH-08](tasks/CASH-08.md) |
| INV-01 | Add explicit count sessions and line states | P0 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | ready | unassigned | P/P/P/P | [INV-01](tasks/INV-01.md) |
| INV-02 | Add progress, remaining filters, and search | P0 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [INV-02](tasks/INV-02.md) |
| INV-03 | Add units, packs, and clear target labels | P1 | `CODE_AND_EXTERNAL` | DATA-02, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-03](tasks/INV-03.md) |
| INV-04 | Improve tablet entry and shelf-order navigation | P1 | `CODE_ONLY` | UX-04, INV-02 | — | planned | unassigned | P/P/NA/NA | [INV-04](tasks/INV-04.md) |
| INV-05 | Generalize catalogs and counts for CR2/CR3 | P1 | `CODE_AND_EXTERNAL` | INV-01, INV-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-05](tasks/INV-05.md) |
| INV-06 | Persist supplier orders and issued snapshots | P1 | `CODE_AND_EXTERNAL` | INV-03, INV-05, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-06](tasks/INV-06.md) |
| INV-07 | Implement partial receiving and discrepancies | P1 | `CODE_AND_EXTERNAL` | INV-06 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-07](tasks/INV-07.md) |
| INV-08 | Include outstanding orders in suggestions | P1 | `CODE_AND_EXTERNAL` | INV-07 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-08](tasks/INV-08.md) |
| INV-09 | Add agreed waste and transfer records | P2 | `CODE_AND_EXTERNAL` | INV-07, DEC-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [INV-09](tasks/INV-09.md) |
| INV-10 | Verify historical counts after catalog changes | P0 | `CODE_AND_EXTERNAL` | INV-01, INV-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [INV-10](tasks/INV-10.md) |
| IMPORT-01 | Validate source files with actionable errors | P0 | `CODE_ONLY` | UX-01, UX-03, UX-06 | — | complete | Codex | D/D/NA/NA | [IMPORT-01](tasks/IMPORT-01.md) |
| IMPORT-02 | Add sales previews and reconciliation | P0 | `CODE_ONLY` | IMPORT-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-02](tasks/IMPORT-02.md) |
| IMPORT-03 | Preserve inputs and repeat downloads | P0 | `CODE_ONLY` | IMPORT-01, IMPORT-02 | — | complete | Codex | D/D/NA/NA | [IMPORT-03](tasks/IMPORT-03.md) |
| IMPORT-04 | Unify date/store handling and cash-out linkage | P1 | `CODE_ONLY` | IMPORT-02, DEC-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-04](tasks/IMPORT-04.md) |
| IMPORT-05 | Add hours previews and explicit date ranges | P0 | `CODE_ONLY` | IMPORT-01, DEC-01 | — | complete | Codex | D/D/NA/NA | [IMPORT-05](tasks/IMPORT-05.md) |
| IMPORT-06 | Map employee IDs and show unmatched rows | P1 | `CODE_AND_EXTERNAL` | IMPORT-05, DATA-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-06](tasks/IMPORT-06.md) |
| IMPORT-07 | Add import history and duplicate handling | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, IMPORT-02, IMPORT-05, DEC-03-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-07](tasks/IMPORT-07.md) |
| IMPORT-08 | Add scheduled-versus-actual reporting | P2 | `CODE_AND_EXTERNAL` | IMPORT-06, IMPORT-07, SCH-06-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [IMPORT-08](tasks/IMPORT-08.md) |
| FORM-01 | Add searchable employee/date/type lists | P1 | `CODE_ONLY` | UX-03 | — | ready | unassigned | P/P/NA/NA | [FORM-01](tasks/FORM-01.md) |
| FORM-02 | Add recoverable drafts and navigation protection | P0 | `CODE_ONLY` | UX-05, UX-06 | — | ready | unassigned | P/P/NA/NA | [FORM-02](tasks/FORM-02.md) |
| FORM-03 | Separate bilingual entry from print layout | P1 | `CODE_ONLY` | UX-03, UX-07 | — | planned | unassigned | P/P/NA/NA | [FORM-03](tasks/FORM-03.md) |
| FORM-04 | Add attachments and append-only amendments | P1 | `CODE_AND_EXTERNAL` | DATA-06, DATA-05, FORM-03 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [FORM-04](tasks/FORM-04.md) |
| FORM-05 | Add follow-up dates, assignment, and resolution | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DATA-04 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [FORM-05](tasks/FORM-05.md) |
| FORM-06 | Implement the selected next digital form | P2 | `CODE_AND_EXTERNAL` | DEC-06, FORM-02, FORM-03, DATA-02, DATA-05 | DATA-03, REL-03, DATA-09, REL-04 | blocked | unassigned | P/P/P/P | [FORM-06](tasks/FORM-06.md) |
| FORM-07 | Verify blank downloads and saved compatibility | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [FORM-07](tasks/FORM-07.md) |
| DASH-01 | Define the outstanding-work summary contract | P0 | `CODE_ONLY` | DATA-01 | — | ready | unassigned | P/P/NA/NA | [DASH-01](tasks/DASH-01.md) |
| DASH-02 | Add contextual exact-record links | P1 | `CODE_ONLY` | DASH-01, UX-02 | — | planned | unassigned | P/P/NA/NA | [DASH-02](tasks/DASH-02.md) |
| DASH-03 | Surface closes, differences, and count progress | P1 | `CODE_AND_EXTERNAL` | DASH-01, DASH-02, CASH-05, INV-01 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [DASH-03](tasks/DASH-03.md) |
| DASH-04 | Surface deliveries, schedule changes, and follow-ups | P1 | `CODE_AND_EXTERNAL` | DASH-01, DASH-02, INV-07, SCH-04, FORM-05 | DATA-03, REL-03, DATA-09, REL-04 | planned | unassigned | P/P/P/P | [DASH-04](tasks/DASH-04.md) |
| DASH-05 | Distinguish missing, failed, and empty data | P0 | `CODE_ONLY` | DASH-01, UX-03 | — | planned | unassigned | P/P/NA/NA | [DASH-05](tasks/DASH-05.md) |
| REL-01 | Integrate internal-service checks into CI | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [REL-01](tasks/REL-01.md) |
| REL-02 | Make Worker builds reproducible and resolve the mirror | P0 | `CODE_ONLY` | — | — | ready | unassigned | P/P/NA/NA | [REL-02](tasks/REL-02.md) |
| REL-03 | Document and verify staged backend deployment | P0 | `EXTERNAL_ONLY` | REL-02 | — | planned | unassigned | P/P/P/P | [REL-03](tasks/REL-03.md) |
| REL-04 | Document frontend publication and verify activation | P0 | `EXTERNAL_ONLY` | REL-01, REL-03 | — | planned | unassigned | P/P/P/P | [REL-04](tasks/REL-04.md) |
| REL-05 | Conduct bilingual shared-device staff tests | P1 | `USABILITY` | REL-04, DEC-07 | — | blocked | unassigned | P/P/P/P | [REL-05](tasks/REL-05.md) |
| REL-06 | Pilot workflows and record defects | P1 | `USABILITY` | REL-05 | — | planned | unassigned | P/P/P/P | [REL-06](tasks/REL-06.md) |
| REL-07 | Complete rollout, handoff, and recovery rehearsal | P1 | `EXTERNAL_ONLY` | REL-06, DATA-09, DATA-10 | — | planned | unassigned | P/P/P/P | [REL-07](tasks/REL-07.md) |
| LATER-01 | Authentication redesign | P2 | `CODE_AND_EXTERNAL` | — | — | deferred | unassigned | P/P/P/P | [LATER-01](tasks/LATER-01.md) |
| LATER-02 | Frontend hosting migration coordination | P2 | `CODE_AND_EXTERNAL` | — | — | deferred | unassigned | P/P/P/P | [LATER-02](tasks/LATER-02.md) |
| LATER-03 | Optional Toast API integration | P2 | `CODE_AND_EXTERNAL` | IMPORT-07 | — | deferred | unassigned | P/P/P/P | [LATER-03](tasks/LATER-03.md) |
| LATER-04 | Barcode and shelf-QR scanning | P2 | `CODE_ONLY` | INV-03, INV-05 | — | deferred | unassigned | P/P/NA/NA | [LATER-04](tasks/LATER-04.md) |
| LATER-05 | Personal calendars and notifications | P2 | `CODE_AND_EXTERNAL` | DATA-04, SCH-04 | — | deferred | unassigned | P/P/P/P | [LATER-05](tasks/LATER-05.md) |
| LATER-06 | Advanced scheduling optimization | P2 | `CODE_AND_EXTERNAL` | SCH-03, SCH-05, SCH-06 | — | deferred | unassigned | P/P/P/P | [LATER-06](tasks/LATER-06.md) |
| LATER-07 | Ordering and QR prototype disposition | P2 | `DECISION` | — | — | deferred | unassigned | P/P/NA/NA | [LATER-07](tasks/LATER-07.md) |
| DEC-04-IMPORT | Approve explicit identity mappings for imports | P1 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-04-IMPORT](tasks/DEC-04-IMPORT.md) |
| DATA-04-IMPORT | Persist reviewed import directory snapshots | P1 | `CODE_AND_EXTERNAL` | DATA-02, DATA-05, DEC-04-IMPORT | DATA-03, REL-03, DATA-09, REL-04 | implemented | Codex | D/D/P/P | [DATA-04-IMPORT](tasks/DATA-04-IMPORT.md) |
| DEC-03-IMPORT | Approve reviewed import history without raw uploads or disposal | P1 | `DECISION` | — | — | complete | Codex | D/D/NA/NA | [DEC-03-IMPORT](tasks/DEC-03-IMPORT.md) |
| SCH-06-IMPORT | Read published schedule estimates for import comparison | P1 | `CODE_ONLY` | DATA-04-IMPORT, DEC-01, DEC-04-IMPORT | — | complete | Codex | D/D/NA/NA | [SCH-06-IMPORT](tasks/SCH-06-IMPORT.md) |
