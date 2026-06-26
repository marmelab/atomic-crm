#!/usr/bin/env node
// PreToolUse(Bash) — single guard for Bash commands. Blocks commands that open browser windows (headed Playwright, Vite --open) for every caller, blocks the orchestrator from mutating the review/dispatch guard state under <sessionDir>/{reviews,breaker}, and blocks gated subagents from running validation commands (validate-on-stop.mjs runs them automatically on SubagentStop).

import { readFileSync } from "node:fs";
import { createHookContext } from "./lib/context.mjs";
import {
  isDeveloper,
  isOrchestrator,
  isQualityReviewer,
} from "./lib/teams.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ctx = createHookContext(input, "bash-guard");

const agent = input.agent_type || "";
const cmd = input.tool_input?.command || "";

if (!cmd) process.exit(0);

// Browser rules — any caller: this sandbox has no display, a headed run hangs forever.
const opensHeadedPlaywright = (c) =>
  /playwright/.test(c) &&
  /(screenshot|test|codegen)/.test(c) &&
  !c.includes("--headless");
const opensViteBrowser = (c) =>
  /(vite|npm run (dev|start|start-demo))/.test(c) && c.includes("--open");

const BROWSER_RULES = [
  [
    opensHeadedPlaywright,
    "Playwright must always use --headless. Add --headless to the command.",
  ],
  [
    opensViteBrowser,
    "Vite must not use --open (opens a browser window). Remove the --open flag.",
  ],
];

const browserViolation = BROWSER_RULES.find(([matches]) => matches(cmd));
if (browserViolation) {
  ctx.block({
    reason: browserViolation[1],
    log: `browser cmd=${cmd.slice(0, 120)}`,
  });
}

