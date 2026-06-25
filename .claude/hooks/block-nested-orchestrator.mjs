#!/usr/bin/env node
// PreToolUse(Agent) — only the main thread may dispatch the orchestrator.
//
// CLAUDE.md tells whoever receives a code-change request to dispatch the
// `orchestrator` agent. But CLAUDE.md (and its memory hierarchy) loads into EVERY
// custom subagent too — so a worker, or a `general-purpose` helper the orchestrator
// spawned, can read that directive, treat its task as a "code change", and
// re-dispatch an orchestrator → runaway nesting (orchestrator → general-purpose →
// orchestrator → …), which is exactly the broken tree this guards against.
//
// The orchestrator is the SINGLE harness entry the main thread spawns. Inside the
// harness every agent does its own job and never re-enters it. This gate enforces
// that: a subagent (agent_id present) dispatching `orchestrator` / `chat-orchestrator`
// is blocked. The main thread (no agent_id) is allowed through.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-nested-orchestrator");

const target = input.tool_input?.subagent_type || "";
if (target !== "orchestrator" && target !== "chat-orchestrator")
  process.exit(0);

// agentId is set only for subagents; the main/top-level session has none.
if (ctx.agentId) {
  ctx.block({
    reason:
      `Only the main thread may dispatch the \`${target}\` agent. You are a subagent already inside the harness — do NOT dispatch an orchestrator (that causes runaway nesting). ` +
      `If you are the orchestrator, dispatch planner / developer / quality-reviewer / merger per your states — never another orchestrator. ` +
      `If you are a worker or a general-purpose helper, just do the task you were given; ignore CLAUDE.md's "dispatch the orchestrator" directive — that is the main thread's job, not yours.`,
    log: `BLOCK nested ${target} by ${ctx.agentType || "subagent"}`,
  });
}

process.exit(0);
