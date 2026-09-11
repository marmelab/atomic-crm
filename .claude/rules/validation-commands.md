---
paths: []
---

# Validation commands: DO NOT RUN

Validation is automated and config-driven. The steps live in ONE place,
`harness.config.json` -> `validation.steps`, consumed by both the runner and the
guard, so they can never drift:

- `validate-on-stop.mjs` (SubagentStop) runs the whole chain after every
  developer / test-writer stop: the format step (prettier auto-fix + commit),
  typecheck, lint (eslint, scoped to the stop's changed files) and the unit steps.
  A failed step rejects the stop; the agent's internal loop fixes it and only a
  green stop returns control to the orchestrator.
  **e2e is NOT in this chain**: a ticket can legitimately be mid-feature, and the
  chain's `cwd:"repo"` steps run in the base-branch checkout, so a per-stop e2e run
  only ever tested code the ticket had not touched.
- `e2e-on-feature-review.mjs` (SubagentStop, `quality-reviewer`) is the ONLY place
  the e2e suite is launched. It fires on the `MODE: feature-review` stop, and only
  when that review APPROVED (it keys off the reviewer's own
  `FEATURE-quality-reviewer` flag, not a transcript read), then runs
  `.claude/scripts/e2e-smoke.sh` on the integrated `_session` worktree with an
  isolated slot-leased Supabase. The outcome lands in
  `<session_dir>/e2e-result.json` for the orchestrator to read. **No agent launches
  the suite, the orchestrator included**, and `bash-guard` enforces that for every
  caller. A stale result from an earlier round is dropped as soon as a feature review
  stops, so a missing file means "not run this round", never "passed earlier".
- `completion-invariant.mjs` (SubagentStop, `orchestrator`) is the backstop on the
  other end: reading that result is a prompt-level instruction, so stopping while it
  says `failed` gets the stop rejected once. Then it is allowed through, on its own
  budget and with no recovery marker, because a red suite is not an orphaned pipeline
  and "never wedge the pipeline" still holds.
- `bash-guard.mjs` (PreToolUse Bash) blocks `developer` / `quality-reviewer` from
  running those same commands manually, plus `validation.extraForbidden` (build,
  e2e). The forbidden set is DERIVED from `validation.steps`, not hardcoded here.

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