// Guard-state rule — orchestrator only: the orchestrator must NEVER mutate the
// hook state under <sessionDir>/reviews (review-verdict flags) or
// <sessionDir>/breaker (planner/duplicate-dispatch markers). Those files ARE the
// safety guards (block-merger-without-review, block-duplicate-dispatch) — an
// orchestrator that touches/rm's them forges an approval or clears a debounce and
// bypasses review entirely.
// Match the orchestrator the same way block-nested-orchestrator does: agent_type
// when present, else the CLAUDE_AGENT_NAME-derived ctx.agentType, allowing a
// suffixed runtime name (orchestrator-…) and the chat- prefix. (isOrchestrator
// lives in lib/teams.mjs so both gates share one predicate.)
if (isOrchestrator(agent || ctx.agentType)) {
  // Match `reviews`/`breaker` as a path segment bounded on the left by `/` and
  // on the right by `/`, a quote, whitespace, or end-of-token. The trailing-slash
  // form alone missed the command the codebase actually teaches the reviewer to
  // use — `RD="$(dirname "$TICKET_FILE")/reviews" && touch "$RD/<flag>"` — whose
  // literal text is `…/reviews"` then `$RD/…`, never `/reviews/`. That let a
  // confused orchestrator forge a verdict flag through the documented form.
  const guardPath = /\/(reviews|breaker)(\/|["'\s]|$)/;
  const mutatingVerb =
    /(^|[;&|]|\bsudo\b|\bxargs\b)\s*(rm|touch|mkdir|mv|cp|truncate|ln)\b/.test(
      cmd,
    ) ||
    /\bsed\s+(-[a-zA-Z]*i\b|--in-place)/.test(cmd) ||
    /\|\s*tee\b/.test(cmd);
  const redirectToGuard = />>?\s*\S*\/(reviews|breaker)(\/|["'\s]|$)/.test(cmd);
  if ((mutatingVerb && guardPath.test(cmd)) || redirectToGuard) {
    ctx.block({
      reason:
        "Refusing this command: the orchestrator must not write to or delete files under <session_dir>/reviews or <session_dir>/breaker — those ARE the review/dispatch guards. " +
        "If a merger dispatch was blocked for 'no APPROVED verdict', do NOT fabricate the flag and do NOT re-dispatch the reviewer: the reviewer writes its own flag on APPROVED (quality-reviewer.md). A missing flag means the reviewer did NOT approve — read its output file and act on the real verdict. " +
        "If a dispatch was blocked as 'still in flight', wait for its task-notification instead of clearing the marker.",
      log: `BLOCK orchestrator guard-state mutation cmd=${cmd.slice(0, 120)}`,
    });
  }
}

// Validation rules — gated subagents only: the validation hooks already run
// these; manual runs burn budget and can hang (vitest headed without CI=true).
// Resolve identity the same robust way as the guard-state rule above: prefer the
// payload agent_type, fall back to the CLAUDE_AGENT_NAME-derived ctx.agentType,
// and match via the suffix-aware predicates — so a `developer-TASK-001` runtime
// name (or an empty agent_type) is still gated, not silently waved through.
const who = agent || ctx.agentType || "";
if (!isDeveloper(who) && !isQualityReviewer(who)) process.exit(0);

const runsTypecheck = (c) =>
  /(make\s+typecheck|npm\s+run\s+typecheck|npx\s+tsc(\s|$)|tsc\s+--noEmit)/.test(
    c,
  );
const runsPrettier = (c) =>
  /(npm\s+run\s+prettier(:apply)?|npx\s+prettier(\s|$)|make\s+prettier)/.test(
    c,
  );
const runsUnitTests = (c) =>
  /(npm\s+run\s+test(:unit)?(:[a-z]+)?|npm\s+test\b|npx\s+vitest|make\s+test(-unit)?(-[a-z]+)?)/.test(
    c,
  );
const runsE2eTests = (c) => /(npx\s+playwright\s+test|make\s+test-e2e)/.test(c);
const runsLint = (c) => /(make\s+lint\b|npm\s+run\s+lint\b)/.test(c);
const runsBuild = (c) =>
  /(npx\s+vite\s+build|npm\s+run\s+build\b|make\s+build\b)/.test(c);

const VALIDATION_RULES = [
  [
    runsTypecheck,
    "typecheck — validate-on-stop.mjs runs this automatically after you stop; read its stderr output instead.",
  ],
  [
    runsPrettier,
    "prettier — the validation hooks auto-apply prettier and commit the result; don't run it manually.",
  ],
  [
    runsUnitTests,
    "unit tests — the validation hooks run vitest automatically. In this sandbox vitest browser mode HANGS without CI=true (chromium headed waits for display). Trust the hooks.",
  ],
  [
    runsE2eTests,
    "e2e tests — the validation hooks run playwright in full mode only; in demo mode they're skipped. Don't run them manually.",
  ],
  [
    runsLint,
    "lint — prettier is auto-applied by the validation hooks; eslint runs via the project's editor config. Skip it.",
  ],
  [
    runsBuild,
    "build — don't run production builds during tickets; typecheck (run by the validation hooks) catches type errors.",
  ],
];

const violation = VALIDATION_RULES.find(([matches]) => matches(cmd));
if (violation) {
  ctx.block({
    reason: `Validation command forbidden: ${violation[1]} See .claude/rules/validation-commands.md.`,
    log: `cmd=${cmd.slice(0, 120)}`,
  });
}

// File-write rules — gated subagents only: code-writing agents must use the
// Write/Edit tools, never Bash redirection/in-place edits. Bash writes bypass the
// Write|Edit-only block-migration-writes guard (a developer could otherwise write a migration in
// bash).
const REDIRECT_TARGET_RE =
  /(^|[^0-9&])>>?\s*(\/dev\/null\b|\/chat-service\/logs\/\S*|\/|\.\.?\/|~\/|[a-zA-Z0-9._-]+\/|[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+)/g;
const writesRedirect = (c) => {
  // Evaluate the /dev/null and logs exemptions PER redirect, so an unrelated
  // `cmd 2>/dev/null` can't disarm detection of a real `> file` write in the
  // same command.
  for (const m of c.matchAll(REDIRECT_TARGET_RE)) {
    const target = m[2];
    if (target === "/dev/null" || target.startsWith("/chat-service/logs/"))
      continue;
    return true;
  }
  return false;
};
const writesSedInPlace = (c) => /sed\s+(-[a-zA-Z]*i\b|--in-place)/.test(c);
const writesAwkInPlace = (c) => /awk\s+-i\s+inplace/.test(c);
const writesTee = (c) => {
  // tee writes to its file argument(s); skip leading flags (e.g. -a) to reach
  // the target, and exempt the /dev/null sink. Bare `| tee` (no file) only
  // duplicates to stdout — not a write.
  const m = c.match(/\|\s*tee\s+((?:-\S+\s+)*)(\S+)/);
  return !!m && m[2] !== "/dev/null";
};
const writesScript = (c) =>
  /(node|python3?)\s+-[ecp].*(writeFileSync|writeFile|write_text|os\.write|fs\.write)/.test(
    c,
  );

const FILE_WRITE_RULES = [
  [writesRedirect, "bash redirection to a file (> or >>)"],
  [writesSedInPlace, "sed -i (in-place edit)"],
  [writesAwkInPlace, "awk -i inplace"],
  [writesTee, "pipe to tee (file write)"],
  [writesScript, "scripted file write via node/python"],
];

const writeViolation = FILE_WRITE_RULES.find(([matches]) => matches(cmd));
if (writeViolation) {
  ctx.block({
    reason: `File editing via Bash is forbidden: ${writeViolation[1]}. Use the Write or Edit tool instead — Bash writes bypass prettier/typecheck and the migration-write guard. See developer.md.`,
    log: `file-write cmd=${cmd.slice(0, 120)}`,
  });
}

process.exit(0);
