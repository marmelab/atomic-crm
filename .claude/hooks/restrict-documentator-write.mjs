#!/usr/bin/env node
// PreToolUse / Write|Edit hook. Restricts the documentator's writes to a small
// set of paths: the ledger, the runtime additions tree, MEMORY.md, and
// settings.local.json. All other paths are blocked — the documentator is not
// allowed to touch application code or to modify the base config under
// $CONFIG_DIR/{agents,skills,hooks,rules,settings.json}.
// Pass-through for any other agent or for non-documentator claude sessions
// (no DOCUMENTATOR_RUN env var).

import { join } from "node:path";
import { readStdin, parseJson, REPO, CONFIG_DIR } from "./lib/common.mjs";

if (process.env.DOCUMENTATOR_RUN !== "1") process.exit(0);

const filePath = parseJson(readStdin()).tool_input?.file_path || "";

if (!filePath) {
  process.stderr.write("Write/Edit blocked for documentator: empty or unparseable file_path.\n");
  process.exit(2);
}

const LEDGER = join(REPO, "docs/learnings/patterns.md");
const LOCAL_PREFIX = join(CONFIG_DIR, "local") + "/";
const SETTINGS_LOCAL = join(CONFIG_DIR, "settings.local.json");
const MEMORY = join(REPO, "MEMORY.md");

if (
  filePath === LEDGER ||
  filePath === SETTINGS_LOCAL ||
  filePath === MEMORY ||
  filePath.startsWith(LOCAL_PREFIX)
) {
  process.exit(0);
}

process.stderr.write(
  `Write/Edit blocked for documentator: ${filePath} is outside the allowed set. Allowed: ${LEDGER}, ${SETTINGS_LOCAL}, ${MEMORY}, ${LOCAL_PREFIX}**.\n`
);
process.exit(2);
