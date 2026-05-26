#!/usr/bin/env node
// PreToolUse hook — block the chat-orchestrator (team-lead) from running
// merge-class git commands via Bash.
//
// The orchestrator must NEVER act as merger. The shared `merger` agent is the
// only one who runs `git merge`, `git checkout master|main`, `git pull`, or
// `git worktree remove`. When the orchestrator falls back to doing these
// commands itself (typically because it didn't get a "merged" report from
// the merger), the team workflow looks healthy but is silently broken — the
// merger agent never received the dev's "ready" message, the dev↔merger
// communication path is dead, and the bug is hidden.
//
// This hook is the runtime guard. The behavioral rule is documented in
// chat-orchestrator.md ("NEVER act as merger yourself").
//
// Detection: in Claude Code's PreToolUse hook input, the `agent_type` field
// is empty ("") for the main orchestrator session, and contains the agent
// name (e.g. "merger", "developer") for dispatched subagents. So we block
// when agent_type is empty AND the command matches a merge-class pattern.
//
// Exits 2 + stderr message that points back to the rule. The orchestrator sees
// this as a tool_use_error and must report failure to the user instead.

import { readStdin, parseJson } from "./lib/common.mjs";

// OPT-IN GUARD. This hook blocks the MAIN session (empty agent_type) from running
// merge-class git commands. In the hosted chat-service the main session was always
// the team-lead/orchestrator, so that was safe. In a plain Claude Code checkout the
// main session is a general assistant, and blocking its git merge/pull/checkout
// would break normal use. So it stays inert unless explicitly enabled by exporting
// ATOMIC_CRM_ENFORCE_MERGE_GUARD=1 (e.g. by the orchestrator before a team wave).
if (process.env.ATOMIC_CRM_ENFORCE_MERGE_GUARD !== "1") process.exit(0);

const input = parseJson(readStdin());
const tool = input.tool_name || "";
const agent = input.agent_type || "";
const cmd = input.tool_input?.command || "";

if (tool !== "Bash") process.exit(0);

// Only block when called from the main orchestrator session (agent_type empty).
// Subagents (merger, developer, etc.) are allowed.
if (agent) process.exit(0);

let blocked = "";

if (/(^|[;&|\s])git\s+merge(\s|$)/.test(cmd)) {
  blocked = "git merge";
}
if (!blocked && /(^|[;&|\s])git\s+checkout\s+(master|main)(\s|$)/.test(cmd)) {
  blocked = "git checkout master/main";
}
if (!blocked && /(^|[;&|\s])git\s+pull(\s|$)/.test(cmd)) {
  blocked = "git pull";
}
if (!blocked && /(^|[;&|\s])git\s+worktree\s+remove(\s|$)/.test(cmd)) {
  blocked = "git worktree remove";
}
if (!blocked && /apply-app-variant\.sh/.test(cmd)) {
  blocked = "apply-app-variant.sh (merger-only command)";
}

if (blocked) {
  process.stderr.write(`[block-orchestrator-merge] Blocked: orchestrator attempted to run "${blocked}".

Rule: chat-orchestrator must NEVER act as merger. Only the dispatched
\`merger\` agent runs merge-class git commands. See chat-orchestrator.md
section "NEVER act as merger yourself".

If you got here because the merger didn't report back, it means the
team communication broke — the dev's "ready" message never reached the
merger. Don't salvage by merging yourself. Report the failure to the
user ("Something went wrong on the merge step. Want me to try again?")
and stop. Salvaging hides the bug.

Blocked command:
  ${cmd}
`);
  process.exit(2);
}

process.exit(0);
