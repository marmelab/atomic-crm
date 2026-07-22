---
paths: []
---

# Validation commands: DO NOT RUN

Validation is automated and config-driven. The steps live in ONE place,
`harness.config.json` -> `validation.steps`, consumed by both the runner and the
guard, so they can never drift:

- `validate-on-stop.mjs` (SubagentStop) runs the whole chain after every
  developer / test-writer stop: the format step (prettier auto-fix + commit),
  typecheck, lint (eslint, scoped to the stop's changed files), the unit steps,
  then e2e once in the repo (full mode only). A failed step rejects the stop; the
  agent's internal loop fixes it and only a green stop returns control to the
  orchestrator.
- `bash-guard.mjs` (PreToolUse Bash) blocks `developer` / `quality-reviewer` from
  running those same commands manually, plus `validation.extraForbidden` (build).
  The forbidden set is DERIVED from `validation.steps`, not hardcoded here.

## Why blocked (developer / quality-reviewer)

- Burns tool budget: each manual call the hook already runs is wasted.
- Can hang: `npx vitest` launches a headed Chromium; without a display it waits
  forever. The hooks set `CI=true` to force `chromium-headless-shell`; manual
  calls do not.
- Duplicates hook work: the validation hooks already run these; failures come back
  on stderr.

To change what runs (or what is forbidden), edit `harness.config.json`, never a
command string in a hook or in this file.

## What to do instead

- **Developer / test-writer**: after implementation + commit, stop. The hooks
  run and inject any failures via stderr. Fix and commit again next turn. Do not
  run the merge yourself: that is the merger's job.
- **Reviewers**: focus on what hooks can't check (semantic review, integration
  wiring, e2e spec presence). To verify TypeScript, `Read` the source, do not run
  the compiler.
