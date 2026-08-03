#!/usr/bin/env node
// PreToolUse(Agent) - force the orchestrator's pipeline dispatches to run FOREGROUND.
//
// Root cause (transcript forensics + a probe): the VS Code extension defaults the Agent
// tool to BACKGROUND, and a nested subagent (the orchestrator, spawnDepth >= 1) is NEVER
// re-invoked when a background child completes. So a background dispatch from the
// orchestrator ends its turn "to await a notification" that never comes - review / merge /
// promotion never run and finished dev work is orphaned.
// A probe confirmed explicit run_in_background:false DOES block (child output inline) while
// the default is async; CLI defaults to foreground, so the bug only ever bit the extension.
//
// Enforcement (the prose guard in orchestrator.md was ignored): DENY any orchestrator->child
// pipeline dispatch that is not explicitly run_in_background:false, forcing a re-dispatch
// with false. Detection is by the CHILD role - only the orchestrator dispatches these - so
// main->orchestrator (child=orchestrator) and the fire-and-forget documentator are never
// touched. Fail-open: any error or unrecognized shape allows the dispatch.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import { parseDispatch } from "./lib/dispatch-parse.mjs";
import { pipelineRoleSet } from "./lib/teams.mjs";

// Pipeline roles whose result the orchestrator MUST consume in the same turn come
// from harness.config.json (config.roles `pipeline` flag), so this set and the
// one in block-duplicate-dispatch share one source. The orchestrator
// (main->orchestrator hop) and documentator (fire-and-forget) are excluded
// (pipeline:false): their background dispatch is correct.
const PIPELINE_ROLES = pipelineRoleSet();

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // no / unparseable payload -> allow
}

const ctx = createHookContext(input, "force-foreground-orchestrator-dispatch");

try {
  const d = parseDispatch(input);
  const childRole = PIPELINE_ROLES.has(d.subagentType)
    ? d.subagentType
    : PIPELINE_ROLES.has(d.role)
      ? d.role
      : "";

  // Not an orchestrator->pipeline-child dispatch -> none of our business.
  if (!childRole) ctx.accept("not a pipeline dispatch");

  // Read run_in_background RAW: parseDispatch coerces absent->false, but the difference
  // matters here - in the extension, ABSENT means the background default, which is the bug.
  // Only an EXPLICIT false is safe.
  const rib = input.tool_input?.run_in_background;
  if (rib === false) ctx.accept(`${childRole} foreground (explicit false)`);

  ctx.block({
    reason:
      `Nested orchestrator dispatch of "${childRole}" must be FOREGROUND. A nested subagent ` +
      `is never re-invoked when a background child completes, so this dispatch would orphan ` +
      `the pipeline (review/merge/promotion never run). Re-dispatch it with ` +
      `run_in_background: false - verified to block and return the child's result inline in ` +
      `this runtime.`,
    log: `blocked ${childRole} rib=${rib === undefined ? "absent" : String(rib)}`,
  });
} catch (e) {
  // Never let this gate break a real dispatch.
  ctx.log(`error, allowing: ${String(e).slice(0, 120)}`);
  process.exit(0);
}
