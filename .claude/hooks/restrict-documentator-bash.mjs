#!/usr/bin/env node
// PreToolUse / Bash hook. Restricts the documentator's bash usage to a strict
// read-only whitelist. Pass-through for any other agent or for non-documentator
// claude sessions (no DOCUMENTATOR_RUN env var).

import { readStdin, parseJson } from "./lib/common.mjs";

if (process.env.DOCUMENTATOR_RUN !== "1") process.exit(0);

// Read the JSON envelope from stdin and extract tool_input.command. If the
// payload is malformed, treat as block (safer than passing through with an
// empty command that would later match `^ls( |$)` against an empty string).
const command = parseJson(readStdin()).tool_input?.command || "";

if (!command) {
  process.stderr.write("Bash command blocked for documentator: empty or unparseable command.\n");
  process.exit(2);
}

// Reject any command containing shell metacharacters that could chain or
// redirect. The prefix whitelist below trusts that the command is a single
// atom, so we have to enforce that here first.
const METACHARS = [";", "&&", "||", "|", "`", "$(", ">", "<", "\n"];
if (METACHARS.some((m) => command.includes(m))) {
  process.stderr.write(
    'Bash command blocked for documentator: shell metacharacters not allowed (";", "&&", "||", "|", backtick, "$(", redirections, newline).\n'
  );
  process.exit(2);
}

// Allowed-prefix patterns (anchored). Mode 1: read-only inspection.
// Mode 2: read the session diff vs origin/main, commit MEMORY.md with the
// pinned Documentator identity (never via `cd && …` — chaining is blocked).
// The `-C <repo>` target is matched generically ([^ ]+) so the whitelist is
// portable to any checkout location, not just /app.
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
  // commit: accept user.name/user.email in either order
  /^git -C [^ ]+ -c user\.name=['"]?Documentator['"]? -c user\.email=['"]?documentator@atomic-crm\.local['"]? commit -m /,
  /^git -C [^ ]+ -c user\.email=['"]?documentator@atomic-crm\.local['"]? -c user\.name=['"]?Documentator['"]? commit -m /,
];

if (WHITELIST.some((pattern) => pattern.test(command))) {
  process.exit(0);
}

process.stderr.write(
  "Bash command blocked for documentator. Allowed: git log, git show, git diff, ls, wc -l; Mode 2 only: 'git -C <repo> fetch origin main --quiet', 'git -C <repo> diff …', 'git -C <repo> log …', 'git -C <repo> add MEMORY.md', 'git -C <repo> -c user.name=Documentator -c user.email=documentator@atomic-crm.local commit -m …'. Use Read/Glob/Grep otherwise.\n"
);
process.exit(2);
