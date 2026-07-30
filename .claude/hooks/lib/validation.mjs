import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { getBaseBranch, getWorktreeChangeSummary, getWorktreePaths } from "./git.mjs";
import { bash, exec } from "./process.mjs";
import { loadConfig, validationSteps } from "./config.mjs";
import { appendProgress } from "./progress-log.mjs";

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

function runVitest(wt, configFile, projects = [], changedSince = "") {
  const projectTag = projects.length ? `-${projects.join("-")}` : "";
  const out = join(tmpdir(), `vitest-${basename(configFile)}${projectTag}-${process.pid}.out`);
  const projectFlags = projects.map((p) => `--project ${p}`).join(" ");
  // Scope to tests related to THIS worktree's diff since `changedSince` (the session
  // branch it forked from), so a ticket runs only its own affected tests, not the whole
  // suite. Pass the ref EXPLICITLY: the ticket's work is committed by stop time,
  // so a bare `--changed` (uncommitted-only) would find nothing and run zero tests (false
  // green). Empty ref -> full run (safe fallback). The end-of-feature smoke re-runs the
  // full suite on the integrated session branch, catching anything the module graph missed.
  const changedFlag = changedSince ? `--changed ${changedSince}` : "";
  const r = bash(
    `CI=true timeout 180 npx vitest run --config ${configFile} ${projectFlags} ${changedFlag} > "${out}" 2>&1`,
    { cwd: wt },
  );
  const output = tailFile(out, 40);
  tryUnlink(out);
  return { status: r.status, output, timedOut: r.status === 124 };
}

// Files this worktree changed that lint should check: the config `extensions`,
// restricted to paths that still exist on disk. A deleted / renamed-away file
// must not be handed to eslint (it would error "No files matching"). Pure —
// unit-tested independently of the shell-out.
export function scopedLintFiles(changedFiles, cwd, extensions) {
  return changedFiles.filter(
    (f) => extensions.some((e) => f.endsWith(e)) && existsSync(join(cwd, f)),
  );
}

