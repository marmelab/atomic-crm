// Build a hook context from a hook's stdin payload: identity, session-scoped
// paths, a logger, and terminal accept/block/fail helpers. The `name` is the
// hook's label; log() and error() prefix every line with `[name]`, and
// accept/block/fail add the `ACCEPT|BLOCK|FAIL` verb on top — so call sites pass
// only the detail and never repeat the name.

import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { decisionBlock } from "./io.mjs";
import { REPO, TMP_ROOT, sanitizePath } from "./paths.mjs";
import { exec } from "./process.mjs";

/**
 * @param {string | Record<string, unknown>} input
 * @param {string} [name]
 * @returns {object}
 */
export function createHookContext(input, name = "hook") {
  const i = typeof input === "string" ? JSON.parse(input) : input || {};
  const clean = (s) => String(s ?? "").replace(/[\t\n]/g, " ");

  const agentId = clean(i.agent_id);
  // agentName: env var carries the suffixed runtime name (e.g. developer-TASK-001)
  // in PostToolUse/PreToolUse contexts; for SubagentStart the env is the parent's,
  // so fall back to i.agent_name which Claude Code populates with the child's name.
  const agentName = process.env.CLAUDE_AGENT_NAME || clean(i.agent_name) || "";
  const chatSessionId = process.env.CHAT_SESSION_DIR ? basename(process.env.CHAT_SESSION_DIR) : "";

  const sessionId =
    clean(i.session_id) || process.env.CLAUDE_CODE_SESSION_ID || chatSessionId || "default";
  const agentType = clean(i.agent_type) || agentName;

  const sessionShort = sessionId.split("-")[0];
  const sessionDir = join(TMP_ROOT, sanitizePath(REPO), sessionId);
  const logFile = join(sessionDir, "hooks.log");

  /**
   * @param {...unknown} parts
   * @returns {void}
   */
  const log = (...parts) => {
    try {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(
        logFile,
        `[${new Date().toISOString()}] [${name}] ${parts.join(" ")}\n`,
      );
    } catch {
      // logging must never break a hook
    }
  };

  /**
   * Write to stderr (the agent-visible channel), prefixed with `[${name}]` the
   * same way log() prefixes each log line. The prefix is added once, so
   * multi-line payloads (compiler/test output) stay readable; a trailing
   * newline is ensured.
   * @param {...unknown} parts
   * @returns {void}
   */
  const error = (...parts) => {
    const text = parts.join(" ");
    process.stderr.write(`[${name}] ${text}${text.endsWith("\n") ? "" : "\n"}`);
  };

  const verdict = (verb, detail) => log(detail ? `${verb} ${detail}` : verb);

  return {
    name,
    repo: REPO,
    sessionId,
    agentType,
    agentName,
    agentId,
    sessionShort,
    sessionDir,
    worktreeBase: sessionDir,
    logFile,
    ticketsDir: process.env.TICKETS_DIR || join(sessionDir, "tickets"),

    log,
    error,

    /**
     * @param {string} [detail]
     * @returns {never}
     */
    accept(detail) {
      verdict("ACCEPT", detail);
      process.exit(0);
    },

    /**
     * @param {{ reason: string, log?: string }} options
     * @returns {never}
     */
    block({ reason, log: detail }) {
      verdict("BLOCK", detail);
      decisionBlock(reason);
      process.exit(0);
    },

    /**
     * @param {string} message
     * @param {{ log?: string }} [options]
     * @returns {never}
     */
    fail(message, { log: detail } = {}) {
      verdict("FAIL", detail);
      error(message);
      process.exit(2);
    },

    /**
     * @param {string} wt
     * @returns {void}
     */
    linkNodeModules(wt) {
      const target = join(wt, "node_modules");
      if (existsSync(target)) return;
      const source = join(REPO, "node_modules");
      if (!existsSync(source)) return;
      // Fast path: hardlink tree (cp -al) when the worktree base shares a
      // filesystem with the repo. In dev containers /tmp and /workspaces are
      // different mounts (cross-device), so cp -al fails — fall back to a full
      // real copy. A symlinked node_modules is NOT an option: vitest browser
      // mode (Chromium) hangs on it. See memory worktree-node-modules-provisioning.
      if (exec("cp", ["-al", source, target]).status === 0) return;
      rmSync(target, { recursive: true, force: true });
      if (exec("cp", ["-a", source, target]).status !== 0) {
        rmSync(target, { recursive: true, force: true });
        throw new Error(`node_modules provisioning failed for ${wt} — cp -al and cp -a both failed`);
      }
    },
  };
}
