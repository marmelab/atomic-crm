---
paths: []
---

# Validation commands — DO NOT RUN

Validation is automated:
- `SubagentStop` hooks run typecheck / prettier / unit / e2e after every developer stops.
- `validate-before-review` PreToolUse hook re-runs them when a COMPLEX dev SendMessages a reviewer or merger.
- `block-bash-validation` PreToolUse hook blocks `developer`, `quality-reviewer`, `test-validator` from running them manually.

## Forbidden commands (developer / quality-reviewer / test-validator)

| Category | Commands |
|---|---|
| typecheck | `make typecheck`, `npm run typecheck`, `npx tsc`, `npx tsc --noEmit` |
| prettier | `make lint`, `npm run prettier`, `npm run prettier:apply`, `npx prettier` |
| unit tests | `npm run test:unit:app`, `npm run test:unit:functions`, `npm test`, `npx vitest`, `make test-unit*` |
| e2e | `npx playwright test`, `make test-e2e*` |
| lint | `npm run lint`, `npm run lint:typescript` |
| build | `npx vite build`, `npm run build` |

Why blocked:
- Burns tool budget — each call returns a hook block error.
- Can hang — `npx vitest` launches a headed Chromium browser; without a display it waits forever. Hooks set `CI=true` to force `chromium-headless-shell`; manual calls don't.
- Duplicates hook work — `SubagentStop` already runs them after you stop; failures appear in stderr.

## What to do instead

- **Developer**: after implementation + commit, stop. Hooks run, inject failures via stderr if any. Fix and commit again on the next turn. Don't run the merge yourself — that's the merger's job.
- **Reviewers**: focus on what hooks can't check (semantic review, integration wiring, e2e spec presence). To verify TypeScript, `Read` the source — don't run the compiler.
