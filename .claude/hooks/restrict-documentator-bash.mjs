#!/usr/bin/env node
// PreToolUse(Bash) — restrict the documentator (DOCUMENTATOR_RUN=1 or agent_type=documentator) to a read-only / MEMORY.md-commit whitelist, rejecting shell metacharacters first; pass-through otherwise.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

// Detect the documentator EITHER by DOCUMENTATOR_RUN=1 (legacy standalone
// run — a top-level process with no agent_type) OR by agent_type ===
// "documentator" (an Agent-dispatched documentator subagent, the same signal the
// other PreToolUse hooks use). Read the payload first so agent_type is available.
//
// Fail closed ONLY once the caller is known to be the documentator, which is the
// most this hook can do: it runs on EVERY caller's Bash, so an unparseable payload
// (identity unknowable) must pass through rather than block every agent in the run.
// With DOCUMENTATOR_RUN=1 the identity comes from the env, independent of the
// payload, so there a malformed payload DOES block: input stays empty and the
// !command guard below exits 2 (exit 1 from an uncaught throw would let it through).
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
  /^git -C [^ ]+ diff( |$)/,
  /^git -C [^ ]+ log( |$)/,
  /^ls( |$)/,
  /^wc -l( |$)/,
  /^git -C [^ ]+ add MEMORY\.md *$/,
  // Author identity is pinned. Accept the neutral harness.local and the
  // deprecated atomic-crm.local (kept for one release).
  /^git -C [^ ]+ -c user\.name=['"]?Documentator['"]? -c user\.email=['"]?documentator@(harness|atomic-crm)\.local['"]? commit -m /,
  /^git -C [^ ]+ -c user\.email=['"]?documentator@(harness|atomic-crm)\.local['"]? -c user\.name=['"]?Documentator['"]? commit -m /,
];
const isWhitelisted = (cmd) => WHITELIST.some((pattern) => pattern.test(cmd));

if (isWhitelisted(command)) {
  process.exit(0);
}

ctx.error(
  "Bash command blocked for documentator. Allowed: git log, git show, git diff, ls, wc -l; Mode 2 only: 'git -C <repo> diff …', 'git -C <repo> log …', 'git -C <repo> add MEMORY.md', 'git -C <repo> -c user.name=Documentator -c user.email=documentator@harness.local commit -m …'. Use Read/Glob/Grep otherwise.",
);
process.exit(2);
