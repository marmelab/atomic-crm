#!/usr/bin/env node
// PreToolUse(Bash) — block the main orchestrator session from running merge-class
// git commands. Only the dispatched `merger` agent may merge; if the orchestrator
// falls back to merging itself, the team workflow looks healthy but is silently
// broken (the dev↔merger path is dead). The behavioral rule lives in
// chat-orchestrator.md ("NEVER act as merger yourself"); this is the runtime guard.
//
// OPT-IN: inert unless ATOMIC_CRM_ENFORCE_MERGE_GUARD=1. In a plain Claude Code
// checkout the main session is a general assistant, and blocking its git
// merge/pull/checkout would break normal use — so it stays off until the
// orchestrator explicitly enables it before a team wave.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

if (process.env.ATOMIC_CRM_ENFORCE_MERGE_GUARD !== "1") process.exit(0);

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-orchestrator-merge");

// Only block the main orchestrator session (agent_type empty). Dispatched
// subagents (merger, developer, …) are allowed.
const agent = input.agent_type || "";
if (agent) process.exit(0);

const cmd = input.tool_input?.command || "";
if (!cmd) process.exit(0);

let blocked = "";
if (/(^|[;&|\s])git\s+merge(\s|$)/.test(cmd)) blocked = "git merge";
else if (/(^|[;&|\s])git\s+checkout\s+(master|main)(\s|$)/.test(cmd))
  blocked = "git checkout master/main";
else if (/(^|[;&|\s])git\s+pull(\s|$)/.test(cmd)) blocked = "git pull";
else if (/(^|[;&|\s])git\s+worktree\s+remove(\s|$)/.test(cmd))
  blocked = "git worktree remove";
else if (/apply-app-variant\.sh/.test(cmd))
  blocked = "apply-app-variant.sh (merger-only command)";

if (blocked) {
  ctx.fail(
    `Blocked: orchestrator attempted to run "${blocked}".\n\n` +
      "Rule: chat-orchestrator must NEVER act as merger. Only the dispatched `merger`\n" +
      'agent runs merge-class git commands. See chat-orchestrator.md "NEVER act as merger yourself".\n\n' +
      "If you got here because the merger didn't report back, the team communication broke —\n" +
      "the dev's \"ready\" message never reached the merger. Don't salvage by merging yourself;\n" +
      "report the failure to the user and stop. Salvaging hides the bug.\n\n" +
      `Blocked command:\n  ${cmd}`,
    { log: `BLOCK ${blocked}` },
  );
}

process.exit(0);
