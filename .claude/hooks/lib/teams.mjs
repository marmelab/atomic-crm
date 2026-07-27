// Agent identity helpers — the single source for every hook that gates on who
// an agent is.

import { loadConfig, pipelineRoles, debounceRoles, roleNames } from "./config.mjs";

export const getFirstTaskId = (text) => (String(text ?? "").match(/TASK-[0-9]+/) || [])[0] || "";

// Role SETS come from harness.config.json (config.roles: `pipeline` / `debounce`
// flags), so force-foreground and block-duplicate-dispatch no longer hardcode
// their own copies. Fail-open to the built-in defaults when the config is
// missing or lists no roles (e.g. a config-less test repo), so a guard never
// silently empties out.
const DEFAULT_PIPELINE = [
  "developer",
  "quality-reviewer",
  "merger",
  "planner",
  "simple-developer",
  "test-writer",
];
const DEFAULT_DEBOUNCE = ["developer", "quality-reviewer", "merger"];

const setFromConfig = (reader, fallback) => {
  try {
    const roles = reader(loadConfig());
    return new Set(roles.length ? roles : fallback);
  } catch {
    return new Set(fallback);
  }
};

/** Roles the orchestrator must dispatch foreground and whose result it consumes inline. */
export const pipelineRoleSet = () => setFromConfig(pipelineRoles, DEFAULT_PIPELINE);
/** Roles whose identical re-dispatch is debounced (async-ack double dispatch). */
export const debounceRoleSet = () => setFromConfig(debounceRoles, DEFAULT_DEBOUNCE);
/** Every declared role name (config.roles keys); [] on a config error. */
export const configRoleNames = () => {
  try {
    return roleNames(loadConfig());
  } catch {
    return [];
  }
};

// Agent-name role predicates. Match the bare role, a suffixed name
// (merger-TASK-003), or an @-qualified address.
export const isQualityReviewer = (name) => /^quality-reviewer([-@]|$)/.test(name || "");
export const isMerger = (name) => /^merger([-@]|$)/.test(name || "");
export const isDeveloper = (name) => /^developer([-@]|$)/.test(name || "");
// The orchestrator, including the chat- web variant and any runtime suffix
// (orchestrator-…). Single source for every gate that keys on "is this the
// orchestrator" (bash-guard guard-state rule, block-nested-orchestrator).
export const isOrchestrator = (name) => /^(chat-)?orchestrator([-@]|$)/.test(name || "");
