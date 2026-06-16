#!/usr/bin/env node
// PreToolUse(Bash) — restrict the documentator (DOCUMENTATOR_RUN=1 or agent_type=documentator) to a read-only / MEMORY.md-commit whitelist, rejecting shell metacharacters first; pass-through otherwise.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

// Detect the documentator EITHER by DOCUMENTATOR_RUN=1 (legacy standalone
// run — a top-level process with no agent_type) OR by agent_type ===
// "documentator" (an Agent-dispatched documentator subagent, the same signal the
// other PreToolUse hooks use). Read the payload first so agent_type is available.
//
// Fail closed: a malformed payload is a block signal for this restricted agent,
// not a pass-through. Leave input empty so the !command guard below exits 2
// (exit 1 from an uncaught throw would let the Bash command through).
let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // fall through to the empty-command block below
}
if (
  process.env.DOCUMENTATOR_RUN !== "1" &&
  (input.agent_type || "") !== "documentator"
) {
  process.exit(0);
}
const ctx = createHookContext(input, "restrict-documentator-bash");
const command = input.tool_input?.command || "";

if (!command) {
  ctx.error(
    "Bash command blocked for documentator: empty or unparseable command.",
  );
  process.exit(2);
}

const SHELL_METACHARS = [";", "&&", "||", "|", "`", "$(", ">", "<", "\n"];
const hasShellMetachars = (cmd) => SHELL_METACHARS.some((m) => cmd.includes(m));

if (hasShellMetachars(command)) {
  ctx.error(
    'Bash command blocked for documentator: shell metacharacters not allowed (";", "&&", "||", "|", backtick, "$(", redirections, newline).',
  );
  process.exit(2);
}

const WHITELIST = [
  /^git log( |$)/,
  /^git show( |$)/,
  /^git diff( |$)/,
  /^git -C [^ ]+ fetch origin main --quiet *$/,
  /^git -C [^ ]+ diff( |$)/,
  /^git -C [^ ]+ log( |$)/,
  /^ls( |$)/,
  /^wc -l( |$)/,
  /^git -C [^ ]+ add MEMORY\.md *$/,
  /^git -C [^ ]+ -c user\.name=['"]?Documentator['"]? -c user\.email=['"]?documentator@atomic-crm\.local['"]? commit -m /,
  /^git -C [^ ]+ -c user\.email=['"]?documentator@atomic-crm\.local['"]? -c user\.name=['"]?Documentator['"]? commit -m /,
];
const isWhitelisted = (cmd) => WHITELIST.some((pattern) => pattern.test(cmd));

if (isWhitelisted(command)) {
  process.exit(0);
}

ctx.error(
  "Bash command blocked for documentator. Allowed: git log, git show, git diff, ls, wc -l; Mode 2 only: 'git -C <repo> fetch origin main --quiet', 'git -C <repo> diff …', 'git -C <repo> log …', 'git -C <repo> add MEMORY.md', 'git -C <repo> -c user.name=Documentator -c user.email=documentator@atomic-crm.local commit -m …'. Use Read/Glob/Grep otherwise.",
);
process.exit(2);
