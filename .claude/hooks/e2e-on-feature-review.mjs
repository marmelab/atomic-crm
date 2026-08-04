#!/usr/bin/env node
// SubagentStop(quality-reviewer) — the ONLY place the e2e suite is launched.
//
// It fires for the end-of-feature `MODE: feature-review` dispatch and ONLY when that
// review APPROVED, so a BLOCKED review that sends the work back to a developer never
// pays for a 10-minute suite. The gate is the reviewer's own verdict FLAG, not the
// verdict text: at SubagentStop `last_assistant_message` is absent in this runtime and
// the transcript is often unflushed (see record-review-verdict.mjs), so parsing the
// verdict here would return UNKNOWN. The flag is written synchronously by the reviewer
// itself before it stops, which is why the wave flow already trusts it.
//
// The suite runs on the INTEGRATED session worktree (never $REPO, which sits on the
// base branch), via the deploy adapter's e2e-smoke.sh: isolated slot-leased Supabase,
// guaranteed teardown, graceful SKIP when the host cannot hold a stack.
//
// The result cannot be handed to the stopping reviewer (fixing e2e is not its job), so
// it lands in <session_dir>/e2e-result.json plus the progress log, and the orchestrator
// reads it after the review returns. This hook never blocks a stop.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { readAgentMeta } from "./lib/agent-meta.mjs";
import { appendProgress } from "./lib/progress-log.mjs";
import { bash } from "./lib/process.mjs";
import { reviewFlag } from "./lib/reviews.mjs";
import { sessionWorktreePath } from "./lib/topology.mjs";

const FEATURE_REVIEW_KEY = "FEATURE";
const E2E_TIMEOUT_MS = 15 * 60 * 1000;

// Mirrors reviews.mjs: on a managed launcher the orchestrator's <session_dir> is
// CHAT_SESSION_DIR, not the recomputed /tmp/<repo>/<id> path, so the result file has to
// land where the orchestrator will actually look for it.
const e2eResultPath = (ctx) =>
  join(process.env.CHAT_SESSION_DIR || ctx.sessionDir, "e2e-result.json");

const classify = (status, output) =>
  status !== 0 ? "failed" : /^SKIP:/m.test(output) ? "skipped" : "passed";

function isFeatureReview(input) {
  const meta = readAgentMeta(input);
  if (meta && /feature-review/i.test(meta.description)) return true;
  const tp = input.agent_transcript_path || input.transcript_path;
  if (!tp || !existsSync(tp)) return false;
  try {
    return /MODE:\s*feature-review/.test(readFileSync(tp, "utf8"));
  } catch {
    return false;
  }
}

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "e2e-on-feature-review");

if (!isFeatureReview(input)) process.exit(0);

// A feature review just ran, so any result from an earlier round describes code that
// has since changed. Drop it before deciding, so the orchestrator can never read a
// stale verdict as current: from here on, a missing file means "not run this round".
try {
  rmSync(e2eResultPath(ctx), { force: true });
} catch {
  // best-effort
}

const flag = reviewFlag(ctx, FEATURE_REVIEW_KEY, "quality-reviewer");
if (!existsSync(flag)) {
  ctx.accept("feature-review not APPROVED -> e2e not launched");
}

const src = sessionWorktreePath(ctx);
const script = join(ctx.repo, ".claude", "scripts", "e2e-smoke.sh");
if (!existsSync(src))
  ctx.accept(`no session worktree at ${src} -> e2e skipped`);
if (!existsSync(script)) ctx.accept(`no ${script} -> e2e skipped`);

appendProgress(
  ctx.sessionDir,
  "[e2e] suite starting on the session worktree...",
);

const r = bash(`E2E_SMOKE_SRC='${src}' bash '${script}' 2>&1`, {
  cwd: ctx.repo,
  timeout: E2E_TIMEOUT_MS,
});
const output = String(r.stdout || "");
const status = classify(r.status, output);

try {
  writeFileSync(
    e2eResultPath(ctx),
    JSON.stringify(
      {
        kind: "e2e-result",
        status,
        source: src,
        finishedAt: new Date().toISOString(),
        output: output.split("\n").slice(-40).join("\n"),
      },
      null,
      2,
    ),
  );
} catch {
  // best-effort: the progress line and the hook log still record the outcome
}

appendProgress(ctx.sessionDir, `[e2e] suite ${status}`);
ctx.accept(`e2e ${status} src=${src}`);
