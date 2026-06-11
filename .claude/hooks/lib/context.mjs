// Build a hook context from a hook's stdin payload: identity, session-scoped
// paths, a logger, and terminal accept/block/fail helpers. The `name` is the
// hook's label; log() and error() prefix every line with `[name]`, and
// accept/block/fail add the `ACCEPT|BLOCK|FAIL` verb on top — so call sites pass
// only the detail and never repeat the name.

import { appendFileSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
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
  // agentName is the runtime-assigned (possibly TASK-suffixed) name from the
  // environment; agentType prefers the payload's agent_type and falls back to it.
  const agentName = process.env.CLAUDE_AGENT_NAME || "";
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
      if (!existsSync(join(REPO, "node_modules"))) return;
      if (exec("cp", ["-al", join(REPO, "node_modules"), target]).status !== 0) {
        rmSync(target, { recursive: true, force: true }); // pas de partiel
        throw new Error(`cp -al node_modules failed — worktree base (${wt}) doit être sur le même FS que ${REPO}`);
      }
      try {
        symlinkSync(join(REPO, "node_modules"), target);
      } catch {
        // best-effort
      }
    },
  };
}
