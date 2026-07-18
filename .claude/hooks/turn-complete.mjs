#!/usr/bin/env node
// Stop: drop a per-session sentinel file so a managed launcher (e.g. CRM
// Builder's chat-service PtySession) knows the turn is complete. Stop fires after
// the JSONL transcript is fully written, so the watcher can emit its result event
// only once the transcript is flushed.
//
// The sentinel directory is a launcher extension point: config.launcher
// .turnSentinelDir (see .claude/rules/launcher-interface.md). When it is unset
// (no managed launcher), this hook is INERT: no directory is created, no path is
// hardcoded. Atomic CRM's config sets it to /tmp/pty-sentinels, preserving the
// current CRM Builder behavior.

import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, launcher } from "./lib/config.mjs";

let sid = "";
try {
  sid = JSON.parse(readFileSync(0, "utf8")).session_id || "";
} catch {
  // no session id -> nothing to signal
}

let dir = null;
try {
  dir = launcher(loadConfig()).turnSentinelDir || null;
} catch {
  dir = null; // fail-open: a config error must never break the Stop hook
}

if (sid && dir) {
  mkdirSync(dir, { recursive: true });
  closeSync(openSync(join(dir, `pty-turn-done-${sid}`), "w"));
}
