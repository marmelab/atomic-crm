#!/usr/bin/env node
// Verify that every agent-role referenced by a settings.json SubagentStop matcher
// is a declared role in harness.config.json (config.roles). Claude Code requires
// settings.json matchers to be literal strings (they cannot be computed from the
// config), so this check is the bridge that keeps the two in sync: rename a role
// in config AND settings -> the matcher token still resolves, pass; rename it in
// config only -> the stale settings token is not a config role, fail.
//
// Usage: node .claude/scripts/check-config-sync.mjs [--app <repo>]
// Exit 0 = in sync; exit 1 = drift (prints the offending tokens).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, roleNames } from "../hooks/lib/config.mjs";

function resolveRepo(argv) {
  const flag = argv.indexOf("--app");
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  return process.env.APP_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

// SubagentStop matchers are role tokens (possibly `a|b`); PreToolUse/PostToolUse
// matchers are tool names (Bash, Agent, Write|Edit) and are NOT roles, so only
// SubagentStop is checked here.
function settingsRoleTokens(settings) {
  const entries = settings.hooks?.SubagentStop ?? [];
  const tokens = new Set();
  for (const entry of entries) {
    const matcher = entry.matcher;
    if (!matcher || typeof matcher !== "string") continue;
    for (const t of matcher
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)) {
      tokens.add(t);
    }
  }
  return [...tokens];
}

export function checkConfigSync(repo) {
  const settingsPath = join(repo, ".claude", "settings.json");
  if (!existsSync(settingsPath)) {
    return { ok: false, error: `settings.json not found at ${settingsPath}` };
  }
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (e) {
    return {
      ok: false,
      error: `settings.json is not valid JSON: ${e.message}`,
    };
  }
  let roles;
  try {
    roles = new Set(roleNames(loadConfig(repo)));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const tokens = settingsRoleTokens(settings);
  const missing = tokens.filter((t) => !roles.has(t));
  return { ok: missing.length === 0, missing, tokens, roles: [...roles] };
}

// Run as CLI when invoked directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = resolveRepo(process.argv.slice(2));
  const r = checkConfigSync(repo);
  if (r.error) {
    console.error(`check-config-sync: ${r.error}`);
    process.exit(1);
  }
  if (!r.ok) {
    console.error(
      `check-config-sync: settings.json SubagentStop matcher(s) reference roles not in harness.config.json: ${r.missing.join(", ")}.\n` +
        `Declared roles: ${r.roles.join(", ")}.\n` +
        `Rename the role in BOTH files, or add it to config.roles.`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `check-config-sync: OK (${r.tokens.length} role matcher(s) all declared)\n`,
  );
  process.exit(0);
}
