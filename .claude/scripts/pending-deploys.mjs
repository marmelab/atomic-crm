#!/usr/bin/env node
// pending-deploys — decide whether the session has schema-relevant changes
// not yet covered by supabase/migrations/.
//
//   pending-deploys --app <APP_DIR> --session <SESSION_SHORT>
//
// Prints a non-empty marker (the changed schema-relevant paths) when a deploy
// is worth offering; prints nothing otherwise.
//
// Exit codes:
//   0 — decision made (stdout empty = nothing to deploy, non-empty = paths).
//   3 — could NOT decide: --session missing, or the passed <SESSION_SHORT>
//       has session-base siblings but no refs of its own (likely a mismatch).
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
};
const APP = get("--app", process.env.CLAUDE_PROJECT_DIR || "/app");
const SESSION = get("--session", "");
if (!SESSION) {
  // Couldn't decide — exit 3, never 0 (0 + empty stdout reads as "nothing to
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
//   - NO session-base/* branch exists at all → no topology (e.g. hooks never
//     ran, or a non-session context) → genuinely nothing to deploy → exit 0.
//   - session-base/* branches exist but NOT for <SESSION> → the caller passed
//     the wrong short id → fail loudly so the deploy isn't silently skipped.
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
    /* not a git repo / no refs — treated as no topology below */
  }
  if (bases) {
    process.stderr.write(
      `pending-deploys: no session refs for '${SESSION}', but found: ${bases.split("\n").join(", ")}. ` +
        `Likely a SESSION_SHORT_ID mismatch — refusing to report "nothing to deploy".\n`,
    );
    process.exit(3);
  }
  process.exit(0); // no session topology anywhere → nothing to deploy
}

// Schema-relevant path heuristic: entity types, fake-data generators, resource
// registrations, and SQL schema files modified by simple-developer.
// Anchored to avoid matching arbitrary paths with "fake" substrings.
const SCHEMA_RE =
  /(\/types?\.ts$|dataProvider|\/dataGenerator\/|supabase\/schemas\/|resources?\/.*\.(ts|tsx)$)/i;

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
// migration round, which cross-checks supabase/migrations/ and may no-op.)
if (relevant.length) process.stdout.write(`${relevant.join("\n")}\n`);
