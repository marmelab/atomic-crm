// Tests for block-docker-containers.mjs — blocks container launches (run/create/
// start, compose up) for any caller including the main session, except when the
// command references Supabase. Blocks are decision JSON on stdout with exit 0;
// allowed commands produce no decision.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "block-docker-containers.mjs");

const tmpRoot = mkdtempSync(join(tmpdir(), "block-docker-tmp-"));

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const runHook = (agent, command) => {
  const env = { ...process.env, CRM_TMP_ROOT: tmpRoot };
  delete env.CLAUDE_AGENT_NAME;
  const input = JSON.stringify({
    tool_name: "Bash",
    agent_type: agent,
    session_id: "test-1234",
    tool_input: { command },
  });
  return spawnSync("node", [HOOK], { input, env, encoding: "utf8" });
};

const isBlocked = (r) => r.stdout.includes('"decision":"block"');

describe("block-docker-containers hook", () => {
  describe("container launches → blocked (any caller, incl. main session)", () => {
    const blocked = [
      ["", "docker run -it ubuntu bash"],
      ["", "docker run -v /home:/host alpine"],
      ["", "docker create nginx"],
      ["", "docker start my-stopped-container"],
      ["", "docker container run redis"],
      ["", "docker compose up -d"],
      ["", "docker-compose up"],
      ["developer", "docker run hello-world"],
      ["", "echo hi && docker run busybox"],
    ];

    test.each(blocked)("%s running '%s' → blocked", (agent, command) => {
      const r = runHook(agent, command);
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(true);
    });
  });

  describe("Supabase containers → allowed", () => {
    const allowed = [
      ["", "docker run supabase/postgres:15"],
      ["", "docker start supabase_db_atomic-crm"],
      ["", "docker compose -f supabase/docker-compose.yml up -d"],
      ["", "npx supabase start"],
      ["", "make start"],
    ];

    test.each(allowed)("%s running '%s' → allowed", (agent, command) => {
      const r = runHook(agent, command);
      expect(r.status).toBe(0);
      expect(isBlocked(r)).toBe(false);
    });
  });

  describe("non-launch docker verbs → allowed", () => {
    const allowed = [
      "docker ps",
      "docker logs my-container",
      "docker stop my-container",
      "docker rm my-container",
      "docker exec my-container ls",
      "docker images",
      "docker version",
    ];

    test.each(allowed)("'%s' → allowed", (command) => {
      const r = runHook("", command);
      expect(isBlocked(r)).toBe(false);
    });
  });

  test("empty command → allowed", () => {
    const r = runHook("", "");
    expect(r.status).toBe(0);
    expect(isBlocked(r)).toBe(false);
  });
});
