#!/usr/bin/env node
// PostToolUse(Write|Edit): flag TypeScript typing escape hatches in .ts/.tsx files.
//
// Deliberately non-blocking (exit 1, not exit 2): it flags a workaround rather
// than blocking a write, so a legitimate, justified suppression is never broken.
// A justified `@ts-expect-error <reason>` on the same line is NOT flagged.

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // unparseable payload: nothing to flag, fail open
}

const filePath = input.tool_input?.file_path || "";
if (!/\.(ts|tsx)$/.test(filePath)) process.exit(0);

let content;
try {
  content = readFileSync(filePath, "utf8");
} catch {
  process.exit(0); // file gone / unreadable: nothing to flag
}

const hits = [];

// Blanket escape hatches: any occurrence is a hit.
if (/\$TSFixMe\b/.test(content)) hits.push("$TSFixMe");
if (/:\s*any\b/.test(content)) hits.push(": any");
if (/\bas\s+any\b/.test(content)) hits.push("as any");

// Suppression directives are only a hit when unjustified (no explanation text
// following the directive on the same line). `@ts-expect-error legacy API` is
// fine; a bare `@ts-ignore` is not.
const SUPPRESS = /@ts-(ignore|expect-error)\b[ \t]*(.*)$/gm;
for (const m of content.matchAll(SUPPRESS)) {
  const rest = (m[2] || "").replace(/^[\s:.-]+/, "").trim();
  if (rest.length < 3) {
    hits.push(`@ts-${m[1]} without justification`);
    break;
  }
}

if (hits.length === 0) process.exit(0);

const ctx = createHookContext(input, "check-typescript-shortcuts");
ctx.log(`FLAG ${filePath} ${hits.join(", ")}`);
ctx.error(
  `${filePath} contains a typing workaround (${[...new Set(hits)].join(", ")}).\n` +
    `Replace it with the correct type instead of bypassing the typecheck.`,
);
process.exit(1);
