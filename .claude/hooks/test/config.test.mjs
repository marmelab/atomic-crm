// Tests for lib/config.mjs: the harness.config.json loader. It merges the file
// over the built-in defaults, validates the shape (fail-closed on malformed),
// and degrades to defaults when the file is missing.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, test, expect } from "vitest";
import {
  loadConfig,
  clearConfigCache,
  CONFIG_FILENAME,
  isDeployEnabled,
  deployGlobs,
  pipelineRoles,
  debounceRoles,
  roleModel,
  worktreeProvision,
  prePrSteps,
} from "../lib/config.mjs";

const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const tmpRepos = [];
const makeRepo = (config) => {
  const dir = mkdtempSync(join(tmpdir(), "harness-config-"));
  tmpRepos.push(dir);
  if (config !== undefined) {
    writeFileSync(
      join(dir, CONFIG_FILENAME),
      typeof config === "string" ? config : JSON.stringify(config),
    );
  }
  clearConfigCache();
  return dir;
};

const VALID = {
  name: "sample",
  validation: {
    steps: [
      { id: "typecheck", kind: "typecheck", command: "npm run typecheck" },
      {
        id: "unit",
        kind: "unit",
        runner: "vitest",
        config: "vitest.config.ts",
        projects: ["app"],
      },
    ],
  },
  roles: {
    developer: { model: "sonnet", pipeline: true, debounce: true },
    planner: { model: "opus", pipeline: true, debounce: false },
  },
  deploy: { adapter: "supabase", relevantGlobs: ["supabase/**"] },
};

afterEach(() => {
  while (tmpRepos.length)
    rmSync(tmpRepos.pop(), { recursive: true, force: true });
  clearConfigCache();
});

describe("config loader", () => {
  test("loads a valid config and applies defaults for absent keys", () => {
    const cfg = loadConfig(makeRepo(VALID));
    expect(cfg.name).toBe("sample");
    // default filled in when absent
    expect(worktreeProvision(cfg)).toBe("npm-link");
    expect(cfg.launcher.sessionDirEnv).toBe("CHAT_SESSION_DIR");
  });

  test("missing file degrades to defaults (no deploy capability)", () => {
    const cfg = loadConfig(makeRepo(undefined));
    expect(isDeployEnabled(cfg)).toBe(false);
    expect(cfg.validation.steps).toEqual([]);
  });

  test("typed readers reflect the config", () => {
    const cfg = loadConfig(makeRepo(VALID));
    expect(isDeployEnabled(cfg)).toBe(true);
    expect(deployGlobs(cfg)).toEqual(["supabase/**"]);
    expect(pipelineRoles(cfg).sort()).toEqual(["developer", "planner"]);
    expect(debounceRoles(cfg)).toEqual(["developer"]);
    expect(roleModel(cfg, "planner")).toBe("opus");
  });

  test("malformed JSON throws a clear, prefixed error", () => {
    expect(() => loadConfig(makeRepo("{ not json"))).toThrow(
      new RegExp(`${CONFIG_FILENAME}: invalid JSON`),
    );
  });

  test("validation.steps not an array is rejected", () => {
    expect(() =>
      loadConfig(makeRepo({ validation: { steps: {} }, roles: {} })),
    ).toThrow(/validation\.steps` must be an array/);
  });

  test("a role missing a model is rejected", () => {
    expect(() =>
      loadConfig(
        makeRepo({ validation: { steps: [] }, roles: { developer: {} } }),
      ),
    ).toThrow(/roles\.developer needs/);
  });

  test("deploy present but without relevantGlobs is rejected", () => {
    expect(() =>
      loadConfig(
        makeRepo({ validation: { steps: [] }, roles: {}, deploy: {} }),
      ),
    ).toThrow(/deploy\.relevantGlobs/);
  });

  test("prePrSteps takes typecheck/lint but excludes changedScoped steps", () => {
    const cfg = loadConfig(
      makeRepo({
        validation: {
          steps: [
            {
              id: "typecheck",
              kind: "typecheck",
              command: "npm run typecheck",
            },
            {
              id: "lint",
              kind: "lint",
              command: "npx eslint",
              changedScoped: true,
            },
          ],
        },
        roles: {},
      }),
    );
    // typecheck (whole-repo-safe) is on the human push path; the diff-scoped lint
    // step is not — it needs a per-worktree base the human path lacks.
    expect(prePrSteps(cfg).map((s) => s.id)).toEqual(["typecheck"]);
  });

  test("the committed harness.config.json is valid", () => {
    clearConfigCache();
    const cfg = loadConfig(REPO_ROOT);
    expect(cfg.name).toBe("atomic-crm");
    expect(isDeployEnabled(cfg)).toBe(true);
    expect(roleModel(cfg, "quality-reviewer")).toBe("opus");
    expect(pipelineRoles(cfg)).toContain("test-writer");
  });
});
