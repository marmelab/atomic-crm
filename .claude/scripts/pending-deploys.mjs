#!/usr/bin/env node
// pending-deploys: decide whether the session has deploy-relevant changes not
// yet covered by the migrations dir.
//
//   pending-deploys --app <APP_DIR> --session <SESSION_SHORT>
//
// Prints a non-empty marker (the changed deploy-relevant paths) when a deploy is
// worth offering; prints nothing otherwise.
//
// Exit codes:
//   0 - decision made (stdout empty = nothing to deploy, non-empty = paths).
//   3 - could NOT decide: --session missing, or the passed <SESSION_SHORT>
//       has session-base siblings but no refs of its own (likely a mismatch).
import { execFileSync } from "node:child_process";
import {
  loadConfig,
  isDeployEnabled,
  deployGlobs,
} from "../hooks/lib/config.mjs";

// Convert a deploy-relevant glob (config.deploy.relevantGlobs) into an anchored
// regex source. `**/` -> optional dir prefix, `**` -> any, `*` -> non-slash. The
// git diff paths are repo-relative, so anchor at the start.
export function globToRegexSource(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // Placeholder the glob operators FIRST, expand `*` last, then swap the
  // placeholders in. Otherwise the `.*` inserted for `**` would be re-mangled by
  // the single-`*` -> `[^/]*` pass.
  const body = escaped
    .replace(/\*\*\//g, "\0DS\0")
    .replace(/\*\*/g, "\0D\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0DS\0/g, "(?:.*/)?")
    .replace(/\0D\0/g, ".*");
  return `^${body}`;
}

// The single deploy-relevance matcher, built from config.deploy.relevantGlobs
// (one definition, shared with the orchestrator's SIMPLE-review gate and
// the planner's schema wording). Empty globs -> matches nothing.
export function relevanceRegex(globs) {
  if (!globs.length) return /a^/; // never matches
  return new RegExp(globs.map(globToRegexSource).join("|"));
}

function main() {
  const args = process.argv.slice(2);
  const get = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : def;
  };
  const APP = get("--app", process.env.CLAUDE_PROJECT_DIR || "/app");
  const SESSION = get("--session", "");

  // Pluggable deploy phase: the migration round exists ONLY if this
  // project configures a deploy adapter. With no config.deploy, there is nothing
  // to deploy, so exit 0 (empty) and the orchestrator terminates at promotion
  // with no PD state.
  let cfg;
  try {
    cfg = loadConfig(APP);
  } catch (e) {
    process.stderr.write(`pending-deploys: ${e.message}\n`);
    process.exit(3);
  }
  if (!isDeployEnabled(cfg)) process.exit(0);

  if (!SESSION) {
    // Couldn't decide - exit 3, never 0 (0 + empty stdout reads as "nothing to
    // deploy", which would silently skip a real pending deploy).
    process.stderr.write("--session <SESSION_SHORT> required\n");
    process.exit(3);
  }

  const refExists = (ref) => {
    try {
      execFileSync("git", ["-C", APP, "show-ref", "--verify", "--quiet", ref], {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  };

  // Guard against the SESSION_SHORT_ID mismatch. The session topology
  // (session-base/<id> + session/<id>) is created at session start, so missing
  // refs for the requested id are suspicious. Distinguish two cases:
  //   - NO session-base/* branch exists at all -> no topology (e.g. hooks never
  //     ran, or a non-session context) -> genuinely nothing to deploy -> exit 0.
  //   - session-base/* branches exist but NOT for <SESSION> -> the caller passed
  //     the wrong short id -> fail loudly so the deploy isn't silently skipped.
  if (
    !refExists(`refs/heads/session-base/${SESSION}`) ||
    !refExists(`refs/heads/session/${SESSION}`)
  ) {
    let bases = "";
    try {
      bases = execFileSync(
        "git",
        [
          "-C",
          APP,
          "for-each-ref",
          "--format=%(refname:short)",
          "refs/heads/session-base/",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      )
        .toString()
        .trim();
    } catch {
      /* not a git repo / no refs - treated as no topology below */
    }
    if (bases) {
      process.stderr.write(
        `pending-deploys: no session refs for '${SESSION}', but found: ${bases.split("\n").join(", ")}. ` +
          `Likely a SESSION_SHORT_ID mismatch - refusing to report "nothing to deploy".\n`,
      );
      process.exit(3);
    }
    process.exit(0); // no session topology anywhere -> nothing to deploy
  }

  // Deploy-relevance from config.deploy.relevantGlobs: one definition of
  // "deploy-relevant paths", not a hardcoded regex. A real migration requires a
  // change under these globs (the DDL source of truth), so this is both
  // necessary and sufficient to decide whether to offer the migration round.
  const SCHEMA_RE = relevanceRegex(deployGlobs(cfg));

  let changed = "";
  try {
    changed = execFileSync(
      "git",
      [
        "-C",
        APP,
        "diff",
        "--name-only",
        `session-base/${SESSION}..session/${SESSION}`,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    ).toString();
  } catch (e) {
    process.stderr.write(
      `pending-deploys: git diff failed for '${SESSION}': ${e.message}\n`,
    );
    process.exit(3);
  }

  const relevant = changed
    .split("\n")
    .filter(Boolean)
    .filter((p) => SCHEMA_RE.test(p));
  // (Idempotency against already-applied schema is enforced later by the
  // migration round, which cross-checks the migrations dir and may no-op.)
  if (relevant.length) process.stdout.write(`${relevant.join("\n")}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
