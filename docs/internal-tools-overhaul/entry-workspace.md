# Keyboard and tablet entry (UX-04)

`EntryWorkspace` provides opt-in Enter and Shift+Enter navigation for `input[data-entry-field]`. Native Tab/Shift+Tab order is preserved, disabled/hidden fields are excluded and composing/modified Enter is ignored. The final forward Enter focuses the supplied finish button; it never activates Save. Cash-out has no drag-only action. Bookkeeping tabs use arrow/Home/End navigation with a single tab stop and preserve mounted cash/sales/hours panels.

The language shell measures its sticky banner with ResizeObserver. A summary sticks below the banner, including wrapped Spanish. Focus and VisualViewport resize/scroll events keep the active input below both banners and above the keyboard-sized visible bottom. Listeners and pending animation frames are removed on unmount. Inputs use 16px text, 44px screen targets and native numeric/decimal input modes. Print omits help/summary and retains compact field sizes and existing English output.

## Local verification

Use an isolated local Next server with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 npm run dev -- --hostname 127.0.0.1 --port 3027` then run:

- `python3 scripts/test-entry-workspace.py http://127.0.0.1:3027`
- `python3 scripts/test-cashout-context.py http://127.0.0.1:3027`
- `python3 scripts/test-internal-feedback.py http://127.0.0.1:3027`
- `python3 scripts/test-internal-language.py http://127.0.0.1:3027`
- `python3 scripts/test-internal-drafts.py http://127.0.0.1:3027`
- `npm run cashout:test`
- `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts`
- `npm exec tsc -- --noEmit`, `npm run build`, `npm run seo:check`, `git diff --check`

All passed locally on 2026-10-24. The new browser check covers forward/reverse navigation, no implicit write, canceled confirmations and focus return, touch/keyboard tabs, retained inputs, EN/ES, actual target measurements, a synthetic 430px VisualViewport with a 24px offset, phone width and print exclusion. Regression checks cover four store/date contexts, stale responses, denied storage and save feedback. API requests are synthetic loopback fixtures; production Worker requests fail the checks. Screenshots are transient `/tmp/ux-04-phone.png`, not personnel/cash evidence.

This is Chromium layout/interaction evidence. A physical tablet and native software keyboard were not exercised; shared-device staff tests and pilot remain REL-05/06. No Worker change, cloud operation, frontend publication or live guarantee is implied. Restore the previous UI commit to roll back while retaining all draft keys/source data.

The installed Next 16.1.6 package does not contain `dist/docs`. Before code, the exact-version upstream `docs/01-app/03-api-reference/01-directives/use-client.mdx` and `docs/01-app/02-guides/forms.mdx` were read from the official vercel/next.js v16.1.6 tag. This static-export implementation remains client-side and adds no Server Action or runtime dependency.
