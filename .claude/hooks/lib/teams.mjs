import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TEAMS_DIR } from "./paths.mjs";

export const isValidTeamName = (name) => /^[A-Za-z0-9_-]+$/.test(name || "");

export const getFirstTaskId = (text) => (String(text ?? "").match(/TASK-[0-9]+/) || [])[0] || "";

// Agent-name role predicates — the single source for every hook that gates on
// who an agent is. Match the bare role, a suffixed name (merger-TASK-003), or
// an @-qualified address.
export const isDeveloper = (name) => /^developer([-@]|$)/.test(name || "");
export const isQualityReviewer = (name) => /^quality-reviewer([-@]|$)/.test(name || "");
export const isTestValidator = (name) => /^test-validator([-@]|$)/.test(name || "");
export const isMerger = (name) => /^merger([-@]|$)/.test(name || "");

// Internal: enumerated only by getTeamConfigsForSession below.
function getTeamConfigs() {
  try {
    return readdirSync(TEAMS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(TEAMS_DIR, e.name, "config.json"))
      .filter((p) => existsSync(p));
  } catch {
    return [];
  }
}

// Team configs whose leadSessionId matches the given session — the ownership
// lookup used by block-premature-shutdowns.
export const getTeamConfigsForSession = (sessionId) =>
  getTeamConfigs().filter(
    (cfg) => (JSON.parse(readFileSync(cfg, "utf8"))?.leadSessionId || "") === (sessionId || ""),
  );
