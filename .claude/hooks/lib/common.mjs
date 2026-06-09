// Portable path + identity helpers for Atomic CRM .claude hooks.
//
// These hooks were migrated from a hosted "chat-service" harness that hard-coded
// /app (repo), /chat-service/logs (per-session dir) and /home/developer/.claude
// (config home), and relied on injected env vars (CHAT_SESSION_DIR,
// CLAUDE_AGENT_NAME). None of that exists in a plain Claude Code checkout. This
// library derives every path from the running environment so the hooks work
// wherever the repo lives.
//
// Usage — import near the top of a hook, then derive identity from the stdin
// JSON the hook reads on fd 0:
//
//     import { readStdin, crmIdentity } from "./lib/common.mjs";
//     const ctx = crmIdentity(readStdin());
//     ctx.log("my-hook START");
//
// crmIdentity returns a context object with the session-scoped paths
// (sessionDir, worktreeBase, logFile, ticketsDir, flagsDir, sessionId,
// sessionShort, agentType, agentId, transcriptPath) plus bound helpers
// (log, linkNodeModules). Hooks that only need REPO / CONFIG_DIR / TEAMS_DIR
// can import those constants directly without calling crmIdentity.
//
// Portability model:
//   REPO          project root        <- $APP_DIR | $CLAUDE_PROJECT_DIR | git toplevel | $PWD
//   CONFIG_DIR    Claude config home  <- $CLAUDE_CONFIG_DIR | $HOME/.claude
//   TEAMS_DIR     team state          <- $CONFIG_DIR/teams
//   sessionId     full session id     <- stdin .session_id (Claude Code native)
//   sessionDir    per-session scratch <- /tmp/<REPO with '/'->'_'>/<sessionId>
//   worktreeBase  git worktrees       <- sessionDir (children: TASK-XXX, _session, simple)
//   logFile       hook log            <- sessionDir/hooks.log
//   ticketsDir    ticket JSON files   <- sessionDir/tickets
//   flagsDir      coordination flags  <- sessionDir/flags

import { readFileSync, readdirSync, mkdirSync, appendFileSync, existsSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// --- project root (replaces hard-coded /app) ------------------------------
// APP_DIR is honored as an explicit override (used by the hook tests) and kept
// as a back-compat alias; it otherwise tracks REPO.
function deriveRepo() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (top.status === 0 && top.stdout.trim()) return top.stdout.trim();
  return process.cwd();
}

export const REPO = deriveRepo();
export const APP_DIR = REPO;

// --- config home (replaces /home/developer/.claude) -----------------------
export const CONFIG_DIR =
  process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "/root", ".claude");
export const TEAMS_DIR = join(CONFIG_DIR, "teams");

// Root of per-session scratch. Tests / callers may override with CRM_TMP_ROOT.
export function tmpRoot() {
  return process.env.CRM_TMP_ROOT || "/tmp";
}

