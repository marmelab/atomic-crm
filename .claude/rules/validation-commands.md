---
paths: []
---

# Validation commands — DO NOT RUN

Validation is automated:
- The `validate-on-stop.mjs` SubagentStop hook runs the full chain (prettier auto-fix, typecheck, unit, e2e) after every developer stop (ticket or lightweight MODE). A failed validation rejects the stop, the developer's internal loop fixes the issue, and only a green stop returns control to the orchestrator.
- The `bash-guard.mjs` PreToolUse hook blocks `developer`, `quality-reviewer` from running them manually.
- Prettier is auto-applied and committed by the validation chain — formatting never needs manual action unless a file has a syntax error.

## Forbidden commands (developer / quality-reviewer)

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
- Duplicates hook work — the validation hooks already run them; failures appear in stderr.

## What to do instead

- **Developer**: after implementation + commit, stop. Hooks run, inject failures via stderr if any. Fix and commit again on the next turn. Don't run the merge yourself — that's the merger's job.
- **Reviewers**: focus on what hooks can't check (semantic review, integration wiring, e2e spec presence). To verify TypeScript, `Read` the source — don't run the compiler.
