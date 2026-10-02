#!/usr/bin/env node
// PreToolUse(Bash) — any caller. Vets every package an `npm install <pkg>` or `npx <pkg>`
// would fetch, then adds `--ignore-scripts --min-release-age=<days>` so npm itself refuses
// a too-recent version anywhere in the tree, transitive ones included. The thresholds are
// `dependencies.*` in harness.config.json; an invalid block falls back to the defaults, so
// a typo can never loosen the gate.
//
// Fails CLOSED when the registry cannot be reached: the install needs it anyway, and
// failing open would hand back exactly the unvetted install this replaces.
//
// A project's `permissions.deny` on `Bash(npm install *)` wins over this hook, so the gate
// only takes effect once that deny is removed.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dependencyPolicy, loadConfig } from "./lib/config.mjs";
import { createHookContext } from "./lib/context.mjs";
import { updatedToolInput } from "./lib/io.mjs";
import { findInstalls, parseSpec } from "./lib/install-commands.mjs";
import { fetchFacts, refusal } from "./lib/npm-registry.mjs";

const NEXT_STEP =
  "Do not stop on this: build the feature without the package (plain code, or a package " +
  "the project already has), or use a well-established alternative. Only if neither is " +
  "possible, tell the user that a developer has to approve this package " +
  "(`dependencies.allow` in harness.config.json).";

const describePolicy = (policy) =>
  `Packages an agent adds are vetted automatically: on the npm registry, first published ` +
  `${policy.minReleaseAgeDays}+ days ago, ${policy.minWeeklyDownloads}+ weekly downloads, ` +
  `not deprecated, no install script, no ${policy.blockingSeverities.join(" or ")} ` +
  `security advisory.`;

const declaredDependencies = (dir) => {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return new Set(
      Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.optionalDependencies,
        ...pkg.peerDependencies,
      }),
    );
  } catch {
    return new Set();
  }
};

const isApproved = (name, allow) =>
  allow.some(
    (entry) =>
      entry === name ||
      (entry.endsWith("/*") && name.startsWith(entry.slice(0, -1))),
  );

const skipReason = (parsed, declared, allow) => {
  if (!parsed) return "";
  if (declared.has(parsed.name)) return "declared";
  return isApproved(parsed.name, allow) ? "approved" : "";
};

const isLocalBin = (dir, name) =>
  existsSync(join(dir, "node_modules", ".bin", name));

const quoted = (items) => items.map((s) => `\`${s}\``).join(", ");

/**
 * @param {{ cwd?: string, tool_input?: { command?: string } }} input
 * @param {{minReleaseAgeDays: number, minWeeklyDownloads: number, blockingSeverities: string[], allow: string[]}} policy
 * @returns {Promise<null | { block: string, log: string } | { rewrite: string, log: string }>}
 */
async function decide(input, policy) {
  const command = String(input.tool_input?.command || "");
  const found = findInstalls(command);
  if (!found.length) return null;

  const other = found.find((f) => f.kind === "other");
  if (other)
    return {
      block:
        `Dependency gate: \`${other.manager}\` installs are not vetted, only npm's are ` +
        `(\`npm install <pkg>\`, \`npx <pkg>\`). In an npm project use those. ${NEXT_STEP}`,
      log: `other-manager=${other.manager}`,
    };

  const owned = found.flatMap((f) => f.gateFlags);
  if (owned.length)
    return {
      block:
        `Dependency gate: ${quoted(owned)} would bypass the vetting, which sets the registry, ` +
        `the release-age cutoff and --ignore-scripts itself. Drop the flag. A version younger ` +
        `than ${policy.minReleaseAgeDays} days or an install script needs a developer's approval.`,
      log: `gate-owned-flags=${owned.join(",")}`,
    };

  const installs = found
    .map((f) => ({
      ...f,
      dir: resolve(input.cwd || process.cwd(), f.cwd || "."),
    }))
    .filter((f) => !(f.binOnly && isLocalBin(f.dir, f.specs[0])));
  if (!installs.length) return null;

  const specs = installs.flatMap((f) => {
    const declared = declaredDependencies(f.dir);
    return f.specs.map((spec) => {
      const parsed = parseSpec(spec);
      return { spec, parsed, skip: skipReason(parsed, declared, policy.allow) };
    });
  });
  const unparsable = specs.find((s) => !s.parsed);
  if (unparsable)
    return {
      block:
        `Dependency gate: \`${unparsable.spec}\` is not a plain registry package (a git URL, ` +
        `tarball, path, alias or variable), so it cannot be vetted. ${NEXT_STEP}`,
      log: `unparsable=${unparsable.spec}`,
    };

  const toVet = specs.filter((s) => !s.skip);
  let refused;
  try {
    const verdicts = await Promise.all(
      toVet.map(async (s) => ({
        spec: s.spec,
        reason: refusal(
          await fetchFacts(s.parsed.name, s.parsed.version),
          policy,
        ),
      })),
    );
    refused = verdicts.filter((v) => v.reason);
  } catch (e) {
    return {
      block:
        `Dependency gate: could not reach the npm registry to vet ${quoted(toVet.map((s) => s.spec))} ` +
        `(${e.message}), even after a retry. The install is refused rather than run unvetted. ` +
        NEXT_STEP,
      log: `registry-error ${e.message}`,
    };
  }
  if (refused.length)
    return {
      block:
        `Dependency gate refused ${refused.map((r) => `\`${r.spec}\` (${r.reason})`).join(", ")}. ` +
        `${describePolicy(policy)} ${NEXT_STEP}`,
      log: `refused=${refused.map((r) => `${r.spec}:${r.reason}`).join(";")}`,
    };

  const pinned = ` --ignore-scripts --min-release-age=${policy.minReleaseAgeDays}`;
  const rewrite = installs
    .map((f) => f.insertAt)
    .sort((a, b) => b - a)
    .reduce((cmd, at) => cmd.slice(0, at) + pinned + cmd.slice(at), command);
  const names = (skip) =>
    specs
      .filter((s) => s.skip === skip)
      .map((s) => s.spec)
      .join(",");
  return {
    rewrite,
    log: `vetted=[${names("")}] declared=[${names("declared")}] approved=[${names("approved")}]`,
  };
}

const loadPolicy = (ctx) => {
  try {
    return dependencyPolicy(loadConfig());
  } catch (e) {
    ctx.log(`config unreadable, using the default policy: ${e.message}`);
    return dependencyPolicy({});
  }
};

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (!findInstalls(input.tool_input?.command).length) process.exit(0);
const ctx = createHookContext(input, "dependency-gate");
const decision = await decide(input, loadPolicy(ctx));
if (decision?.block) ctx.block({ reason: decision.block, log: decision.log });
if (decision?.rewrite) {
  ctx.log(`REWRITE ${decision.log}`);
  updatedToolInput({ ...input.tool_input, command: decision.rewrite });
}
process.exit(0);
