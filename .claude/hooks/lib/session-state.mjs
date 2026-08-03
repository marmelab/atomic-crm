// In-flight detection for a harness session, keyed STRICTLY off the current
// session's own id (ctx.sessionShort / ctx.sessionDir). Because Claude Code
// reuses the same session id when a conversation is resumed (verified: a single
// transcript spans multi-hour close/reopen gaps under one id), the same session
// recomputes the same namespace on resume — so "is THIS session mid-harness?"
// is answerable from disk + git alone, with no global state. Two concurrent
// sessions have distinct ids => distinct namespaces => this never crosses them,
// which is what makes the resume machinery multi-session safe by construction.
//
// Consumers: session-bootstrap (SessionStart banner offering resume) and
// cleanup-session (SessionEnd guard that preserves an in-flight session's state
// instead of deleting it). STATE RECOVERY in the orchestrator does the precise
// re-classification; this only answers "worth resuming, and roughly where".

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./paths.mjs";
import { exec } from "./process.mjs";
import { getBaseBranch, git } from "./git.mjs";
import { sessionBranch } from "./topology.mjs";

const TICKET_RE = /^TASK-\d+\.json$/;

// Tickets live in the session dir itself or a `tickets/` subdir - try both, same
// as render-status.mjs. Unreadable JSON counts as a ticket (status "unreadable"),
// so a corrupt file never silently downgrades an in-flight session to "done".
function readTickets(ctx) {
  for (const dir of [ctx.ticketsDir, ctx.sessionDir]) {
    if (!existsSync(dir)) continue;
    let files;
    try {
      files = readdirSync(dir).filter((f) => TICKET_RE.test(f));
    } catch {
      continue;
    }
    if (!files.length) continue;
    return files.map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch {
        return { status: "unreadable" };
      }
    });
  }
  return [];
}

const verifyRef = (ref) =>
  git(["rev-parse", "--verify", "--quiet", ref]).status === 0;

// The base branch this session forked from: setup-worktree records it in
// .git/config (sessionbase.<short>.branch); fall back to the repo's base branch.
function forkBaseBranch(ctx) {
  const r = git(["config", "--get", `sessionbase.${ctx.sessionShort}.branch`]);
  return (r.status === 0 && r.stdout.trim()) || getBaseBranch();
}

// A deploy-time migration still pending after promotion. Best-effort: any
// non-zero exit (including 3 = undetermined) is read as "nothing pending", so a
// missing deploy adapter or an odd state never fabricates a migration gate.
function pendingDeploy(ctx) {
  const script = join(REPO, ".claude", "scripts", "pending-deploys.mjs");
  if (!existsSync(script)) return false;
  // Bounded: a hung probe must never wedge the SessionStart/SessionEnd hooks.
  // On timeout spawnSync sets an error → non-zero status → read as "nothing
  // pending" (the pre-promotion preserve conditions already covered the risky
  // windows; a promoted branch is git-recoverable regardless).
  const r = exec(
    "node",
    [script, "--app", REPO, "--session", ctx.sessionShort],
    { timeout: 10000 },
  );
  return r.status === 0 && Boolean(r.stdout.trim());
}

/**
 * @param {object} ctx  hook context (createHookContext)
 * @param {{ checkDeploy?: boolean }} [opts]  run the deploy-gate probe (default true)
 * @returns {{ inflight: boolean|null, phase: string|null }}
 *   inflight true = resume it; false = nothing/finished; null = undetermined
 *   (an error mid-probe) so callers can fail safe. `phase` is a human hint.
 */
export function detectInflight(ctx, { checkDeploy = true } = {}) {
  try {
    const short = ctx.sessionShort;
    if (!short || short === "default") return { inflight: false, phase: null };

    const tickets = readTickets(ctx);
    const hasTickets = tickets.length > 0;
    const allMerged =
      hasTickets && tickets.every((t) => t.status === "merged");
    const sessRef = sessionBranch(ctx); // session/<short>
    const branchExists = verifyRef(`refs/heads/${sessRef}`);

    // Tickets created but not all merged: plan gate leaves ONLY the tickets on
    // disk (no session branch yet); once dev started it is a mid-wave stop.
    if (hasTickets && !allMerged) {
      return { inflight: true, phase: branchExists ? "mid-wave" : "plan gate" };
    }

    // No session branch and nothing unmerged: nothing was forked yet.
    if (!branchExists) return { inflight: false, phase: null };

    // Session branch exists. Promoted into its fork base yet?
    const base = forkBaseBranch(ctx);
    const promoted =
      verifyRef(`refs/heads/${base}`) &&
      git(["merge-base", "--is-ancestor", sessRef, base]).status === 0;
    if (!promoted) {
      return { inflight: true, phase: "waves done, awaiting promotion" };
    }

    // Promoted: only the deploy-time migration can still be pending.
    if (checkDeploy && pendingDeploy(ctx)) {
      return { inflight: true, phase: "migration gate" };
    }
    return { inflight: false, phase: null };
  } catch {
    return { inflight: null, phase: null };
  }
}
