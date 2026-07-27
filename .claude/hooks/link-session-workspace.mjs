#!/usr/bin/env node
// SessionStart: maintain a stable ".harness-session" symlink in the VS Code
// multi-root workspace, pointing at the CURRENT session dir. The harness
// tickets live in that dir (TICKETS_DIR), so this keeps them visible in the
// editor for plan-gate validation. The session dir path carries the
// per-session id, so a static workspace folder entry would go stale every
// session; the .code-workspace references the stable symlink name instead and
// this hook repoints the symlink at each session start.
//
// No-op when a managed launcher owns the session (CHAT_SESSION_DIR set, it has
// its own UI) or when the repo's parent is not a VS Code multi-root workspace
// (no *.code-workspace file beside it). Never throws: a convenience feature
// must not break a session.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createHookContext } from "./lib/context.mjs";

const LINK_NAME = ".harness-session";

// A managed launcher (chat-service) owns the session and its own UI; there is
// no VS Code workspace to manage.
if (process.env.CHAT_SESSION_DIR) process.exit(0);

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // no payload, nothing to do
  process.exit(0);
}

const ctx = createHookContext(input, "link-session-workspace");

const isSymlink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

try {
  // The .code-workspace file sits beside the repo (its parent dir is the
  // multi-root workspace root). Only act when that layout is present.
  const workspaceRoot = dirname(ctx.repo);
  const inWorkspace =
    existsSync(workspaceRoot) &&
    readdirSync(workspaceRoot).some((f) => f.endsWith(".code-workspace"));
  if (!inWorkspace) {
    ctx.log(`no .code-workspace beside ${ctx.repo}, skip`);
    process.exit(0);
  }

  // Never leave a dangling link: ensure the target exists first.
  mkdirSync(ctx.sessionDir, { recursive: true });

  const linkPath = join(workspaceRoot, LINK_NAME);
  if (existsSync(linkPath) || isSymlink(linkPath)) {
    if (!isSymlink(linkPath)) {
      // A real file/dir is sitting there, do not clobber it.
      ctx.log(`${linkPath} exists and is not a symlink, skip`);
      process.exit(0);
    }
    let current = "";
    try {
      current = readlinkSync(linkPath);
    } catch {
      // unreadable link, replace it
    }
    if (current === ctx.sessionDir) {
      ctx.log(`already linked to ${ctx.sessionDir}`);
      process.exit(0);
    }
    rmSync(linkPath, { force: true });
  }
  symlinkSync(ctx.sessionDir, linkPath);
  ctx.log(`linked ${LINK_NAME} -> ${ctx.sessionDir}`);
} catch (e) {
  ctx.log(`skipped: ${e?.message ?? e}`);
}

process.exit(0);
