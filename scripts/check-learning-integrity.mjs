/**
 * Validates .claude/learning.md structural integrity:
 * - No duplicate IDs in the index table
 * - Every index ID has a matching ### heading in the body
 * - Every ### heading ID in the body is listed in the index
 *
 * Runs as part of the pre-commit hook when learning.md is staged.
 */

import { readFileSync } from "node:fs";

const LEARNING_PATH = ".claude/rules/learning.md";

const content = readFileSync(LEARNING_PATH, "utf8");
const lines = content.split("\n");

const ID_RE = /^[A-Z]+-\d+$/;

// Extract IDs from the index table (lines matching | ... | XX-N | ... |)
const indexIds = [];
for (const line of lines) {
  const match = line.match(/\|\s*([A-Z]+-\d+)\s*\|/);
  if (match && ID_RE.test(match[1])) {
    indexIds.push(match[1]);
  }
}

// Extract IDs from body headings (### XX-N: ...)
const bodyIds = [];
for (const line of lines) {
  const match = line.match(/^### ([A-Z]+-\d+):/);
  if (match) {
    bodyIds.push(match[1]);
  }
}

const failures = [];

// Check for duplicate IDs in index
const indexSet = new Set();
for (const id of indexIds) {
  if (indexSet.has(id)) {
    failures.push(`Duplicate ID in index: ${id}`);
  }
  indexSet.add(id);
}

// Check for duplicate IDs in body
const bodySet = new Set();
for (const id of bodyIds) {
  if (bodySet.has(id)) {
    failures.push(`Duplicate ID in body: ${id}`);
  }
  bodySet.add(id);
}

// Index IDs missing from body
for (const id of indexSet) {
  if (!bodySet.has(id)) {
    failures.push(`ID in index but missing from body: ${id}`);
  }
}

// Body IDs missing from index
for (const id of bodySet) {
  if (!indexSet.has(id)) {
    failures.push(`ID in body but missing from index: ${id}`);
  }
}

if (failures.length === 0) {
  process.exit(0);
}

console.error("\nlearning.md integrity check failed.\n");
for (const f of failures) {
  console.error(`  - ${f}`);
}
console.error(
  `\nIndex has ${indexSet.size} IDs, body has ${bodySet.size} IDs.\n`,
);
process.exit(1);
