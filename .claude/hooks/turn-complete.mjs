#!/usr/bin/env node
// Stop — create a sentinel file so the chat-service PtySession knows the turn is
// complete. Stop fires after the JSONL transcript has been fully written, so the
// watcher can emit its result event only once the transcript is flushed. The
// watcher polls /tmp/pty-sentinels/pty-turn-done-<session_id>; a dedicated subdir
// avoids waking every session's watcher on unrelated /tmp activity.

import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

let sid = "";
try {
  sid = JSON.parse(readFileSync(0, "utf8")).session_id || "";
} catch {
  // no session id → nothing to signal
}

if (sid) {
  const dir = "/tmp/pty-sentinels";
  mkdirSync(dir, { recursive: true });
  closeSync(openSync(join(dir, `pty-turn-done-${sid}`), "w"));
}
