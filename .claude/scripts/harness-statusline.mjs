#!/usr/bin/env node
// Claude Code statusLine command: one compact line summarizing the active
// #technical-harness run, read from <REPO>/.harness/<short>/status.json (written
// by the render-status SubagentStop hook). Prints nothing when no harness run is
// active, so it is safe to leave configured. The statusLine payload JSON arrives
// on stdin; we need session_id to find the right session's board.
//
// NOT wired into the committed settings.json on purpose: statusLine is a personal
// choice and a project-level one would override your own global statusline (same
// reasoning as the opt-in concise-dev output style in AGENTS.md). To use it, add
// to your own .claude/settings.local.json:
//
//   "statusLine": {
//     "type": "command",
//     "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/harness-statusline.mjs"
//   }
//
// To KEEP your existing statusline as well, point HARNESS_STATUSLINE_BASE at its
// command: this script runs it (same stdin), then appends the harness segment.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { REPO } from "../hooks/lib/paths.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  raw = "";
}
let payload = {};
try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

const sessionId =
  payload.session_id || process.env.CLAUDE_CODE_SESSION_ID || "";
const short = sessionId.split("-")[0];

// Optional: compose with an existing statusline command.
let prefix = "";
const base = process.env.HARNESS_STATUSLINE_BASE;
if (base) {
  try {
    prefix = execSync(base, { input: raw, encoding: "utf8" }).trim();
  } catch {
    prefix = "";
  }
}

function harnessSegment(shortId) {
  if (!shortId) return "";
  let s;
  try {
    s = JSON.parse(
      readFileSync(join(REPO, ".harness", shortId, "status.json"), "utf8"),
    );
  } catch {
    return "";
  }
  const t = s.tickets || {};
  const parts = [`⚙ ${t.merged ?? 0}/${t.total ?? 0}`];
  const active = (s.active || []).map((a) => `▸${a.task}`).join(" ");
  if (active) parts.push(active);
  if (s.last) parts.push(String(s.last).slice(0, 40));
  return parts.join(" · ");
}

const out = [prefix, harnessSegment(short)].filter(Boolean).join("  ");
// A CLI status command whose job is to print one line to stdout.
if (out) process.stdout.write(out + "\n");
