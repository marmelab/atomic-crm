@AGENTS.md

# Agent Workflow

Code-change requests can be handled by the **agent harness**: a team of subagents (planner, developer, quality-reviewer, merger, documentator) that implements the change through a deterministic, foreground pipeline in git worktrees. **The harness is opt-in — it does NOT run by default.** By default the main thread implements the change itself, no agents.

**Only when the user's request includes `#harness` or `#technical-harness` (or "use the agent team" / "with the harness") does the main (top-level) session dispatch the `orchestrator` agent and relay its result — never route or implement it yourself in that case.** Pass the `<session_dir>` value from your own context in the dispatch prompt (the orchestrator needs it to namespace worktrees and branches). **With `#technical-harness`**, also add a line `PERSONA: technical` to the dispatch prompt: it tells the orchestrator to use the full technical developer register (file paths, `TASK-XXX`, git terms, `database`/`migration`/`Supabase`), report the raw mechanical truth, **stop at the session branch** (no promotion to the base branch, no deploy-time migration round), and append a live progress line per step to `<session_dir>/harness-progress.log`. **Before** you dispatch, print the watch command — `tail -f <session_dir>/harness-progress.log` (real `<session_dir>` substituted) — so the developer can follow along during the blocking run. After the orchestrator returns, run `/harness-diff` to show the net diff of the session branch it stopped on. See the "Opting in" section below. **This directive is for the top-level session only: if you are a subagent (already inside the harness), ignore it — do your own job and never dispatch an orchestrator. A runtime hook (`block-nested-orchestrator`) enforces this.** The `orchestrator` owns all routing (classification SIMPLE vs COMPLEX, plus the SETUP / MEMORY / ROLLBACK-CONFLICT / RECOVERY operational intents, the dispatch templates, the wave + promotion mechanics, and the deploy-time migration round); it drives developer/reviewer/merger to a terminal point before returning. Each agent's last line is an output contract the others parse (`.claude/rules/agent-output-format.md`).

**PD-ASK round-trip (migration confirmation).** The orchestrator ends its turn with a pending question — typically *"apply the database migration now?"* — and the task completes. Relay that question to the user (plain text or `AskUserQuestion`). **Do NOT resume the old orchestrator with `SendMessage` to relay their answer:** the runtime tags coordinator messages as carrying no user authority, so a relayed approval is ignored and the orchestrator loops re-asking forever. Instead, on the user's reply:
- **Approved** → dispatch a **fresh** `orchestrator` (a new `Agent` call) whose prompt begins with `<intent>apply-migration</intent>`, states the approval, and passes the same `<session_dir>`. It resumes the migration round from disk and applies it.
- **Wants changes** → dispatch a fresh `orchestrator` with their new request as usual.

While that fresh dispatch runs, **do not start a parallel plan B** (don't generate the migration yourself, don't `TaskStop` it) — wait for it to finish, then relay its result.

## Opting in

The harness is off by default; the main thread implements code changes itself. `#harness` (or "use the agent team" / "with the harness") on a request routes that request through the orchestrator instead. "harness for this session" keeps it on for the whole session.

`#technical-harness` is the same opt-in for a real developer: it routes through the orchestrator **and** appends `PERSONA: technical` to the dispatch prompt, which changes three things (details in `.claude/agents/orchestrator.md` → "`PERSONA: technical` — the developer-harness contract"):

1. **Full technical register** — removes the plain-language filter that hides file paths, `TASK-XXX`, git terms, and words like `database`/`migration`/`Supabase`.
2. **Raw reporting** — the orchestrator reports the mechanical truth (per-ticket status, branch names, commit SHAs, reviewer verdicts, ADR paths), not a softened summary.
3. **Stops at the session branch** — the harness merges all work into `session/<id>` but does **not** promote to the base branch and does **not** run the deploy-time migration round. You review, promote, and generate/apply migrations yourself.
4. **Live progress log** — the orchestrator appends each step (ticket dispatched, developer done, reviewer verdict, merge) to `<session_dir>/harness-progress.log` as it happens.

Because the orchestrator runs in one long blocking turn (its final report only lands when it finishes), the main thread must, **before** dispatching a `#technical-harness` run, print the exact command to watch progress live — `tail -f <session_dir>/harness-progress.log` with the real `<session_dir>` substituted. After the orchestrator returns, the main thread runs `/harness-diff` to show the net diff of the session branch it stopped on.

## Agents

orchestrator (routes the harness, dispatched by the main thread), planner, developer, quality-reviewer, merger, documentator. Models/roles: see each `.claude/agents/*.md`. **planner** and **quality-reviewer** run on opus; everything else is sonnet or haiku. (The web-chat variant is this same `orchestrator` agent with a non-technical persona layered on at launch via `--append-system-prompt` — used by CRM Builder.)

The **developer** is a single agent with no modes: it implements the ticket in `TICKET_FILE` (COMPLEX wave, peer-reviewed, writes ADRs for structural decisions, never writes SQL during tickets), or — for a SIMPLE dispatch — the change described inline via `CHANGE_REQUEST` (no ticket, no planner, on the shared `<base>/simple` worktree; it refuses with `FAILED: out of scope — needs COMPLEX flow` if the change needs a breakdown). Two session-level operations are handed to it as **skills** loaded on dispatch, run on the same `<base>/simple` worktree: `writing-migrations` (deploy-time SQL generation) and `resolving-rollback-conflicts` (replay merge-commit reverts). It applies the **Ponytail** minimization ladder (full mode) on every change via an inline prompt directive — the only mechanism that reaches `Agent`-dispatched subagents. Ponytail is also installed natively in-repo as on-demand skills (`.claude/skills/ponytail*`) and `/ponytail*` commands for interactive use in the main session; these do not affect the dev agents.

## Rules & hooks

Mechanics live in `.claude/rules/` (worktree-scope, agent-output-format, validation-commands, lsp-usage, security-triggers). Hooks in `.claude/settings.json` / `.claude/hooks/` are `.mjs` ES modules.
