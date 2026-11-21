---
name: aparna-loop
description: Start or close one build session of the Aparna's English Coaching CRM (MVP slices M0-M5, full-build slices S1-S10). Use at the START of every session (orient, run checks, confirm the slice and its owned files) and at the END of every slice (evidence, passes, logs, encode fixes, commit, PR). Trigger on "/aparna-loop", "start session", "next slice", "close the loop", "wrap up".
---

# aparna-loop

One session = one slice = one branch = one PR. Handoff between sessions = `features.json` + `progress.md` + git history (long-running-agent pattern). Cloud sessions have Docker: run the local stack; the GitHub Actions `Check` run on the PR is the second, independent verifier.

## START

1. `pwd`, `git status --short`, `git branch --show-current`, `git log --oneline -10`.
2. Read, and nothing else yet: the last entry of `docs/aparna/progress.md`; the features of the requested slice in `docs/aparna/features.json`; the slice row and file ownership in `docs/aparna/MVP.md` §7 (MVP track) or `project_plan.md` §3 (full build); for full-build slices also `TRANSITION.md`.
3. Check dependencies: every slice this one depends on is merged into `main` (`git log origin/main`). If not, stop and say which.
4. Install and run baseline checks: `npm ci` (if `node_modules` is missing), `npx playwright install chromium`; if `docker info` fails, start Docker (`sudo service docker start` or `sudo dockerd > /tmp/dockerd.log 2>&1 &`); `make start` (run it in the background; it pulls images on the first run); then `make typecheck`, `make lint`, `make test`. If Docker cannot start, say so and follow the ADR-A15 fallback. Never build on a red baseline: report and stop.
5. Report in ≤ 10 lines: branch, last session, baseline status, slice and feature IDs, files this slice owns, open questions. Then produce the plan (no edits) and wait for "go".

## CLOSE

1. Run every `cmd:` verify and, for `ci:` features, the same check locally first (`npx supabase test db`, the named e2e spec). Quote the decisive output lines.
2. Commit, push the branch, open a PR titled `[<slice>] <summary>` (use `gh pr create` if available, otherwise the session's PR button). The PR body lists feature IDs and what to check on the Vercel Preview.
3. Wait for the GitHub Actions `Check` run (`gh pr checks --watch` if available). If red: fix, push, repeat (max 3 rounds on the same cause, then stop and ask).
4. In `features.json` change ONLY `passes` → true for features whose `cmd:` or `ci:` verify is green now. `manual:` features stay false until the human confirms.
5. Append one entry to `docs/aparna/progress.md` (≤ 15 lines): date, slice, PR link, features passed with evidence, preview checklist for the human, next step.
6. Choice with alternatives made → ADR in `decisions.md` (Proposed). Failure, surprise or human correction → row in `problems.md` with "encoded as", and encode at the strongest layer: hook or DB constraint > `.claude/rules/*.md` > line in `docs/aparna/CLAUDE-aparna.md` > skill edit.
7. User-visible changes → `docs/aparna/CHANGELOG.md` under Unreleased. Keep `CLAUDE-aparna.md` under 80 lines, facts only.
8. Commit these doc updates to the same PR. Tell the human: PR link, Preview URL to check, and the one thing to look at.

## Stop conditions

- Same verify red after 3 focused attempts → stop, log in `problems.md`, ask.
- The change needs a file owned by another slice, or contradicts an Accepted ADR → stop and ask.
- A step needs secrets or production access in the cloud session → stop; it belongs to CI or the human.