// Run eslint on ONLY this worktree's diff since `base` (the session branch it
// forked from), mirroring the vitest `--changed` scoping: a ticket is judged on
// its own changed files, never the whole repo — which also sidesteps pre-existing
// lint noise in unrelated / generated files. Zero matching files -> nothing to
// lint (ok). `base` empty -> repo base branch, matching getWorktreesToValidate.
// `command` is the eslint invocation prefix (e.g. `npx eslint`); files are
// appended here, so the config command must NOT carry its own file glob.
function runEslintScoped(cwd, base, command, extensions, tail) {
  const { changedFiles } = getWorktreeChangeSummary(cwd, base || getBaseBranch());
  const files = scopedLintFiles(changedFiles, cwd, extensions);
  if (files.length === 0) return { ok: true };
  const out = join(tmpdir(), `eslint-${process.pid}.out`);
  const args = files.map((f) => `'${f.replace(/'/g, `'\\''`)}'`).join(" ");
  const r = bash(`${command} ${args} > "${out}" 2>&1`, { cwd });
  const output = tailFile(out, tail);
  tryUnlink(out);
  return r.status === 0 ? { ok: true } : { ok: false, output };
}

// Per-kind tail length for failure output (mechanical, not a project fact).
const TAIL_LINES = { format: 15, typecheck: 20, lint: 30, unit: 40, e2e: 50 };

// A step is skipped when its `condition` is not met. `pathExists` gates on a
// path under the repo (e.g. the supabase/functions unit-fn gate); `modeNot`
// skips when MODE equals the given value (e.g. e2e in demo mode).
function stepSkipped(ctx, step) {
  const c = step.condition;
  if (!c) return false;
  if (c.pathExists && !existsSync(join(ctx.repo, c.pathExists))) {
    ctx.log(`SKIP ${step.id} (no ${c.pathExists})`);
    return true;
  }
  if (c.modeNot && (process.env.MODE || "demo") === c.modeNot) {
    ctx.log(`${step.id} skipped (${c.modeNot} mode)`);
    return true;
  }
  return false;
}

// Run ONE config-declared step in `cwd`. Returns { ok } or { ok:false, output }.
// The step id is the caller's fail-report label, so config ids (prettier,
// typecheck, unit-app, unit-fn, e2e) ARE the reported step names.
function runStep(ctx, step, { cwd, base }) {
  const tail = TAIL_LINES[step.kind] ?? 40;

  if (step.runner === "vitest") {
    const r = runVitest(cwd, step.config, step.projects, step.changedScoped ? base : "");
    if (r.timedOut) return { ok: false, output: "TIMEOUT (>180s) -- vitest did not exit. Tests may be hanging." };
    return r.status === 0 ? { ok: true } : { ok: false, output: r.output };
  }

  if (step.kind === "lint" && step.changedScoped) {
    const exts = step.extensions ?? [".ts", ".tsx", ".mjs"];
    return runEslintScoped(cwd, base, step.command, exts, tail);
  }

  const r = bash(`${step.command} 2>&1`, { cwd });
  if (r.status === 0) {
    if (step.kind === "format" && step.autoCommit) {
      if (exec("git", ["-C", cwd, "diff", "--quiet"]).status !== 0) {
        exec("git", ["-C", cwd, "add", "-A"]);
        exec("git", ["-C", cwd, "commit", "-m", `style(${basename(cwd)}): auto-apply prettier`]);
        ctx.log(`auto-prettier committed wt=${cwd}`);
      }
    }
    return { ok: true };
  }
  const detail =
    step.kind === "format"
      ? "Prettier could not format one or more files (likely a syntax error). Fix the issue and commit.\n" +
        tailLines(r.stdout, tail)
      : tailLines(r.stdout, tail);
  return { ok: false, output: detail };
}

// The full validation chain, run by validate-on-stop.mjs on SubagentStop (after
// every developer stop). Steps are declared in harness.config.json's
// `validation.steps` (single source of truth, shared with bash-guard) and run in
// config order: steps without `cwd:"repo"` run per dirty worktree (fail-fast);
// `cwd:"repo"` steps (e2e) run once in the repo after the per-worktree pass.
// VALIDATE_DRY_RUN=1 skips everything, =fail simulates a failure. A malformed
// config fails closed. Returns { ok:true, skipReason? } or { ok:false, step, output }.
export function runValidationSteps(ctx, { worktree = "", base = "" } = {}) {
  if (process.env.VALIDATE_DRY_RUN === "1") {
    ctx.log("DRY_RUN=1, skipping validation");
    return { ok: true, skipReason: "dry_run" };
  }
  if (process.env.VALIDATE_DRY_RUN === "fail") {
    ctx.log("DRY_RUN=fail, simulating a failure");
    return { ok: false, step: "dry-run", output: "Validation failed (simulated)." };
  }

  let steps;
  try {
    steps = validationSteps(loadConfig(ctx.repo));
  } catch (e) {
    // Fail closed: a malformed config must block the stop, not silently pass.
    return { ok: false, step: "config", output: `${e.message}\n` };
  }

  const { worktrees, skipReason } = getWorktreesToValidate(ctx, {
    skipAdrOnly: true,
    only: worktree,
    base,
  });
  if (skipReason) return { ok: true, skipReason };

  const perWorktree = steps.filter((s) => s.cwd !== "repo");
  const repoLevel = steps.filter((s) => s.cwd === "repo");

  // Enrich the #technical-harness progress log with each validation step as it runs,
  // so the otherwise-silent multi-minute chain (typecheck, lint, vitest, e2e) shows up
  // in a `tail -f` / the board / a Monitor. Inert (no-op) on a non-technical run: the
  // log does not exist there, so appendProgress writes nothing and creates nothing.
  const progress = (line) => appendProgress(ctx.sessionDir, line);

  for (const wt of worktrees) {
    const label = basename(wt);
    for (const step of perWorktree) {
      if (stepSkipped(ctx, step)) continue;
      progress(`[validate:${label}] ${step.id}…`);
      const r = runStep(ctx, step, { cwd: wt, base });
      if (!r.ok) {
        progress(`[validate:${label}] ${step.id} FAILED`);
        ctx.log(`FAIL step=${step.id} wt=${wt}\n${r.output}`);
        return { ok: false, step: step.id, output: `=== ${step.id} failed in ${wt} ===\n${r.output}\n` };
      }
    }
    progress(`[validate:${label}] checks passed`);
    ctx.log(`OK wt=${wt}`);
  }

  for (const step of repoLevel) {
    if (stepSkipped(ctx, step)) continue;
    progress(`[validate:repo] ${step.id}…`);
    const r = runStep(ctx, step, { cwd: ctx.repo, base });
    if (!r.ok) {
      progress(`[validate:repo] ${step.id} FAILED`);
      ctx.log(`FAIL step=${step.id} exit`);
      return { ok: false, step: step.id, output: r.output + "\n" };
    }
    ctx.log(`${step.id} OK`);
  }

  return { ok: true };
}
