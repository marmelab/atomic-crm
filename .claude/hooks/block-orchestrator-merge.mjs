#!/usr/bin/env node
// PreToolUse(Bash) — only the dispatched `merger` agent may run merge-class git
// commands. The main orchestrator session and every other subagent (developer,
// reviewers, …) are blocked; if any of them falls back to merging itself, the
// team workflow looks healthy but is silently broken (the dev↔merger path is
// dead). The behavioral rule lives in orchestrator.md ("NEVER act as merger
// yourself"); this is the runtime guard.
//
// OPT-IN: inert unless HARNESS_ENFORCE_MERGE_GUARD=1 (deprecated fallback:
// ATOMIC_CRM_ENFORCE_MERGE_GUARD, kept for one release). In a plain Claude Code
// checkout the main session is a general assistant, and blocking its git
// merge/pull/checkout would break normal use, so it stays off until the
// orchestrator explicitly enables it before a team wave.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { isMerger } from "./lib/teams.mjs";
import { loadConfig, launcher } from "./lib/config.mjs";

const mergeGuardEnabled =
  process.env.HARNESS_ENFORCE_MERGE_GUARD === "1" ||
  process.env.ATOMIC_CRM_ENFORCE_MERGE_GUARD === "1";
if (!mergeGuardEnabled) process.exit(0);

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-orchestrator-merge");

// Allow only the dispatched `merger` agent through. The runtime carries its
// (possibly suffixed) identity in agentName or agentType, so check both.
if ([ctx.agentName, ctx.agentType].some(isMerger)) process.exit(0);

const cmd = input.tool_input?.command || "";
if (!cmd) process.exit(0);

// The post-checkout script (e.g. CRM Builder's apply-app-variant.sh) is a
// launcher extension point: its path comes from config.launcher.postCheckoutScript
// so no chat-service path is hardcoded here. When unset, that guard clause is
// inert (a project with no post-checkout script has nothing to gate).
let postCheckoutScript = "";
try {
  postCheckoutScript = launcher(loadConfig()).postCheckoutScript || "";
} catch {
  postCheckoutScript = "";
}

let blocked = "";
if (/(^|[;&|\s])git\s+merge(\s|$)/.test(cmd)) blocked = "git merge";
else if (/(^|[;&|\s])git\s+checkout\s+(master|main)(\s|$)/.test(cmd))
  blocked = "git checkout master/main";
else if (/(^|[;&|\s])git\s+pull(\s|$)/.test(cmd)) blocked = "git pull";
else if (/(^|[;&|\s])git\s+worktree\s+remove(\s|$)/.test(cmd))
  blocked = "git worktree remove";
else if (postCheckoutScript && cmd.includes(basename(postCheckoutScript)))
  blocked = `${basename(postCheckoutScript)} (merger-only command)`;

if (blocked) {
  ctx.fail(
    `Blocked: only the dispatched \`merger\` agent may run "${blocked}".\n\n` +
      "Rule: the orchestrator must NEVER act as merger, and neither may any other\n" +
      "subagent. Only the `merger` runs merge-class git commands. See orchestrator.md\n" +
      '"NEVER act as merger yourself".\n\n' +
      "If you got here because the merger didn't report back, the team communication broke —\n" +
      "the dev's \"ready\" message never reached the merger. Don't salvage by merging yourself;\n" +
      "report the failure to the user and stop. Salvaging hides the bug.\n\n" +
      `Blocked command:\n  ${cmd}`,
    { log: `BLOCK ${blocked}` },
  );
}

process.exit(0);
