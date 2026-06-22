#!/usr/bin/env node
// PreToolUse(Write|Edit) — enforce deferred migrations: block writes to
// supabase/migrations-pending/* (always) and writes to supabase/migrations/* from
// anywhere except the <base>/simple worktree. The developer writes migrations only
// when a dispatch sends it to the `writing-migrations` skill, which runs on the
// shared <base>/simple worktree; a per-ticket developer writes under <base>/TASK-XXX
// and must never touch migrations. The worktree path is the discriminator (the
// dispatch intent isn't visible at Write time), and it is authoritative —
// setup-worktree derives it, not the dispatch naming.

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
// Migrations are only legitimate in the deploy-time migration round, which always
// runs on the fixed <base>/simple worktree (the writing-migrations skill).
const isSimpleWorktreeMigration = (p) =>
  p.includes("/simple/supabase/migrations/");

const RULES = [
  {
    blocked: isPendingMigration(filePath),
    tag: "pending-folder",
    reason:
      "Writing to supabase/migrations-pending/ is not allowed. Migrations live in supabase/migrations/ and are written only via the writing-migrations skill (on the <base>/simple worktree).",
  },
  {
    blocked:
      baseAgent === "developer" &&
      isMigration(filePath) &&
      !isSimpleWorktreeMigration(filePath),
    tag: "developer-migration",
    reason:
      "A per-ticket developer is not allowed to write SQL migrations. They are written only via the writing-migrations skill, on the <base>/simple worktree.",
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
