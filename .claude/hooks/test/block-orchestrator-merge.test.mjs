// Tests for block-orchestrator-merge.mjs. Only the dispatched `merger` may run
// merge-class git commands; if any other agent merges itself the pipeline looks
// healthy while the dev -> merger path is dead. The guard is OPT-IN, since in a plain
// checkout the main session is a general assistant that legitimately merges.
// Blocks are exit 2 + stderr (ctx.fail), not decision JSON.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-orchestrator-merge.mjs");
const TMP = mkdtempSync(join(tmpdir(), "block-orch-merge-"));

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const run = (agentName, command, { enabled = true, repo = TMP } = {}) => {
  const env = { ...process.env, APP_DIR: repo };
  delete env.CLAUDE_AGENT_NAME;
  delete env.ATOMIC_CRM_ENFORCE_MERGE_GUARD;
  delete env.HARNESS_ENFORCE_MERGE_GUARD;
  if (enabled) env.HARNESS_ENFORCE_MERGE_GUARD = "1";
  if (agentName) env.CLAUDE_AGENT_NAME = agentName;
  return spawnSync("node", [HOOK], {
    input: JSON.stringify({
      tool_name: "Bash",
      session_id: "merge-1234",
      tool_input: { command },
    }),
    env,
    encoding: "utf8",
  });
};

const blocked = (r) => r.status === 2;

describe("block-orchestrator-merge", () => {
  const MERGE_CLASS = [
    "git merge session/abcd1234",
    "git checkout main",
    "git checkout master",
    "git pull",
    "git worktree remove /tmp/_repo/abcd1234/TASK-001",
  ];

  test("inert unless the guard is explicitly enabled", () => {
    for (const cmd of MERGE_CLASS) {
      const r = run("", cmd, { enabled: false });
      expect(r.status).toBe(0);
    }
  });

  test.each(MERGE_CLASS)("the main session running '%s' → blocked", (cmd) => {
    const r = run("", cmd);
    expect(blocked(r)).toBe(true);
    expect(r.stderr).toContain("merger");
  });

  test.each(MERGE_CLASS)("a developer running '%s' → blocked", (cmd) => {
    expect(blocked(run("developer-TASK-002", cmd))).toBe(true);
  });

  test.each(MERGE_CLASS)(
    "the dispatched merger running '%s' → allowed",
    (cmd) => {
      expect(run("merger", cmd).status).toBe(0);
      expect(run("merger-TASK-002", cmd).status).toBe(0);
    },
  );

  test("a merge-class command chained after another is still caught", () => {
    expect(blocked(run("", "cd /tmp && git merge session/abcd1234"))).toBe(
      true,
    );
    expect(blocked(run("", "git fetch; git pull"))).toBe(true);
  });

  test("read-only git is allowed for everyone", () => {
    for (const cmd of ["git status", "git log --oneline -3", "git diff HEAD"]) {
      expect(run("", cmd).status).toBe(0);
    }
  });

  test("git merge-base stays allowed (read-only, not a merge)", () => {
    // The (\s|$) boundary after `merge` is what distinguishes it. Dropping that
    // boundary to "simplify" the regex would block a legitimate read-only command.
    expect(run("", "git merge-base main HEAD").status).toBe(0);
  });

  test("prose containing 'git merge ' is over-matched, deliberately", () => {
    // A textual mention is refused rather than parsed. Kept broad on purpose: the
    // guard is opt-in and fails LOUD with an explanatory message, so a rephrase costs
    // one turn, whereas a regex clever enough to tell code from prose would eventually
    // let a real merge through. Pinned so nobody "fixes" it into a bypass.
    expect(blocked(run("", "echo 'time to git merge later'"))).toBe(true);
  });

  test("the launcher's post-checkout script is merger-only when configured", () => {
    const repo = mkdtempSync(join(tmpdir(), "block-orch-merge-repo-"));
    writeFileSync(
      join(repo, "harness.config.json"),
      JSON.stringify({
        launcher: { postCheckoutScript: "/entrypoint/apply-app-variant.sh" },
        roles: { merger: { model: "haiku" } },
      }),
    );
    expect(
      blocked(run("", "bash /entrypoint/apply-app-variant.sh", { repo })),
    ).toBe(true);
    expect(
      run("merger", "bash /entrypoint/apply-app-variant.sh", { repo }).status,
    ).toBe(0);
    rmSync(repo, { recursive: true, force: true });
  });

  test("with no post-checkout script configured that clause stays inert", () => {
    expect(run("", "bash /entrypoint/apply-app-variant.sh").status).toBe(0);
  });
});
