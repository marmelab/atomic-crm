#!/usr/bin/env node
// PreToolUse / Write|Edit hook — enforces the deferred-migration rule.
//
// Rule from agents/developer.md ("Never write SQL migrations") and the
// deferred-migration design: migrations are generated only at deploy time by
// `simple-developer` in MIGRATION MODE. Developer agents writing migrations
// during feature TASKs is a regression that occurred in sessions 630fb0fe
// and 2e53c631 — instructions alone don't enforce it.
//
// Block conditions:
//   1. Any Write/Edit on `supabase/migrations-pending/*` — the folder was
//      removed by the deferred-migration design (see spec 2026-05-27) but
//      agents keep recreating it from training memory.
//   2. Any Write/Edit on `supabase/migrations/*` when the calling agent is
//      `developer` (the multi-file feature-ticket agent). Migrations belong
//      to the PD-MIG round, handled by `simple-developer` only.
//
// Pass-through for any other agent or path. simple-developer is allowed to
// write to supabase/migrations/ because that's its job in MIGRATION MODE.

import { readStdin, parseJson, crmIdentity, decisionBlock } from "./lib/common.mjs";

const input = parseJson(readStdin());
const ctx = crmIdentity(input);

const filePath = input.tool_input?.file_path || "";
if (!filePath) process.exit(0);

// Prefer the suffixed env name (e.g. "developer-TASK-003"). Fall back to base type.
const agent = process.env.CLAUDE_AGENT_NAME || input.agent_type || "";
// Normalise: strip the -TASK-XXX suffix to get the base agent type.
const baseAgent = agent.split("-TASK-")[0];

// Rule 1: nobody writes to supabase/migrations-pending/* — the folder is dead.
if (filePath.includes("/supabase/migrations-pending/")) {
  ctx.log(`block-migration-writes BLOCKED agent=${agent} path=${filePath} reason=pending-folder`);
  decisionBlock(
    "supabase/migrations-pending/ was removed by the deferred-migration design (spec 2026-05-27). Migrations live in supabase/migrations/ and are written only by simple-developer in MIGRATION MODE."
  );
  process.exit(0);
}

// Rule 2: developer (feature-ticket agent) never writes migrations.
if (baseAgent === "developer" && filePath.includes("/supabase/migrations/")) {
  ctx.log(`block-migration-writes BLOCKED agent=${agent} path=${filePath} reason=developer-migration`);
  decisionBlock(
    "developer agent is forbidden from writing SQL migrations (see agents/developer.md, deferred-migration design). Migrations are generated at deploy time by the PD-MIG round (simple-developer in MIGRATION MODE) from the session-branch diff."
  );
  process.exit(0);
}

process.exit(0);
