---
name: aparna-loop
description: Start or close one build session of the Aparna's English Coaching CRM. Use at the START of every session (orient, run checks, pick the next slice) and at the END of every session or slice (record evidence, flip passes, log decisions, problems and changes, encode fixes, commit). Trigger on "/aparna-loop", "start session", "next slice", "close the loop", "wrap up".
---

# aparna-loop

One loop = one slice from `docs/aparna/project_plan.md`. This skill is the handoff between sessions (long-running-agent pattern: feature list + progress file + git history).

## START

1. `pwd` and `git status --short` and `git branch --show-current`. If not on a `slice/S<n>-<slug>` branch for the slice you will work on, create it from the latest `main`.
2. Read, in this order and nothing else yet: the last entry of `docs/aparna/progress.md`, `docs/aparna/features.json` (only features where `passes` is false), `git log --oneline -10`.
3. Run the baseline checks: `make typecheck`, `make test`. If the local stack is up, also `npx supabase test db`. If anything is red on a clean branch, fix that first or stop and report. Never build on red.
4. Name the next slice: the lowest slice in the phase graph whose dependencies are done and that still has `passes: false` features. Check any open question it needs (PRD §14) is answered; if not, stop and ask.
5. Report in ≤10 lines: branch, last session summary, checks status, chosen slice, its feature IDs, blocking questions. Then wait for the human to enter plan mode for the slice.

## CLOSE

1. For each feature worked on, run its `verify` command. Quote the decisive lines of output.
2. In `features.json` change ONLY `passes` (false → true) for features whose verify ran green now. Never edit any other field.
3. Append one entry to `docs/aparna/progress.md` (≤15 lines): date, slice, what changed, features passed with the quoted evidence, what is left, next step.
4. If a choice with alternatives was made: add an ADR to `docs/aparna/decisions.md` (context, options, decision, consequences, reversal condition). Do not mark it Accepted; the human does that.
5. If anything failed, surprised you, or the human corrected you: add a row to `docs/aparna/problems.md` with an "encoded as" column, and encode the fix at the strongest layer that holds it: hook or DB constraint > `.claude/rules/*.md` > a line in `docs/aparna/CLAUDE-aparna.md` (Gotchas or Mistakes Log) > a skill edit. A row without "encoded as" stays open.
6. Add user-visible changes to `docs/aparna/CHANGELOG.md` under an Unreleased heading.
7. Re-check `docs/aparna/CLAUDE-aparna.md` is still under 80 lines and contains facts only.
8. Commit on the slice branch: `feat(S<n>): <summary>` with feature IDs in the body. Do not push to `main`. Tell the human the branch is ready for review.

## Stop conditions

- Any verify red after 3 focused attempts on the same cause → stop, log in `problems.md`, ask.
- A required change contradicts an Accepted ADR → stop, propose a new ADR, ask.
