#!/usr/bin/env bash
# Stop hook: block "done" until fast checks pass.  exit 0 = allow stop, exit 2 = block (stderr -> Claude).
# Also run as a SessionStart hook with --record-base to remember the starting commit.
# Off switch for humans: `touch .claude/gate-off` (gitignored); remove it to re-enable.
set -uo pipefail
INPUT=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

SID=$(jq -r '.session_id // "nosession"' <<<"$INPUT" 2>/dev/null || echo nosession)
STATE_DIR="${XDG_RUNTIME_DIR:-/tmp}/claude-verify-gate"; mkdir -p "$STATE_DIR"
BASE_FILE="$STATE_DIR/base-$SID"; COUNT_FILE="$STATE_DIR/blocks-$SID"

if [ "${1:-}" = "--record-base" ]; then git rev-parse HEAD > "$BASE_FILE" 2>/dev/null; exit 0; fi

[ -f .claude/gate-off ] && exit 0

# FAST checks only (~25 s). `npm run check:full` adds the Worker suites (~65 s) and belongs in the step checkpoint.
CHECKS=(
  "npm run -s check"
)
TEST_PATHS=(':(glob)**/*.test.*' ':(glob)scripts/test-*.py')
MAX_BLOCKS="${VERIFY_GATE_MAX_BLOCKS:-6}"

# Did anything change this session? (dirty tree, or new commits since session start)
BASE=$(cat "$BASE_FILE" 2>/dev/null || true)
CHANGED=0
[ -n "$(git status --porcelain)" ] && CHANGED=1
if [ -n "$BASE" ]; then [ "$(git rev-parse HEAD)" != "$BASE" ] && CHANGED=1; else CHANGED=1; fi
[ "$CHANGED" = 0 ] && { rm -f "$COUNT_FILE"; exit 0; }

COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
if [ "$COUNT" -ge "$MAX_BLOCKS" ]; then
  rm -f "$COUNT_FILE"
  echo "{\"systemMessage\": \"verify-gate: checks still failing after $COUNT attempts; allowing stop for human review.\"}"
  exit 0
fi

block() { echo $((COUNT + 1)) > "$COUNT_FILE"; echo "verify-gate (attempt $((COUNT + 1))/$MAX_BLOCKS): $1" >&2; exit 2; }

# Optional tamper check (loop scripts turn it on): existing tests modified/deleted since session start.
if [ "${VERIFY_GATE_PROTECT_TESTS:-0}" = "1" ] && [ -n "$BASE" ]; then
  TAMPER=$(git diff --name-status "$BASE" -- "${TEST_PATHS[@]}" | awk '$1 ~ /^(M|D|R)/ {print $NF}')
  [ -n "$TAMPER" ] && block "existing test files were modified or deleted: $TAMPER. Restore them (git checkout $BASE -- <file>) and fix the code instead. If a test contradicts the spec, write that to BLOCKED.md and stop."
fi

LOG=$(mktemp)
for c in "${CHECKS[@]}"; do
  if ! bash -c "$c" >"$LOG" 2>&1; then
    OUT=$(tail -n 40 "$LOG"); rm -f "$LOG"
    block "'$c' failed. Fix the cause; do not skip, weaken or delete the check. Last 40 lines:
$OUT"
  fi
done
rm -f "$LOG" "$COUNT_FILE"
exit 0