// Sanitize a path by replacing every "/" with "_" — implements the
// `${path.replace('/', '_')}` worktree-directory convention.
export function sanitizePath(p) {
  return String(p ?? "").replace(/\//g, "_");
}

// Repo default branch (base for worktrees / merge checks). Replaces hard-coded
// "master"/"main".
export function baseBranch() {
  const r = spawnSync("git", ["-C", REPO, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" });
  const name = r.status === 0 ? r.stdout.trim() : "";
  return name || "main";
}

// Read the hook's stdin (fd 0) as a string. Returns "" if nothing is piped.
export function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Parse a JSON string defensively — never throws, returns {} on failure.
export function parseJson(str) {
  try {
    return JSON.parse(str || "{}") || {};
  } catch {
    return {};
  }
}

// Read + parse a JSON file. Returns null on any error (missing / malformed).
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// Absolute paths of every <TEAMS_DIR>/<team>/config.json (the team registry).
// Mirrors `find "$TEAMS_DIR" -mindepth 2 -maxdepth 2 -name config.json`.
export function teamConfigs() {
  try {
    return readdirSync(TEAMS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(TEAMS_DIR, e.name, "config.json"))
      .filter((p) => existsSync(p));
  } catch {
    return [];
  }
}

// Run a command without throwing. Returns { status, stdout, stderr }.
// `status` is the numeric exit code (1 when the binary could not be spawned).
export function exec(file, args = [], opts = {}) {
  const r = spawnSync(file, args, { encoding: "utf8", ...opts });
  return {
    status: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
  };
}

// Run a shell pipeline via `bash -c`. Same return shape as exec().
export function bash(cmd, opts = {}) {
  return exec("bash", ["-c", cmd], opts);
}

// Convenience: `git -C <REPO> ...`. Returns { status, stdout, stderr }.
export function git(args = [], opts = {}) {
  return exec("git", ["-C", REPO, ...args], opts);
}

// Print a PreToolUse "block" decision to stdout (the JSON-decision mechanism).
// The caller still exits 0 afterwards — Claude Code reads the decision from stdout.
export function decisionBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
}

// Derive identity + session-scoped paths from a hook's stdin (raw JSON string or
// an already-parsed object). Ported from the original bash crm_identity.
export function crmIdentity(input) {
  const i = typeof input === "string" ? parseJson(input) : input || {};
  const clean = (s) => String(s ?? "").replace(/[\t\n]/g, " ");

  let sessionId = clean(i.session_id);
  let agentType = clean(i.agent_type);
  const agentId = clean(i.agent_id);
  const transcriptPath = clean(i.transcript_path);

  // Fallbacks. CLAUDE_AGENT_NAME / CHAT_SESSION_DIR are chat-service-era vars,
  // honored only if still injected, never required.
  if (!sessionId) sessionId = process.env.CLAUDE_CODE_SESSION_ID || "";
  if (!sessionId && process.env.CHAT_SESSION_DIR) sessionId = basename(process.env.CHAT_SESSION_DIR);
  if (!sessionId) sessionId = "default";
  if (!agentType) agentType = process.env.CLAUDE_AGENT_NAME || "";

  // First dash-segment of the session id — a short, readable branch component.
  const sessionShort = sessionId.split("-")[0];
  const sessionDir = join(tmpRoot(), sanitizePath(REPO), sessionId);
  const logFile = join(sessionDir, "hooks.log");

  const ctx = {
    repo: REPO,
    configDir: CONFIG_DIR,
    teamsDir: TEAMS_DIR,
    sessionId,
    agentType,
    agentId,
    transcriptPath,
    sessionShort,
    sessionDir,
    worktreeBase: sessionDir,
    logFile,
    ticketsDir: process.env.TICKETS_DIR || join(sessionDir, "tickets"),
    flagsDir: join(sessionDir, "flags"),

    // Append a timestamped line to logFile, creating its directory on demand.
    log(...parts) {
      try {
        mkdirSync(dirname(logFile), { recursive: true });
        appendFileSync(logFile, `[${new Date().toISOString()}] ${parts.join(" ")}\n`);
      } catch {
        // no-op safe — logging must never break a hook
      }
    },

    // Link the repo's node_modules into a worktree. Tries a hard-link tree
    // (fast, zero-copy, same filesystem) and falls back to a symlink when the
    // worktree is on a different filesystem (e.g. /tmp on tmpfs).
    linkNodeModules(wt) {
      const target = join(wt, "node_modules");
      if (existsSync(target)) return;
      if (!existsSync(join(REPO, "node_modules"))) return;
      if (exec("cp", ["-al", join(REPO, "node_modules"), target]).status === 0) return;
      try {
        symlinkSync(join(REPO, "node_modules"), target);
      } catch {
        // best-effort
      }
    },
  };

  return ctx;
}

// --- validation-runner helpers (shared by the SubagentStop check hooks) ----

// Active feature worktrees to validate. When VALIDATE_WORKTREE is set (by
// validate-before-review), restrict to that single worktree; otherwise every
// registered worktree under this session's worktreeBase. Mirrors the
// `git worktree list --porcelain | awk … | grep "^$WORKTREE_BASE/"` chain.
export function activeWorktrees(ctx) {
  const only = process.env.VALIDATE_WORKTREE;
  if (only && existsSync(only)) return [only];
  return git(["worktree", "list", "--porcelain"])
    .stdout.split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length))
    .filter((p) => p.startsWith(ctx.worktreeBase + "/"));
}

// True when a worktree has uncommitted changes OR commits ahead of base.
export function worktreeDirty(wt, base) {
  const changed = exec("git", ["-C", wt, "status", "--porcelain"]).stdout.trim();
  const ahead = exec("git", ["-C", wt, "log", "--oneline", `${base}..HEAD`]).stdout.trim();
  return Boolean(changed || ahead);
}

// Changed file paths in a worktree (committed vs base + working tree), deduped,
// empties dropped. Mirrors the `git diff --name-only … ; git status --porcelain
// | awk '{print $NF}' | sort -u | grep -v '^$'` pipeline.
export function worktreeChangedFiles(wt, base) {
  const files = new Set();
  const committed = exec("git", ["-C", wt, "diff", "--name-only", `${base}..HEAD`]).stdout;
  for (const l of committed.split("\n")) if (l.trim()) files.add(l.trim());
  const working = exec("git", ["-C", wt, "status", "--porcelain"]).stdout;
  for (const l of working.split("\n")) {
    const t = l.trim();
    if (!t) continue;
    const parts = t.split(/\s+/);
    files.add(parts[parts.length - 1]); // $NF — last field
  }
  return [...files];
}

// Keep only the last `n` lines of a text blob (like `tail -n`).
export function tailLines(text, n) {
  return text.split("\n").slice(-n).join("\n");
}

// Run vitest once (CI mode, headless) against a config file, capturing output
// via a temp file rather than a pipe. The bash hooks did this deliberately: a
// lingering vitest worker can keep the stdout pipe open after the main process
// exits, which would hang a $()-style capture forever. Writing to a file lets
// the parent return as soon as the (coreutils) `timeout` wrapper exits.
// Returns { status, output, timedOut }. status 124 == timeout.
// `projects` (optional) narrows the run to specific vitest projects via repeated
// --project flags — used since the app/claude/functions suites share one config.
export function runVitest(wt, configFile, projects = []) {
  const projectTag = projects.length ? `-${projects.join("-")}` : "";
  const out = join(tmpdir(), `vitest-${basename(configFile)}${projectTag}-${process.pid}.out`);
  const projectFlags = projects.map((p) => `--project ${p}`).join(" ");
  const r = bash(
    `CI=true timeout 180 npx vitest run --config ${configFile} ${projectFlags} > "${out}" 2>&1`,
    { cwd: wt },
  );
  let output = "";
  try {
    output = tailLines(readFileSync(out, "utf8"), 40);
  } catch {
    // no output file — leave empty
  }
  try {
    unlinkSync(out);
  } catch {
    // best-effort cleanup
  }
  return { status: r.status, output, timedOut: r.status === 124 };
}
