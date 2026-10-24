# Focused scheduler views

Research and implementation decision, October 24, 2026.

Managers reported that the scheduler was too busy and asked to separate employee
parameters from the actual schedule. The existing Staff and Shift rules buttons
changed the main content, but generation, publishing, and reset controls stayed
above every section. The week selector only appeared on Schedule even though
employee settings and shift rules are scoped to that week.

## Decision

Use two clearly labeled views in the existing manager workspace:

| View | Main job | Controls |
| --- | --- | --- |
| Schedule (default) | Build, review, and publish a week | Make schedule, Publish to staff, Undo; other actions in More actions |
| Employee settings | Maintain availability, qualifications, and limits | Add employee, Save changes, Undo, Back to schedule; Shift rules and Staff list tools are expandable |

Keep the station and selected week above both views. Keep both panels mounted,
with only the selected panel visible, so switching preserves entered values,
search, expanded availability controls, draft employees, and assignments. Show an
explicit unsaved indicator on Employee settings and a review action on Schedule.
Switching views does not save or publish. Leaving the page still uses the existing
unsaved-work warning.

Shift rules remain in Employee settings as a secondary disclosure. Validation
errors are visible even when it is closed, with a button that opens and focuses
the rules. CR3 Kitchen still requires the staff password to edit its shared crew
or weekly rules; its scope explanation distinguishes those two behaviors.

## Research and tradeoffs

- [GOV.UK: Tabs](https://design-system.service.gov.uk/components/tabs/) supports
  related sections that repeat users need to switch between, with short labels
  and the most-used section first. It also cautions that tabs hide content and
  should be tested with the intended audience. These managers repeatedly work on
  the same station and week, so two persistent, visible choices fit this task.
- [NN/g: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends showing frequent actions first and making specialized actions
  available through clearly named secondary controls. Build and publish stay
  visible; generation preferences, month controls, restore/clear/snapshot tools,
  and shift-rule editing take less space until needed.
- [GOV.UK: Details](https://design-system.service.gov.uk/components/details/)
  recommends disclosures for secondary information rather than content most
  users need. The schedule and employee list each get a full view; optional
  tools and instructions use disclosures.
- [W3C: Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  supplies the interaction model: linked tab/panel roles, selected state, one
  tab stop in the tab list, Left/Right arrows, Home/End, and visible focus.

Two separate route pages would require moving or persisting the scheduler's
in-memory drafts, undo history, and password state to avoid losing work during
navigation. This change keeps the established data and authorization lifecycle.
A wizard would impose an order on tasks that managers revisit freely. A drawer
would constrain the employee editor, especially on phones. The two-view design
is an evidence-informed recommendation; it has not been usability-tested with
the managers.

## Verification

Run `npm run build`, `npm run scheduler:test`, `npm run seo:check`, and
`npm exec tsc -- --noEmit`. Browser regression coverage is in
`scripts/test-scheduler-views.py` (requires Python Playwright and Chromium):

```bash
python .codex/skills/webapp-testing/scripts/with_server.py \
  --server 'python -m http.server 3010 --bind 127.0.0.1 --directory out' \
  --port 3010 -- python scripts/test-scheduler-views.py
```

The browser checks intercept API calls with synthetic employees and shifts and
block other external requests. They cover view-specific actions, keyboard
navigation, edit retention, save conflict/retry, shared week selection,
generation/publication, kitchen locking, print output, and horizontal overflow
at 320, 375, and 768 pixels. Screenshots go to `/tmp/cr-scheduler-views`.

For a manager walkthrough, ask someone to change an employee's availability,
return to the same week's schedule, generate it, and publish it without coaching.
Check whether they can find Shift rules and explain when changes are saved.
Record their observations before deciding on further simplification.
