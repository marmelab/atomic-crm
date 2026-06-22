---
paths: []
---

# Agent output format

All ticket agents are spawned one-shot (in the background) by the chat orchestrator. Each agent's last line of output is parsed by regex against an output contract. Anything else in the body is informational and ignored by the orchestrator's parser.

The developer and quality-reviewer read their ticket from `${TICKET_FILE}` (an absolute path passed in the spawn prompt). The merger additionally receives `${TICKETS_DIR}` (the per-session directory holding all ticket JSON files) so it can update the ticket's `status` field after a successful merge.

## Reviewer agent (quality-reviewer)

Last line of output MUST be exactly one of:

- `APPROVED`
- `REJECTED: <feedback>` — `<feedback>` is a bulleted list (one bullet per issue) the developer must address on retry. Be specific: file path + symptom + what to change.

Anything above the contract line is informational and discarded by the orchestrator. Warning-level findings that do not require a retry should not be emitted — write `APPROVED` and stop.

Any other shape is treated by the orchestrator as `REJECTED: <malformed reviewer output>`.

(The single-shot `migration-review` reviewer keeps its own `APPROVED` / `BLOCKED:` text contract — see quality-reviewer.md. The orchestrator parses that in the migration round, not with the wave parser above.)

## Developer agent

Last line of output MUST be exactly one of:

- `DONE: branch=<branch_name> commit=<short_sha> files=[<comma-separated paths>]`
- `FAILED: <one-line reason>`

When the spawn prompt includes a `RETRY_FEEDBACK=...` block, the developer is on a retry attempt: the worktree and previous commits already exist; apply targeted fixes and commit additively. The final line is the new HEAD commit sha.

Any other shape is treated by the orchestrator as `FAILED`.

(The two single-shot skill-driven developer dispatches define their OWN contract in their skill — these supersede the line above for that dispatch only: `writing-migrations` emits `DONE: branch=<short>/simple migration=<filename> summary=<...>` or `NO_MIGRATION_NEEDED`; `resolving-rollback-conflicts` emits `DONE: branch=<short>/simple files=[<...>]`. The orchestrator parses these in their respective states, PD-MIG-DEV / STATE RB-DEV.)

## Merger agent

Last line of output MUST be exactly one of:

- `DONE: <TASK_ID> commit=<short_sha>` — `<TASK_ID>` matches the spawn prompt (e.g. `TASK-003`, or the literal `MIGRATION` / `ROLLBACK` / `PROMOTE`).
- `FAILED: <TASK_ID> <one-line reason>`

Any other shape is treated by the orchestrator as `FAILED: <TASK_ID> <malformed merger output>`.

## Status updates (wave flow only)

The merger updates `${TICKETS_DIR}/TASK-XXX.json` `status` to `merged` after a successful merge. The developer does not write the ticket file — its `DONE: ...` line is sufficient for the orchestrator.
