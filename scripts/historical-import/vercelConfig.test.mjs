// vercel.json is schema-validated by the platform BEFORE the build starts.
//
// An explanatory "$comment" key in it failed a production deployment in
// 0ms with no build log at all — the config was rejected at validation, so
// nothing ever ran, and crm.leifariel.com silently kept serving the
// previous build while everything looked pushed. The schema declares
// additionalProperties: false, so any key Vercel does not know is fatal.
//
// The allowed set is pinned here rather than fetched, so this stays a
// fast, offline unit test. It is Vercel's own list (openapi.vercel.sh/
// vercel.json); if the platform adds a key we want, add it here too.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CONFIG = new URL("../../vercel.json", import.meta.url);

const ALLOWED_TOP_LEVEL = new Set([
  "$schema",
  "alias",
  "build",
  "builds",
  "cleanUrls",
  "env",
  "passiveRegions",
  "functionFailoverRegions",
  "functions",
  "git",
  "github",
  "headers",
  "images",
  "name",
  "redirects",
  "bulkRedirectsPath",
  "regions",
  "rewrites",
  "routes",
  "scope",
  "trailingSlash",
  "version",
  "wildcard",
  "buildCommand",
  "ignoreCommand",
  "devCommand",
  "framework",
  "installCommand",
  "outputDirectory",
  "crons",
  "schedules",
  "relatedProjects",
  "fluid",
  "bunVersion",
  "proxy",
  "experimentalAtproto",
  "experimentalBYOC",
  "experimentalEnvironmentVariables",
  "experimentalServices",
  "experimentalServiceGroups",
  "services",
  "experimentalServicesV2",
]);

const config = JSON.parse(readFileSync(CONFIG, "utf8"));

test("vercel.json uses only keys Vercel accepts", () => {
  // Assert — a key outside this set fails the deployment before the build
  // starts, with no log to explain it.
  const unknown = Object.keys(config).filter((k) => !ALLOWED_TOP_LEVEL.has(k));
  assert.deepEqual(
    unknown,
    [],
    `vercel.json has ${unknown.length} key(s) Vercel's schema rejects: ${unknown.join(", ")}. The schema sets additionalProperties: false, so this fails the deploy in 0ms with no build log. Explanations belong in AGENTS.md, not here.`,
  );
});

test("the public application URL still redirects to its hash route", () => {
  // Arrange — the app is hash-routed, so /apply/living-example is not a
  // path it can serve. This redirect is why the obvious URL works.
  const sources = (config.redirects ?? []).map((r) => r.source);

  // Assert
  assert.ok(sources.includes("/apply/:path*"), "the /apply/* redirect is gone");
  const applyRedirect = config.redirects.find(
    (r) => r.source === "/apply/:path*",
  );
  assert.match(applyRedirect.destination, /^\/#\/apply/);
});

test("unmatched paths fall back to the app rather than a bare 404", () => {
  // Assert
  assert.deepEqual(config.rewrites, [
    { source: "/(.*)", destination: "/index.html" },
  ]);
});
