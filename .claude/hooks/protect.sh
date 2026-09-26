#!/bin/bash
# Blocks edits to human-owned files: tests, curated data, hooks, settings. Works on macOS/Linux and Windows (Git Bash).
PY=python3
$PY -c "" >/dev/null 2>&1 || PY=python
FILE=$($PY -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path","").replace("\\","/"))
except Exception:
    print("")')
case "$FILE" in
  *tests/*|*data/drugs.json|*data/demo_patient.json|*.claude/hooks/*|*.claude/settings.json)
    echo "BLOCKED: $FILE is human-owned (tests, curated data, hooks). Do not modify it. If you think it is wrong, add a 'TEST CONCERN' entry to DECISIONS.md and continue with other work." >&2
    exit 2 ;;
esac
exit 0
