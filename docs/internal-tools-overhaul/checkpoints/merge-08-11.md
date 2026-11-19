# Authorized merge integration — November 18, 2026 (Chicago)

The user requested **all open PRs merged**, superseding the earlier stop-before-merge instruction. The five open PRs were #192 (scheduler remove/refill), then #194/#195/#196/#197 (Steps 08–11). Codex preserved the original checkout's uncommitted work and used isolated worktrees. Merge order: #192 → #194 → #195 → #196 → #197. At this checkpoint #192/194/195/196 are merged; #197 contains the verified final integration and is authorized for merge. GitHub is authoritative for its subsequent merge and automatic deployment status. No manual deployment or backend migration was performed.

## Resolutions and resulting behavior

Both Sales and Hours retain Files → Review → Report. Translation keys, source validation helpers, download/report helpers and all per-step checkpoint notes were combined. Hours keeps mapping-change invalidation, restored Review stage, directory editor restore epoch/session guards and checkpointed history transitions. Sales keeps its stage reset and editable restored reviewed values. Original source mappings, financial/payroll rules, cached workbooks and device/history readers remain compatible. The history hub browser regression now follows both staged converters, explicitly opening saved copies and generating before download. Inventory's additive device metadata and the scheduler's draft-only exclusions are preserved.

A 320px enlarged Spanish history check exposed the native fieldset/control minimum width. The history/comparison filter group and children now shrink within their grid; controls have explicit minimum/maximum widths. This CSS fix is included here, after #196. The history and comparison browser checks pass after the fix. The initial failure is retained separately as `checks/history-overflow-before-fix.txt`; final passing logs are retained below.

## Observed checks

All use the actual combined source, with `NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 NEXT_PUBLIC_AGENT_API= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_BASE_PATH=` for the production build. No API fallback to a live service.

| Check | Result |
| --- | --- |
| `npm run scheduler:test` | 216 pass, including remove/exclusion/refill |
| `npm run imports:test` | 56 pass, preserving both sales additions and history checkpoint tests |
| `npm run cashout:test` | 45 pass |
| `npm run internal:session:test` / `npm run recovery:test` | 7 / 7 pass |
| `node --import jiti/register --test src/lib/internal-tools/i18n/i18n.test.ts src/lib/internal-tools/contracts.test.ts` | 9 pass |
| `npm run imports:worker:test` | 5 pass against local synthetic Worker/D1; Worker code unchanged by final inventory/CSS merge |
| `npm exec tsc -- --noEmit`; production `npm run build`; `npm run seo:check` | pass |
| `scripts/test-import-review.py` | Sales review/stages, cash/retries/cancellation, independent cells/cache and layouts pass |
| `scripts/test-import-hours-stages.py` | Hours stages/identity, restore/directory guards, independent cells/cache, keyboard/layout/print pass |
| `scripts/test-import-history-hub.py` | Exact pagination, staged resume/checkpoint/cancel/quota, independent cells/cache and stale-session protections pass |
| `scripts/test-import-comparison.py` | Coverage/mappings/OFF zero/totals/quarantine/reload/lock/English PDF pass |
| `scripts/test-inventory-counting.py` | Ten state/progress/catalog/recovery/wire/print/layout scenarios pass |
| `scripts/test-scheduler-planning.py --url http://127.0.0.1:3051 --artifacts /tmp/cr-merge-final-planning-screens` | Full planning regression, including remove-and-refill/Allow again/Undo, pass; external guard: zero attempts |

Browser runner: `/tmp/cr-merge-venv/bin/python`, `LD_LIBRARY_PATH=/tmp/cr-merge-browser-libs/root/usr/lib/x86_64-linux-gnu`, Chromium 158.0.8127.18, static server `scripts/overhaul-baseline/serve.py --port 3051`. Custom scripts run through the retained artifact-relocation runner, with loopback origin as the final argument. The scheduler script runs through `scripts/overhaul-baseline/run-existing.py`. Test data is synthetic; output assertions and selected 1440/768/390/320px/enlarged/English-print evidence are retained in [merge evidence](../evidence/merge-08-11/README.md). Earlier individual PR evidence remains the fuller per-step record. Physical touch/software keyboards, staff review and live data/service verification remain unperformed.

## REA provenance and limits

Final `rea-project analyze /home/unusn/CR-step11/out/_next/static/chunks --project /home/unusn/CR-step11` selected four exact artifact-relative sources using repeated `--source-path`: 656f3081f24b40b0.js, b807637abd5f967d.js, 4226749012315f4c.js, cf8b9e3296b954c4.js. Raw run `.rea/runs/20261119T005656.502190Z-e86d7819/`, parent Evidence `ev_9e1223fd56040d7c177bf6e46802c5c17a80cb823b2099bb628a6ed5d1305135`, summary Evidence `ev_340c6ccd0c7ceba4b8ab3136dd95541f0c4eae3883203229474332c35081d6d3`; artifact directory SHA-256 `4fd27eded68c3d082c3d224a116426c42f10848545f39012bd29ab6ed60963ba`. Summary was read first. Four JavaScript files parsed as inert text, 0 parse failures, 38 inventoried files outside selected analysis. Application/semantic coverage is partial: 38 application and 27121 semantic unknowns, including the retained semantic alias-selection cap. Dynamic/unselected relationships and equivalence remain unknown; static analysis did not execute bootstrap code.

Five separately retained passive CDP observations identify Sales, Hours, History, Comparison and Inventory targets on local port 3051. Their Evidence IDs, browser/target identities, timestamps, origin policy, limits and completeness are in [observations](../evidence/merge-08-11/rea/observations.json) and the adjacent raw observation JSON. Playwright action assertions are separate from these passive snapshots. Neither mocks nor passive observations prove deployed persistence, shared inventory completion, or immutable historical schedule times.

## Remaining gates and rollback

Owner authorized code merges. Physical-device/staff acceptance, backend activation for gated capabilities and live verification remain separate. PR branch CI is not configured; GitHub Pages workflows start automatically on main merges. Existing workflows for #192/#194/#195/#196 succeeded during integration; the final #197 workflow is checked separately after merge.

Rollback a specific merge through normal reviewed Git history; retain device draft keys, inventory envelopes/archives, raw recovery bytes, immutable import records and stable item/employee IDs. No record deletion, data migration, guessed units or Step 12 ordering work was introduced.
