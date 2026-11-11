# Step 02 local review evidence

Source baseline: main `b800af4`; implementation branch
`feat/overhaul-step-02-primitives`. [Checkpoint](../../checkpoints/step-02.md) records
scope, gates, exact commands and remaining limits. [Module API](../../../../src/components/internal/ui/README.md)
describes opt-in adoption. Existing tools keep their default appearance; this is
not the Step 03 navigation shell.

The gallery at `/internal/ui-gallery` is unlinked and noindex/nofollow. It uses
synthetic fields and local React preview state, with no record/auth/draft API
adapter. “Save states · Examples” is a static catalog; Preview save explicitly says
no record was saved. Its PDF retains the synthetic-preview label.

[results.json](results.json) contains the base commit, SHA-256 of the 13 actual
source/test files used for the run, viewport sizes, screenshot hashes, rendered
palette/font observations and scenario results. This distinguishes the uncommitted
implementation source from the base SHA. No actual service activation is inferred.

| Review case | Evidence | Actual observation |
| --- | --- | --- |
| Desktop navigation | [Hover](navigation-hover-desktop.png) | Single red surface follows Forms while the independent Cash selection marker remains |
| Error/focus | [Invalid amount](field-error-desktop.png) | Raw -3, linked hint/error, persistent border and warning, visible independent focus |
| Spanish desktop | [1440px](gallery-es-1440.png) | Paper hierarchy, long translated action, input values retained |
| Spanish phone | [375px](gallery-es-375.png), [320px](gallery-es-320.png) | Reflow, full labels/actions, same record-shaped preview values, aligned navigation |
| Enlarged text | [320px / 200%](gallery-es-large-text-320.png) | Long Spanish labels and language buttons wrap; no horizontal page overflow |
| Reduced motion | [Phone](gallery-reduced-motion-phone.png) | No slide/press translation; final surface and selection remain |
| Print | [Synthetic PDF](gallery-print.pdf) | Preview label, name and amount retained; controls, navigation and decorative shadow hidden |

Agent visual comparison used the approved [desktop](../../../design/internal-language/previews/depth-paper.png),
[phone](../../../design/internal-language/previews/depth-cash-phone.png),
[navigation](../../../design/internal-language/previews/navigation-hover.png) and
[error/control anatomy](../../../design/internal-language/reference.html#components).
No bank file changed.

Bank checklist, as locally observed:

- Layered paper / Patina teal, correct public red, scoped font/token/icon reuse.
- Strongest shadow/registration framing on active paper; supporting panel lighter.
- Direct labels, stable synthetic context, one primary preview action and explicit output scope.
- Pointer, native keyboard and touch-emulated control operation; visible focus.
- One red navigation surface, current marker retained, 220ms normal / 0s reduced motion.
- Narrow widths, 200% text, long Spanish actions and large amount specimen reflow.
- EN/ES preserves input; synthetic print remains labelled; existing output checks pass.
- Domain formulas, records, validation/access adapters and source draft readers preserved.

[203 domain/contract test results](checks/domain-results.json),
[six existing browser regressions](checks/browser-regressions.json),
[gallery result](checks/primitives-browser.txt), [build](checks/build.txt),
[types](checks/types.txt) and [SEO](checks/seo.txt) are actual local outputs.
Portable text logs normalize terminal line endings/trailing spaces; raw logs remain
in the worktree's ignored `.rea/step02-checks/`.

Replay on a provisioned Playwright host:

```sh
npm ci --no-audit --no-fund
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py --port 3029
# In a separate terminal, with Step 01's pinned Python requirements:
/tmp/cr-step01-venv/bin/python scripts/test-internal-primitives.py http://127.0.0.1:3029 --artifacts /tmp/new-step02-review
```

On this host, browser commands additionally used
`LD_LIBRARY_PATH=/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu` for
previously extracted libraries. No Worker must be listening. The gallery harness
aborts and fails on any API/external request, blocks service workers, and uses new
profiles. Existing regression scripts use their own intercepted loopback fixtures
under Step 01's guard. Do not run seed/migration scripts against default endpoints.

[REA browser summary](rea-browser-summary.json) preserves passive attach identity
and limits. [REA emitted-module summary](rea-bundle-summary.json) identifies the
local build and one selected gallery chunk. Static relationships remain partial;
no complete application reconstruction, earlier network history or live behavior
is claimed. Full raw evidence/diagnostics remain under this worktree's `.rea/runs/`.

Real touch/software keyboard, staff acceptance, full accessibility conformance and
production persistence/services are unverified. Existing Step 01 live/encrypted-link
limits remain. This review unit performs no deploy, merge, data migration or Step 03 work.
