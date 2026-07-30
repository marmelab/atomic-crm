#!/usr/bin/env node
// PostCompact: re-inject the load-bearing harness invariants after the
// conversation is compacted, so the coordinating thread does not lose them and
// resume the duplicate-work / wrong-routing failures they prevent.
//
// Injection uses hookSpecificOutput.additionalContext, the same sanctioned path
// session-bootstrap uses for SessionStart. Fail-open: any error exits 0 (a
// PostCompact hook must never break the resumed session).

import { readFileSync } from "node:fs";

// A short, dense block: only the invariants a fresh context must not lose.
// Keep it under ~25 lines.
const INVARIANTS = [
  "<harness-invariants> (re-injected after compaction)",
  "- Worktree scope: each agent reads/writes ONLY its own <WORKTREE_PATH>; never edit $REPO/src directly. Every Bash needs a `cd <WORKTREE_PATH> &&` prefix.",
  "- Git rights: the developer commits its OWN task branch; only the merger mutates session/base branches; no agent pushes or pulls (the user owns the remote).",
  "- Launched is NOT done: an `Async agent launched ... agentId` acknowledgement means dispatched, not finished. Wait for the task-notification; do NOT start implementing the same change yourself.",
  "- While an orchestrator runs: surface progress only; never route or re-implement the change in the main thread (that is the duplicate-work bug).",
  "- Approvals (migration / plan gate): dispatch a FRESH orchestrator (new Agent call) with the right <intent>; never SendMessage the old one (relayed approvals carry no user authority).",
  "</harness-invariants>",
].join("\n");

try {
  readFileSync(0, "utf8"); // drain stdin; payload content is not needed
} catch {
  // no payload is fine; still emit the invariants below
}

try {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostCompact",
        additionalContext: INVARIANTS,
      },
    }) + "\n",
  );
} catch {
  // fail-open: never break the resumed session
}
process.exit(0);
