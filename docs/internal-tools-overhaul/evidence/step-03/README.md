# Step 03 shell review evidence

Baseline main `6281dee`; branch `feat/overhaul-step-03-shell`, isolated worktree
`/home/unusn/CR-step03`. [Checkpoint](../../checkpoints/step-03.md) records gates,
commands, recovery and limits. No deploy, migration, seed, production write or
Step 04 implementation occurred.

The shell adds quiet identity, language/help/local-lock controls, read-only context,
and Dashboard/Cash/Inventory/Schedule/Reports/Forms links. Cash and Reports adapt
existing mounted Bookkeeping panels; Home/Reports restructuring remains Step 05.
Schedule keeps its original route/gate and now has an internal return link. The
public staff viewer and encrypted-record API contracts are unchanged.

| Review case | Evidence | Actual observation |
| --- | --- | --- |
| Dashboard | [Mouse](dashboard-pointer.png), [keyboard](dashboard-keyboard.png) | Six labelled real destinations; current item and independent red surface; existing dashboard remains |
| Cash desktop | [CR2](cash-cr2-desktop.png) | Actual store/date, one guarded Save draft and lock action; legacy entry surface preserved |
| Cash Spanish phone | [375px](cash-cr2-spanish-phone.png) | Header/rail reflow, long handoff label wraps, values and context retained |
| Form context | [Phone](forms-context-phone.png) | CR2/date from the actual form draft; narrative retained through local lock/unlock |
| Inventory context | [320px](inventory-cr3-phone.png) | CR3-only inventory labelled truthfully; raw mixed-unit count retention also asserted |
| Enlarged shell | [320px / 200%](shell-large-text-320.png) | Spanish controls/labels wrap without horizontal page overflow |
| Print | [Cash PDF](cash-print.pdf) | Shell hidden; synthetic cashier and $300 drawer retained; no output-policy change |

[results.json](results.json) records the base SHA, 40 actual implementation/test
source hashes, seven screenshot hashes, viewports, observations and intercepted
API paths. Fresh profiles contain synthetic values only. No token is written into
storage or URLs; original legacy cash draft bytes are explicitly preserved.
Source hashes identify the implementation above the base commit.
The [integrity result](checks/integrity.json) records hash, unchanged-bank, local
documentation-link and whitespace checks.

[255 domain/contract results](checks/domain-results.json), [10 browser regressions](checks/browser-regressions.json),
[shell result](checks/shell-browser.txt), [build](checks/build.txt), [types](checks/types.txt)
and [SEO](checks/seo.txt) are actual local outputs. Browser tests cover mouse/keyboard
navigation, old hashes, slash/HTML aliases, Back/Forward, skip focus, exact File
identity, canceled departure, quota denial, local lock, EN/ES, reflow, motion,
print and original scheduler/public links.

The [base-path result](checks/basepath-results.json) is a separate local Next dev
compilation using `NEXT_PUBLIC_BASE_PATH=/review` on port 3033. All six links carried
the prefix, Cash/Reports preserved the same-document sentinel, and Inventory
resolved correctly. This is not a production Pages redirect/hosting claim.

Replay with locked Node dependencies and Step 01's pinned Python requirements:

```sh
NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH= npm run build
python3 scripts/overhaul-baseline/serve.py --port 3031
# Separate terminal, new disposable output directory:
/tmp/cr-step01-venv/bin/python scripts/test-internal-shell.py http://127.0.0.1:3031 --artifacts /tmp/new-shell-review
```

This host additionally needed the existing disposable library prefix
`LD_LIBRARY_PATH=/tmp/cr-step01-browser-libs/root/usr/lib/x86_64-linux-gnu`.
No Worker must listen on 8787: test API replies are intercepted and writes refused;
external page requests abort/fail and service workers are blocked. This is browser
request isolation, not a host firewall. Existing browser suites use Step 01's guard
and their own synthetic adapters. Do not run production-default seed/verify scripts.

Portable [REA browser](rea-browser-summary.json) and [emitted shell-module](rea-bundle-summary.json)
summaries retain identities, coverage and limitations; raw evidence is in this
worktree's ignored `.rea/runs/`. Passive attach does not prove earlier activity;
selected static syntax does not prove execution. Playwright action assertions
are separate evidence. Text logs normalize terminal line endings/trailing spaces;
raw logs/development diagnostics remain in `.rea/step03-checks/`.

Physical touch/software keyboard, staff acceptance, full accessibility conformance,
live persistence/activation, production base-path redirects, and actual historical
encrypted-link browser decryption remain unverified. The shared manager session,
new cross-tool context lifecycle and a mutable global store selector are not part
of Step 03. Existing per-tool lock/guard behavior remains authoritative.
