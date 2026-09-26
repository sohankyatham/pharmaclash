# PharmaClash: How to Start the Agent Loop

This kit makes Claude Code build the project while you do other work. Claude Code can't finish
a session until the tests for the current phase pass. It moves itself phase by phase and commits
after each one.

## What's in the kit

| File | Owner | Purpose |
|---|---|---|
| `CLAUDE.md` | you | Rules, architecture, exact engine rules, data contracts |
| `TASKS.md` | you | Six phases, each with a "done" definition |
| `tests/` | you (agent blocked) | Acceptance tests that decide "done" |
| `data/drugs.json` | you (agent blocked) | Curated 36-drug dataset with sources |
| `data/demo_patient.json` | you (agent blocked) | The 80-year-old demo patient and demo script |
| `.claude/settings.json` | you | Pre-approved safe commands + the two hooks |
| `.claude/hooks/gate.sh` | you | Stop gate: blocks "done" while tests fail (max 8 retries) |
| `.claude/hooks/protect.sh` | you | Blocks the agent from editing tests, data, and hooks |
| `.claude/phases` | agent | Which phases' tests the gate enforces (starts at `1`) |
| `DECISIONS.md` | agent | The agent logs assumptions and concerns here instead of asking you |

All tests have already been checked against a reference implementation, so every test can pass.

## One-time setup (about 10 minutes)

**Windows (no WSL needed):** install Git for Windows (git-scm.com); Claude Code uses its Git Bash to run the hooks. Run the setup commands below in **Git Bash**, with two changes: use `python` instead of `python3`, and activate with `source .venv/Scripts/activate`. Skip `chmod`.

macOS/Linux:

```bash
cd pharmaclash
git init && git add -A && git commit -m "starter kit"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # paste your OpenAI key into .env (optional until phase 3)
chmod +x .claude/hooks/*.sh
pytest -q tests/test_phase1_data.py   # should FAIL with "No module named pharmaclash"; that's expected
```

Optional: install the Playwright MCP so the agent can screenshot its own UI in phase 4:
```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```
If that syntax errors, run `claude mcp add --help`.

## Spot-check the data first (about 20 minutes, don't skip)

The agent can't catch wrong drug facts, because the tests trust the data. Check these first, since they appear in the demo: simvastatin, pravastatin, amlodipine, apixaban, citalopram, sertraline, oxybutynin, mirabegron, omeprazole, pantoprazole, nirmatrelvir_ritonavir (Paxlovid), clarithromycin, azithromycin.

Then check every field listed under an entry's `needs_review`. Those are the values I was least certain of, mostly anticholinergic (ACB) scores and some QT categories.

Where to check:
- CYP enzyme roles: the Flockhart Table (drug-interaction.medicine.iu.edu) and the FDA "Table of Substrates, Inhibitors and Inducers"
- QT risk: CredibleMeds (free account)
- Anticholinergic scores: the ACB scale
- Paxlovid interactions: the Paxlovid label, Drug Interactions section

You can edit `data/drugs.json` yourself; only the agent is blocked from it. If you change a value that a test depends on, re-run `pytest -q` to see what moved.

## Start the loop

1. Run `claude` in the project folder.
2. Enter plan mode (Shift+Tab) and paste:

   > Read CLAUDE.md, TASKS.md, data/drugs.json, and every file in tests/. Propose your plan for phases 1–3: files, functions, and the order you'll build them in. Don't write code yet.

3. Skim the plan for about 5 minutes. If it matches TASKS.md, exit plan mode and paste:

   > Execute phases 1 through 3 from TASKS.md. When you start each phase, append its number to .claude/phases; commit after it passes. Log every assumption in DECISIONS.md. Don't ask me questions. Stop after phase 3 passes.

4. Go study. Check in every 30–45 minutes.

## At each check-in (about 5 minutes)

```bash
git log --oneline        # which phases committed?
cat .claude/phases       # which phase is it on?
tail DECISIONS.md        # assumptions + any TEST CONCERN entries
cat .claude/.gate.log    # last test output, if it seems stuck
```

- **If it's stuck** (8 failed attempts, or the same error repeating): read `.claude/.gate.log` and the latest `DECISIONS.md` entry, then give one targeted hint.
- **If a `TEST CONCERN` appears:** read it. If the agent is right, fix the test or data yourself.
- **After phase 3:** run `uvicorn pharmaclash.api:app --reload` and open http://localhost:8000/docs to try the API.

## Phases 4–6 (frontend, evidence, ML)

Start the next run with:
> Execute phase 4 from TASKS.md.

For evidence and ML:
> Execute phases 5 and 6.

**Optional parallel speedup:** once phase 3 is committed, run the frontend and the ML work in separate git worktrees at the same time:
```bash
git worktree add ../pc-web -b web      # session A: echo "1 2 3 4" > .claude/phases, run phase 4
git worktree add ../pc-ml  -b ml       # session B: echo "1 2 3 5 6" > .claude/phases, run phases 5–6
```
Open a separate `claude` session in each folder, then merge both branches back when they're done.

## Useful switches

- **To chat with Claude Code without the gate forcing work** (for example, to ask questions): `touch .claude/gate_off`. Delete that file to turn the loop back on.
- **To make the gate enforce different phases:** edit `.claude/phases`.

## Things only you can do

1. Spot-check the data.
2. Judge whether the UI actually looks cool. Tests can't.
3. Rehearse the 3-minute demo (the script is in `data/demo_patient.json` and the project guide).
4. Record a backup demo video before judging.

## Demo numbers from the reference check (total risk)

| Regimen | Total risk |
|---|---|
| Demo patient | 13 |
| + Paxlovid | 41 |
| + clarithromycin | 80 |
| After "Fix this regimen" | 19 |

The fix makes five swaps: simvastatin→pravastatin, citalopram→sertraline, oxybutynin→mirabegron, omeprazole→pantoprazole, clarithromycin→azithromycin. Apixaban and amlodipine are flagged for a clinician's decision.
