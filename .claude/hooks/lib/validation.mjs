import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { getBaseBranch, getWorktreeChangeSummary, getWorktreePaths } from "./git.mjs";
import { bash, exec } from "./process.mjs";

// `only` narrows to a single worktree when the caller already knows it
// (validate-on-stop scoping to the stopping agent's own task worktree);
// VALIDATE_WORKTREE is the test override. Either falls back to all session
// worktrees when the path is gone.
export function getActiveWorktrees(ctx, only = "") {
  const narrowed = only || process.env.VALIDATE_WORKTREE || "";
  if (narrowed && existsSync(narrowed)) return [narrowed];
  return getWorktreePaths().filter((p) => p.startsWith(ctx.worktreeBase + "/"));
}

// Pure query — never exits. An empty list with a non-empty skipReason means
// there is nothing to validate.
function getWorktreesToValidate(ctx, { skipAdrOnly = false, only = "", base = "" } = {}) {
  if (!existsSync(ctx.repo)) {
    return { worktrees: [], skipReason: "cd_failed" };
  }
  const active = getActiveWorktrees(ctx, only);
  if (active.length === 0) {
    return { worktrees: [], skipReason: "no_active_worktree" };
  }
  // Compare against the branch the worktree forked from (the session branch,
  // passed by validate-on-stop) so the change set is the ticket's OWN work, not
  // everything since the repo's checked-out base branch — which would over- or
  // under-report a worktree's delta whenever the base branch has diverged from
  // the session branch. Falls back to the repo base branch when no override.
  const effectiveBase = base || getBaseBranch();
  const isAdrOnly = (files) => files.length > 0 && files.every((f) => f.startsWith("adr/"));
  const worktrees = active.filter((wt) => {
    const { dirty, changedFiles } = getWorktreeChangeSummary(wt, effectiveBase);
    if (!dirty) {
      ctx.log(`SKIP wt=${wt} (no changes)`);
      return false;
    }
    if (skipAdrOnly && isAdrOnly(changedFiles)) {
      ctx.log(`SKIP wt=${wt} (adr-only)`);
      return false;
    }
    return true;
  });
  return { worktrees, skipReason: worktrees.length === 0 ? "no_dirty_worktree" : "" };
}

const tailLines = (text, n) => text.split("\n").slice(-n).join("\n");

// Last `n` lines of a file, "" if it can't be read.
const tailFile = (path, n) => {
  try {
    return tailLines(readFileSync(path, "utf8"), n);
  } catch {
    return "";
  }
};

// Best-effort cleanup — a leftover temp file must never break validation.
const tryUnlink = (path) => {
  try {
    unlinkSync(path);
  } catch {
    /* swallow error */
  }
};

function runVitest(wt, configFile, projects = []) {
  const projectTag = projects.length ? `-${projects.join("-")}` : "";
  const out = join(tmpdir(), `vitest-${basename(configFile)}${projectTag}-${process.pid}.out`);
  const projectFlags = projects.map((p) => `--project ${p}`).join(" ");
  const r = bash(
    `CI=true timeout 180 npx vitest run --config ${configFile} ${projectFlags} > "${out}" 2>&1`,
    { cwd: wt },
  );
  const output = tailFile(out, 40);
  tryUnlink(out);
  return { status: r.status, output, timedOut: r.status === 124 };
}

// The full validation chain, run by validate-on-stop.mjs on SubagentStop (after
// every developer stop, ticket or lightweight MODE). Per dirty worktree, fail-fast: prettier auto-fix (+ commit),
// typecheck, unit app, unit functions; then e2e once in the repo (full mode
// only). VALIDATE_DRY_RUN=1 skips everything, =fail simulates a failure.
// Returns { ok: true, skipReason? } or { ok: false, step, output }.
export function runValidationSteps(ctx, { worktree = "", base = "" } = {}) {
  if (process.env.VALIDATE_DRY_RUN === "1") {
    ctx.log("DRY_RUN=1, skipping validation");
    return { ok: true, skipReason: "dry_run" };
  }
  if (process.env.VALIDATE_DRY_RUN === "fail") {
    ctx.log("DRY_RUN=fail, simulating a failure");
    return { ok: false, step: "dry-run", output: "Validation failed (simulated)." };
  }

  const { worktrees, skipReason } = getWorktreesToValidate(ctx, {
    skipAdrOnly: true,
    only: worktree,
    base,
  });
  if (skipReason) return { ok: true, skipReason };

  const hasFunctions = existsSync(join(ctx.repo, "supabase", "functions"));

  for (const wt of worktrees) {
    const failed = (step, output) => {
      ctx.log(`FAIL step=${step} wt=${wt}\n${output}`);
      return { ok: false, step, output: `=== ${step} failed in ${wt} ===\n${output}\n` };
    };

    const pretty = bash(
      "npx prettier --write 'src/**/*.{ts,tsx,js,jsx,css,json,html}' 2>&1",
      { cwd: wt },
    );
    if (pretty.status !== 0) {
      return failed(
        "prettier",
        "Prettier could not format one or more files (likely a syntax error). Fix the issue and commit.\n" +
          tailLines(pretty.stdout, 15),
      );
    }
    if (exec("git", ["-C", wt, "diff", "--quiet"]).status !== 0) {
      exec("git", ["-C", wt, "add", "-A"]);
      exec("git", ["-C", wt, "commit", "-m", `style(${basename(wt)}): auto-apply prettier`]);
      ctx.log(`auto-prettier committed wt=${wt}`);
    }

    const typecheck = bash("npm run typecheck 2>&1", { cwd: wt });
    if (typecheck.status !== 0) return failed("typecheck", tailLines(typecheck.stdout, 20));

    const app = runVitest(wt, "vitest.config.ts", ["app", "claude"]);
    if (app.timedOut) return failed("unit-app", "TIMEOUT (>180s) -- vitest did not exit. Tests may be hanging.");
    if (app.status !== 0) return failed("unit-app", app.output);

    if (hasFunctions) {
      const fn = runVitest(wt, "vitest.config.ts", ["functions"]);
      if (fn.timedOut) return failed("unit-fn", "TIMEOUT (>180s) -- vitest did not exit. Tests may be hanging.");
      if (fn.status !== 0) return failed("unit-fn", fn.output);
    }

    ctx.log(`OK wt=${wt}`);
  }

  const mode = process.env.MODE || "demo";
  if (mode === "demo") {
    ctx.log("e2e skipped (demo mode)");
    return { ok: true };
  }
  const e2e = bash("npx playwright test 2>&1", { cwd: ctx.repo });
  if (e2e.status !== 0) {
    ctx.log(`FAIL step=e2e exit=${e2e.status}`);
    return { ok: false, step: "e2e", output: tailLines(e2e.stdout, 50) + "\n" };
  }
  ctx.log("e2e OK");
  return { ok: true };
}
