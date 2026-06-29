#!/usr/bin/env node
// PreToolUse(Agent) — enforce the harness dispatch topology. Two rules:
//
// Rule 1 — the ORCHESTRATOR may dispatch ONLY the typed harness agents
//   (planner, developer, quality-reviewer, merger, documentator). It keeps
//   drifting to `general-purpose` for planning/review despite its instructions;
//   a general-purpose agent has no role constraints, won't honour the output
//   contracts, and tends to re-dispatch an orchestrator (→ recursion). Anything
//   off the allowlist (general-purpose, orchestrator, Explore, …) is blocked.
//
// Rule 2 — any OTHER subagent (a stray general-purpose, a worker, …) must NOT
//   dispatch an `orchestrator` / `chat-orchestrator`: that re-enters the harness
//   and causes runaway nesting. Only the main/top-level session (no agent_id)
//   may dispatch the orchestrator.
//
// CLAUDE.md tells the top-level session to "dispatch the orchestrator", but
// CLAUDE.md loads into every subagent too — so without this gate a subagent that
// reads it would re-dispatch an orchestrator.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { isOrchestrator } from "./lib/teams.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-nested-orchestrator");

const target = input.tool_input?.subagent_type || "";
const caller = input.agent_type || ctx.agentType || "";

// Rule 1 — orchestrator allowlist.
const ALLOWED = [
  "planner",
  "developer",
  "quality-reviewer",
  "merger",
  "documentator",
];
if (isOrchestrator(caller)) {
  if (!ALLOWED.includes(target)) {
    ctx.block({
      reason:
        `As the orchestrator you may ONLY dispatch the typed harness agents: ${ALLOWED.join(", ")}. ` +
        `You tried to dispatch \`${target || "(none)"}\` — not allowed. ` +
        `For planning use the \`planner\` agent (subagent_type: "planner"), NEVER \`general-purpose\`. ` +
        `Re-dispatch with subagent_type set to the correct typed agent.`,
      log: `BLOCK orchestrator dispatch of ${target || "(none)"}`,
    });
  }
  process.exit(0); // allowed typed agent — fine
}

// Rule 2 — non-main subagent must not dispatch an orchestrator.
if (
  ctx.agentId &&
  (target === "orchestrator" || target === "chat-orchestrator")
) {
  ctx.block({
    reason:
      `Only the main thread may dispatch the \`${target}\` agent. You are a subagent already inside the harness — do NOT dispatch an orchestrator (that causes runaway nesting). ` +
      `Do the task you were given; ignore CLAUDE.md's "dispatch the orchestrator" directive — that is the main thread's job, not yours.`,
    log: `BLOCK nested ${target} by ${caller || "subagent"}`,
  });
}

process.exit(0);
