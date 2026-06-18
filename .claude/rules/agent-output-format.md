---
paths: []
---

# Agent output format

All ticket agents are spawned one-shot (in the background) by the chat orchestrator. Each agent's last line of output is parsed by regex against an output contract. Anything else in the body is informational and ignored by the orchestrator's parser.

The developer, quality-reviewer, and test-validator read their ticket from `${TICKET_FILE}` (an absolute path passed in the spawn prompt). The merger additionally receives `${TICKETS_DIR}` (the per-session directory holding all ticket JSON files) so it can update the ticket's `status` field after a successful merge.

## Reviewer agents (quality-reviewer, test-validator)

Last line of output MUST be exactly one of:

- `APPROVED`
- `REJECTED: <feedback>` — `<feedback>` is a bulleted list (one bullet per issue) the developer must address on retry. Be specific: file path + symptom + what to change.

Anything above the contract line is informational and discarded by the orchestrator. Warning-level findings that do not require a retry should not be emitted — write `APPROVED` and stop.

Any other shape is treated by the orchestrator as `REJECTED: <malformed reviewer output>`.

(The SIMPLE-flow single-shot quality-reviewer and the migration-review reviewer keep their own `APPROVED` / `BLOCKED:` text contract — see quality-reviewer.md. The orchestrator parses those in the SIMPLE / migration flow, not the COMPLEX-wave parser above.)

## Developer agent

Last line of output MUST be exactly one of:

- `DONE: branch=<branch_name> commit=<short_sha> files=[<comma-separated paths>]`
- `FAILED: <one-line reason>`

When the spawn prompt includes a `RETRY_FEEDBACK=...` block, the developer is on a retry attempt: the worktree and previous commits already exist; apply targeted fixes and commit additively. The final line is the new HEAD commit sha.

Any other shape is treated by the orchestrator as `FAILED`.

## Merger agent

Last line of output MUST be exactly one of:

- `DONE: <TASK_ID> commit=<short_sha>` — `<TASK_ID>` matches the spawn prompt (e.g. `TASK-003`, or the literal `SIMPLE` / `ROLLBACK` / `PROMOTE`).
- `FAILED: <TASK_ID> <one-line reason>`

Any other shape is treated by the orchestrator as `FAILED: <TASK_ID> <malformed merger output>`.

## Status updates (COMPLEX flow only)

The merger updates `${TICKETS_DIR}/TASK-XXX.json` `status` to `merged` after a successful merge. The developer does not write the ticket file — its `DONE: ...` line is sufficient for the orchestrator.
