#!/bin/bash
# Stop gate: Claude cannot finish while tests for the active phases fail.
# Active phases are listed in .claude/phases (e.g. "1 2 3").
# Escape hatch for normal chatting: touch .claude/gate_off
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f .claude/gate_off ] && exit 0
PHASES=$(cat .claude/phases 2>/dev/null)
[ -z "$PHASES" ] && exit 0

PYTEST=pytest
[ -x .venv/bin/pytest ] && PYTEST=.venv/bin/pytest
[ -f .venv/Scripts/pytest.exe ] && PYTEST=.venv/Scripts/pytest.exe   # Windows venv

FILES=""
for p in $PHASES; do
  for f in tests/test_phase${p}_*.py; do [ -f "$f" ] && FILES="$FILES $f"; done
done

LOG=.claude/.gate.log
: > "$LOG"
OK=1
if [ -n "$FILES" ]; then
  $PYTEST -q $FILES >> "$LOG" 2>&1 || OK=0
fi
if [ $OK -eq 1 ] && echo " $PHASES " | grep -q " 4 " && [ -f web/package.json ]; then
  (cd web && npm run build) >> "$LOG" 2>&1 || OK=0
fi

COUNT=.claude/.gate_count
n=$(cat "$COUNT" 2>/dev/null || echo 0)
if [ $OK -eq 1 ]; then echo 0 > "$COUNT"; exit 0; fi

n=$((n+1)); echo $n > "$COUNT"
if [ $n -gt 8 ]; then
  echo 0 > "$COUNT"; exit 0          # give up; human reviews .claude/.gate.log
fi
if [ $n -eq 8 ]; then
  echo "GATE: 8th failed attempt. Write a short summary of what is still failing and why in DECISIONS.md, then stop." >&2
  exit 2
fi
echo "GATE: tests for phases [$PHASES] are failing (attempt $n/8). Fix the CODE, never the tests. Last output:" >&2
tail -40 "$LOG" >&2
exit 2
