# Staff unlock inside Hours

- Baseline: merged main `7656afe` (PR #200); branch `codex/hours-inline-unlock`.
- Locked Hours editors now offer a masked Staff password field and Unlock hours action. The existing shared unlock handler accepts the entered password and returns failures to the editor. Staff & rules retains its current unlock flow.
- Enter submits the password; failed checks leave Hours locked and show the error locally. A successful check clears the input, keeps the editor open and enables its controls. Unlocking does not apply hours. Accepted credentials remain in existing page-session state; no new persistence, backend endpoint or Worker deployment is introduced.
- Reuses the approved paper/teal form styling and adds English/Spanish labels. Earlier diagnostic notes and SQL helpers are excluded.

Validation: production build, `npx tsc --noEmit`, dictionary tests (3/3), SEO and whitespace checks pass. The complete `test-special-hours.py` workflow passes, including incorrect password, Enter-to-unlock, applying afterward with the manager token, subsequent editors remaining unlocked, no staff-password localStorage write, and a 320px Spanish week-level editor. `test-scheduler-views.py` also passes, retaining the existing Staff & rules unlock flow. Both browser scripts use the loopback static export and synthetic intercepted APIs.

Local visual inspection: 390px locked Hours editor. Temporary browser artifacts and logs are under `/tmp/cr-hours-unlock*`; no raw logs or screenshots are added to the PR. Physical-device review and live release remain pending. Only a website deployment is needed.
