// harness.config.json loader: the single project-facts manifest consumed by
// hooks/scripts at runtime (and by the renderer at sync time in a later phase).
// Stdlib only. Fail-closed on a malformed config (throws a clear Error); a
// MISSING file degrades to the built-in defaults so a config-less repo still
// runs a minimal harness.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./paths.mjs";

export const CONFIG_FILENAME = "harness.config.json";

// Minimal safe baseline. The committed harness.config.json overrides these.
// Optional capabilities (deploy, app) are ABSENT here on purpose: a capability
// exists iff its block is present in the config.
const DEFAULTS = {
  name: "harness",
  layout: { src: "src", e2e: "e2e", adr: "adr" },
  validation: { steps: [], extraForbidden: [] },
  worktree: { provision: "npm-link" },
  skills: { developerMenu: [] },
  roles: {},
  launcher: {
    sessionDirEnv: "CHAT_SESSION_DIR",
    turnSentinelDir: null,
    postCheckoutScript: null,
    logsDir: null,
  },
};

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Deep-merge `override` onto `base`. Objects merge recursively; arrays and
// scalars from `override` REPLACE (never concatenate): a config that lists
// validation.steps fully replaces the default empty list.
function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

class ConfigError extends Error {}

// Throw a clear, prefixed error so a fail-closed consumer surfaces exactly what
// is wrong with the config.
function fail(msg) {
  throw new ConfigError(`${CONFIG_FILENAME}: ${msg}`);
}

function validate(cfg) {
  if (!isObject(cfg)) fail("top level must be a JSON object");

  if (!isObject(cfg.validation) || !Array.isArray(cfg.validation.steps)) {
    fail("`validation.steps` must be an array");
  }
  for (const [i, step] of cfg.validation.steps.entries()) {
    if (!isObject(step)) fail(`validation.steps[${i}] must be an object`);
    if (typeof step.id !== "string" || !step.id) {
      fail(`validation.steps[${i}] needs a non-empty string \`id\``);
    }
    if (typeof step.kind !== "string" || !step.kind) {
      fail(`validation.steps[${step.id}] needs a non-empty string \`kind\``);
    }
    const isVitest = step.runner === "vitest";
    if (!isVitest && (typeof step.command !== "string" || !step.command)) {
      fail(`validation.steps[${step.id}] needs a \`command\` (or runner:"vitest")`);
    }
    if (isVitest && (typeof step.config !== "string" || !Array.isArray(step.projects))) {
      fail(`validation.steps[${step.id}] (vitest) needs \`config\` and \`projects[]\``);
    }
  }

  if (!isObject(cfg.roles)) fail("`roles` must be an object");
  for (const [name, role] of Object.entries(cfg.roles)) {
    if (!isObject(role) || typeof role.model !== "string" || !role.model) {
      fail(`roles.${name} needs a non-empty string \`model\``);
    }
  }

  if ("deploy" in cfg && cfg.deploy !== undefined) {
    if (!isObject(cfg.deploy) || !Array.isArray(cfg.deploy.relevantGlobs)) {
      fail("`deploy.relevantGlobs` must be an array when `deploy` is present");
    }
  }
  return cfg;
}

const cache = new Map();

/**
 * Load and validate the harness config, merged over the defaults.
 * @param {string} [repo] repo root holding harness.config.json (defaults to REPO)
 * @returns {object} the validated, merged config
 * @throws {Error} on malformed JSON or an invalid shape (fail-closed)
 */
export function loadConfig(repo = REPO) {
  if (cache.has(repo)) return cache.get(repo);
  const path = join(repo, CONFIG_FILENAME);
  let merged;
  if (!existsSync(path)) {
    merged = validate(structuredClone(DEFAULTS));
  } else {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      fail(`invalid JSON (${e.message})`);
    }
    merged = validate(deepMerge(DEFAULTS, parsed));
  }
  cache.set(repo, merged);
  return merged;
}

// Test-only: drop the memoized config so a test can reload after writing a new
// file to the same repo path.
export function clearConfigCache() {
  cache.clear();
}

// ---- Typed readers used by the config consumers ----------------

export const validationSteps = (cfg) => cfg.validation?.steps ?? [];
export const extraForbidden = (cfg) => cfg.validation?.extraForbidden ?? [];
export const isDeployEnabled = (cfg) => isObject(cfg.deploy);
export const deployGlobs = (cfg) => cfg.deploy?.relevantGlobs ?? [];
export const isAppSmokeEnabled = (cfg) => isObject(cfg.app);
export const worktreeProvision = (cfg) => cfg.worktree?.provision ?? "npm-link";
export const roleNames = (cfg) => Object.keys(cfg.roles ?? {});
export const roleModel = (cfg, role) => cfg.roles?.[role]?.model ?? "";
export const pipelineRoles = (cfg) =>
  roleNames(cfg).filter((r) => cfg.roles[r]?.pipeline);
export const debounceRoles = (cfg) =>
  roleNames(cfg).filter((r) => cfg.roles[r]?.debounce);
// Managed-launcher extension points (empty object when no launcher overlay).
export const launcher = (cfg) => cfg.launcher ?? {};
// The format-kind validation step (null when none), used by format-on-write.
export const formatStep = (cfg) =>
  validationSteps(cfg).find((s) => s.kind === "format") ?? null;
// Steps a pre-PR / pre-push gate runs on the human path (fast checks only).
// `changedScoped` steps are EXCLUDED: they need a per-worktree diff base (the
// session branch) that the human push path lacks, and running their bare command
// whole-repo would lint/test far more than the change at hand.
export const prePrSteps = (cfg) =>
  validationSteps(cfg).filter(
    (s) => (s.kind === "typecheck" || s.kind === "lint") && !s.changedScoped,
  );
