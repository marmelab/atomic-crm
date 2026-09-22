// settings.json invokes every hook as a bare path, so the shell needs the exec bit
// and a shebang. A 644 hook fails with exit 126 and the guard silently never runs.

import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

const hookCommands = () => {
  const settings = JSON.parse(
    readFileSync(join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
  );
  return Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((entry) => entry.hooks ?? [])
    .map((hook) => hook.command)
    .filter(Boolean);
};

const resolve = (command) =>
  command.replace("$CLAUDE_PROJECT_DIR", REPO_ROOT).trim();

describe("settings.json hooks are runnable", () => {
  const commands = [...new Set(hookCommands())];

  test("at least one hook command is declared", () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  test.each(commands)("%s is executable and has a shebang", (command) => {
    const path = resolve(command);
    expect(statSync(path).mode & 0o111).not.toBe(0);
    expect(readFileSync(path, "utf8").startsWith("#!")).toBe(true);
  });
});
