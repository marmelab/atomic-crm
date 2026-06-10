#!/usr/bin/env node
// PreToolUse(Write|Edit) — enforce deferred migrations: block writes to supabase/migrations-pending/* and writes to supabase/migrations/* by the `developer` agent. simple-developer is allowed (MIGRATION MODE).

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-migration-writes");

const filePath = input.tool_input?.file_path || "";
if (!filePath) process.exit(0);

// Prefer the suffixed runtime name (developer-TASK-003) over the bare type.
const agent = ctx.agentName || ctx.agentType;
const baseAgent = agent.split("-TASK-")[0];

const isPendingMigration = (p) => p.includes("/supabase/migrations-pending/");
const isMigration = (p) => p.includes("/supabase/migrations/");

const RULES = [
  {
    blocked: isPendingMigration(filePath),
    tag: "pending-folder",
    reason:
      "supabase/migrations-pending/ was removed by the deferred-migration design (spec 2026-05-27). Migrations live in supabase/migrations/ and are written only by simple-developer in MIGRATION MODE.",
  },
  {
    blocked: baseAgent === "developer" && isMigration(filePath),
    tag: "developer-migration",
    reason:
      "developer agent is forbidden from writing SQL migrations (see agents/developer.md, deferred-migration design). Migrations are generated at deploy time by the PD-MIG round (simple-developer in MIGRATION MODE) from the session-branch diff.",
  },
];

const violation = RULES.find((rule) => rule.blocked);
if (violation) {
  ctx.block({
    reason: violation.reason,
    log: `agent=${agent} path=${filePath} reason=${violation.tag}`,
  });
}

process.exit(0);
