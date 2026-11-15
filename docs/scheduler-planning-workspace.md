# Planning workspace

The scheduler has an opt-in **Planning workspace** at the existing
`/scheduler-demo/:restaurantId` URLs. Choose it in **Layout** after unlocking the
scheduler. Current remains the default; stored Current/Classic preferences remain
valid. Choosing a layout remembers only that preference, never a manager code.

The workspace uses real station/week data. Its Sunday-first board, Team cards,
contextual person editor, employee colors, AM/PM icons, and Keep/Adjusted markers
follow the standalone prototype. Dates, positions, optional coverage and times
come from the selected station's actual rules. The scheduler now uses the
dedicated utility shell, without the public site's navigation/footer.

Time-off requests are secondary tools, not a prerequisite for planning. Moving,
adjusting and generating work once staff and shift rules have loaded, even when
the optional request service is unavailable or unconfigured. Scheduling uses any
approved requests already loaded, alongside the existing staff availability.

## Planning and Undo

- **Make schedule** uses the existing generation strategies. **Adjust schedule**
  repairs the current draft, prioritizing required coverage, fewer changed spots,
  then balanced hours. Existing priorities/preferences order equivalent choices.
- Auto-adjust starts on each visit. A manual placement becomes Keep. Occupied
  destinations release their former occupant for repair rather than forcing a
  swap. A kept source can be deliberately moved; a kept destination must first be
  released. Current/Classic retain their existing swap behavior during this trial.
- A placement and all resulting repairs are one Undo transaction. Releasing Keep
  or clearing one assignment does not immediately refill it. With Auto-adjust
  off, moves can leave explicit gaps until Adjust is pressed.
- Repair never relaxes hard constraints or silently removes an unrelated invalid
  Keep. It can move valid optional cover to satisfy required coverage; missing
  optional spots never count as required gaps. A valid covered week is unchanged.
- Search is limited to 6,000 nodes or roughly one second, yielding every 64
  visited nodes. A limit warning accompanies the best valid result found. This is
  a bounded search, not a guarantee of global optimality or infeasibility.
- Pending jobs carry the initiating station/week/draft/request context. Layout
  or week navigation, edits, Undo, or changed constraints cancel/discard stale
  results. Generation and accepted assistant proposals share the draft history.

Draft assignments and Keeps still use the existing session lifecycle. This change
does not add backend draft storage or change the golden-week payload. Reloading
reconstructs assignments from the published schedule; private Keep marks are not
part of that payload. Publish remains explicit and uses existing revision,
visibility, setup-saving and conflict handling.

## Callouts and employee settings

Click an assigned name, choose **Edit person**, then **Record callout /
availability request**. The existing request form opens for that employee/date.
An unfinished request is retained instead of being overwritten by another shortcut.
Cancel closes the entry without changing staff records.

Pending/declined requests do not change availability. A confirmed local approval
reconciles affected assignments in the current workspace/week and, if enabled,
repairs the draft. Newly unavailable affected Keeps are explicitly reported as
released. A failed or uncertain save does not trigger repair; retry retains the
same operation identity. Confirming the approval through the existing reload
recovery path can also reconcile it once.

**Undo restores the board, not a saved approval.** Restored assignments can
therefore show availability conflicts. Release an invalid Keep or edit the draft
before adjusting again. Reloading an approval from another editor updates checks
and offers Adjust without silently rearranging the board.

Recurring availability and employee rules remain in **Staff & rules**, opened for
the selected employee. CR3 Kitchen's separate staff password and shared-crew scope
are preserved. Approved requests are effective dated overlays, not edits to that
shared crew. No request API, schema, Worker deployment, or permission change is
introduced.

## Validation

Run the existing npm build, TypeScript, SEO, scheduler, request, assistant and
session checks. The agent's installed SQLite binary requires Node 22 in this
workspace; use that runtime for `agent:test`.

After building, serve `out/` on a loopback port and run:

```sh
python scripts/test-scheduler-planning.py --url http://127.0.0.1:3064
python scripts/test-scheduler-views.py --url http://127.0.0.1:3064
python scripts/test-schedule-requests.py --url http://127.0.0.1:3064
```

The planning browser fixture intercepts every API call and blocks other external
requests. It covers native drag and keyboard placement, multiple Keeps, rejection
without mutation, approval/retry, Undo with saved approval, publication conflicts,
layout/language retention, kitchen access, printing, external revisions and stale
repair cancellation. It checks 320px, 390px, tablet and desktop layouts. Domain
tests also exercise a 56-position synthetic kitchen week, optional coverage,
conflicting Keeps, bounded search and cancellation.

This is local implementation/verification, not manager usability testing or
production activation. Keep the opt-in choice until managers have tried real
rosters. The original `/scheduler-prototype` remains unchanged as a reference.

[Local verification and screenshots](internal-tools-overhaul/evidence/scheduler-planning-workspace/README.md)
record the tested implementation checkpoint.

Employee colors are allocated without repeats and remain stable through moves, filtering and staff/week changes during the visit. Each assigned spot has an open/closed lock icon to toggle Keep directly. Colored role badges identify positions separately from employee colors. A drop onto the same employee’s existing assignment leaves both shifts and Undo history unchanged.

**Remove from this shift** (spot menu or side panel) clears the spot, including a Keep, and marks that employee as not considered for that position on that date and shift. With Auto-adjust on, the draft is repaired in the same Undo step; with it off, the spot stays open until Adjust. Repair and Adjust skip the employee for any spot with that date/shift/role, and drop such an unkept assignment. The side panel lists excluded people with **Allow again**; deliberately placing the employee there also lifts it. Exclusions are part of the draft and Undo history, not the published payload, and **Make schedule** does not yet honor them.
