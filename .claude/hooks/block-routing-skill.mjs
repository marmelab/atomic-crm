#!/usr/bin/env node
// PreToolUse(Skill) — keep the heavy `harness-routing` skill out of worker agents.
//
// `harness-routing` is the orchestrator's routing brain (~600 lines: classify,
// dispatch waves, promote, migrate). The chat-orchestrator PRELOADS it (skills:
// frontmatter) and the main thread INVOKES it on demand to route. But developer
// and quality-reviewer also carry the Skill tool (they need writing-migrations,
// resolving-rollback-conflicts, frontend-dev, …), and Claude Code has no native
// per-agent skill denylist — a subagent with the Skill tool can invoke ANY skill.
// This gate is the runtime guard: a developer/quality-reviewer must never load the
// routing logic — it is irrelevant to implementing or reviewing a ticket and would
// just be noise.
//
// merger / planner / documentator have no Skill tool at all, so they can't reach
// it anyway; this only needs to cover the two workers that can.
//
// Preloading via the `skills:` frontmatter does NOT go through the Skill tool, so
// the orchestrator's preload is unaffected. The main thread (no agent_type) and
// the orchestrator are allowed through.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-routing-skill");

const skill = input.tool_input?.skill || "";
if (skill !== "harness-routing") process.exit(0);

// Match the base agent type even when the runtime name is suffixed
// (e.g. developer-TASK-001).
const agent = input.agent_type || ctx.agentType || "";
const BLOCKED = ["developer", "quality-reviewer"];
const isBlocked = BLOCKED.some((a) => agent === a || agent.startsWith(`${a}-`));

if (isBlocked) {
  ctx.block({
    reason:
      "The `harness-routing` skill is the orchestrator's routing logic and must NOT be loaded by a developer or quality-reviewer — it is orchestration mechanics, irrelevant to implementing or reviewing a ticket. Follow your own agent instructions and the ticket; do not load harness-routing.",
    log: `BLOCK harness-routing for ${agent}`,
  });
}

process.exit(0);
