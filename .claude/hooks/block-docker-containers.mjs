#!/usr/bin/env node
// PreToolUse(Bash) — any caller. This dev container runs docker-in-docker; the
// agent must not launch arbitrary containers. Block commands that create/run/start
// a container (`docker run|create|start`, `docker compose up`, `docker-compose up`)
// UNLESS they reference Supabase — the one stack the dev workflow is allowed to spin
// up. Inspection/management verbs (ps, logs, stop, rm, exec, …) are never blocked.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "block-docker-containers");

const cmd = input.tool_input?.command || "";
if (!cmd) process.exit(0);

// A command that brings a container up: `docker [container] run|create|start`,
// or compose `up` (both `docker compose up` and legacy `docker-compose up`).
const launchesContainer = (c) =>
  /\bdocker\s+(container\s+)?(run|create|start)\b/.test(c) ||
  /\bdocker(-compose|\s+compose)\b[^\n]*\bup\b/.test(c);

// The single allowed stack. Supabase's own CLI (`npx supabase start`) drives the
// Docker daemon directly and never shells out `docker run`, so it is unaffected;
// this exception covers the rare case of operating Supabase's containers by hand.
const referencesSupabase = (c) => /supabase/i.test(c);

if (launchesContainer(cmd) && !referencesSupabase(cmd)) {
  ctx.block({
    reason:
      "Docker container launch blocked: this dev container only permits Supabase containers. " +
      "`docker run|create|start` and `docker compose up` are disabled for non-Supabase images. " +
      "Use `npx supabase start` / `make start` for the local stack.",
    log: `cmd=${cmd.slice(0, 120)}`,
  });
}

process.exit(0);
