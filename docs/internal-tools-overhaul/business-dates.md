# DEC-01: business dates, version 1

Decision date: 2026-10-24. Authority: the requesting repository owner in this conversation, who answered “CST, 11-9, no clue whatever the csv might say on CR3 kitchen schedule, doesnt matter, im not sure, implement what you think is correct”, then directed continuation through IMPORT-08. Codex records the delegated choices below. No independent staff sign-off or personal approver name is asserted.

The version is effective for local implementation from this record's date. Production effect begins only when the affected reviewed implementation is separately published/activated; this document does not change a running system. A consuming record must retain its policy version/context. Current records keep their original date and source text.

| Question | CR2 and CR3 rule | Basis |
| --- | --- | --- |
| Time zone | `America/Chicago`, including seasonal daylight saving | User's CST interpreted as local Central time, rather than a fixed UTC offset |
| Opening hours | 11:00–21:00 informational; shifts may start earlier/end later | User's 11–9 is not an instruction to truncate shifts |
| Business-day boundary | Local midnight | Delegated default |
| Shift ownership | Date on which the source shift starts; preserve the complete shift even if it ends next day | Delegated default |
| Selected range | Inclusive starting business dates; include the whole source shift if its start date is in the range | Delegated default; no source hour recalculation |
| Week start | Sunday | Preserve `src/lib/scheduler/week.ts`, scheduler DAYS and CR3 kitchen compatibility |
| AM/PM | Retain source slot designation. AM/PM does not change the selected calendar date. | Existing workbook semantics; no new shift cutoff |
| Override | Sales source context that disagrees with the selected context requires an explicit reason visible in review; unknown source dates require review too | Delegated safeguard |

Examples (both stores):

| Input | Expected result |
| --- | --- |
| 2026-10-24 local 11:00 AM / 9:00 PM | Both own 2026-10-24; hours outside opening times remain source hours |
| Shift 2026-10-24 23:00 → 2026-10-25 02:00 | Owns 2026-10-24; included whole in range 24–24, excluded from 25–25 |
| Shift 2026-10-25 00:00 → 02:00 | Owns 2026-10-25 |
| 2026-01-02T05:59:59Z / 06:00:00Z | Chicago business dates 2026-01-01 / 2026-01-02 |
| 2026-07-02T04:59:59Z / 05:00:00Z | Chicago business dates 2026-07-01 / 2026-07-02 |
| Spring 2026-03-08T07:59:59Z → 08:00:00Z | Both date 2026-03-08; local clock jumps 01:59:59 → 03:00:00 |
| Fall 2026-11-01T06:30:00Z / 07:30:00Z | Both date 2026-11-01; repeated 01:30 needs explicit offset to identify an instant |
| Local timestamp 2026-03-08 02:30 / 2026-11-01 01:30 | Invalid spring gap / ambiguous fall hour: visible review, never guess an instant |
| Selected Wednesday 2026-10-21 | Week begins Sunday 2026-10-18; worksheet weekday WED |
| Source regular 7.5, overtime 0.5, total 8 | Preserve all three values; no payroll-policy recalculation |

Source local timestamps need a supported explicit format, validated calendar/time parts and context. Unrecognized, missing, reversed or ambiguous timestamps remain visible exceptions. Offset-bearing timestamps convert to Chicago dates; timestamp-free date labels remain calendar dates and must not shift through UTC. A numeric Excel serial is not inferred to be a timestamp without an identified date field.

Verification: `node --import jiti/register --test scripts/business-dates.test.ts`. This checks normative examples against Intl Chicago conversion and existing scheduler helpers; consumers add fixture/UI checks. It does not test a live service.

Language, keyboard and output: persisted ISO dates/rules are language independent; consuming interfaces translate explanations and expose exceptions by keyboard/touch. Existing workbook sheets/AM/PM and source regular/overtime values remain unchanged. This decision adds no print screen or backend mutation.

Recovery/reversal: supersede this dated record with another version and identify affected imports/schedules. Preserve source text, reviewed overrides, prior exports and selected dates; never silently rewrite historical business dates. No cloud operation, migration or automatic deletion is part of this decision.
