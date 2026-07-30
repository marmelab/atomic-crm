#!/usr/bin/env node
// SubagentStop - render a portable harness board from the session's cheap state
// (tickets, review flags, progress log, live worktrees) into
// <REPO>/.harness/<SESSION_SHORT_ID>/{STATUS.md,TICKETS.md,status.json}.
//
// Why: on the VS Code extension the /tmp worktrees are invisible, and on any
// surface the raw `harness-progress.log` tail drowns the chat. `.harness/` sits
// in the project dir, gitignored, so it shows in the VS Code Explorer AND the
// desktop file browser (which renders Markdown as a formatted preview). The
// developer sees who is doing what without the log tail polluting the chat.
//
// Gated to #technical-harness runs: renders ONLY when the technical-only
// harness-progress.log exists (orchestrator.md writes it under PERSONA: technical),
// so a normal / web-chat run never drops a board into the repo. Per-session
// subdir (SESSION_SHORT_ID) keeps concurrent sessions from colliding. No-op under
// a managed launcher (owns its own UI). Never throws: a view must not break a run.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createHookContext } from "./lib/context.mjs";
import { REPO } from "./lib/paths.mjs";
import { reviewsDir } from "./lib/reviews.mjs";
import { getBaseBranch, git } from "./lib/git.mjs";
import { sessionBaseBranch, sessionBranch } from "./lib/topology.mjs";

if (process.env.CHAT_SESSION_DIR) process.exit(0);

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const ctx = createHookContext(input, "render-status");

const progressLog = join(ctx.sessionDir, "harness-progress.log");
// No technical progress log → not a #technical-harness run → stay inert.
if (!existsSync(progressLog)) process.exit(0);

const WT_RE = /^(TASK-\d+|simple|_session)$/;
const TICKET_RE = /^TASK-\d+\.json$/;

// Tickets live in the session dir itself or a `tickets/` subdir - try both.
function readTickets() {
  for (const dir of [ctx.ticketsDir, ctx.sessionDir]) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => TICKET_RE.test(f));
    if (!files.length) continue;
    return files.sort().map((f) => {
      try {
        const t = JSON.parse(readFileSync(join(dir, f), "utf8"));
        return {
          id: t.id || f.replace(/\.json$/, ""),
          title: t.title || t.description || "",
          status: t.status || "planned",
          acceptanceCriteria: t.acceptance_criteria || [],
          files: t.files_to_modify || [],
          dependencies: t.dependencies || [],
        };
      } catch {
        return {
          id: f.replace(/\.json$/, ""),
          title: "",
          status: "unreadable",
        };
      }
    });
  }
  return [];
}

// A live worktree dir under the session base means work still in flight (the
// merger's cleanup-worktree removes it on merge).
function liveWorktrees() {
  if (!existsSync(ctx.worktreeBase)) return [];
  return readdirSync(ctx.worktreeBase, { withFileTypes: true })
    .filter((d) => d.isDirectory() && WT_RE.test(d.name))
    .map((d) => d.name)
    .sort();
}

const approved = (id) =>
  existsSync(join(reviewsDir(ctx), `${id}-quality-reviewer`));

function recentActivity(max = 25) {
  const lines = readFileSync(progressLog, "utf8")
    .split("\n")
    .filter((l) => l.trim());
  return lines.slice(-max);
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|");

// The cumulative diff of everything the session has changed so far: work already
// merged into `session/<short>` PLUS in-flight work still on live dev branches
// (`<short>/TASK-XXX`, `<short>/simple`) not yet merged. Written as a `.diff` file
// so the developer can open it and SEE the change on any surface (the VS Code
// extension does not show the /tmp worktree diffs). Updated on every agent STOP
// (not continuously while an agent works), so a developer's work appears once THAT
// developer stops - before the merge, not only after it. Null when nothing has
// changed vs the fork anchor yet.
const verifyRef = (ref) =>
  git(["rev-parse", "--verify", "--quiet", ref]).status === 0;

function diffSection(label, range) {
  const patch = git(["diff", range]).stdout;
  if (!patch.trim()) return null;
  return {
    label,
    range,
    patch,
    stat: git(["diff", "--stat", range]).stdout.trim(),
  };
}

function sessionDiff() {
  const anchor = sessionBaseBranch(ctx);
  const baseRef = verifyRef(anchor) ? anchor : getBaseBranch();
  const sessRef = sessionBranch(ctx);
  const sections = [];

  // Merged work: fork anchor -> session branch.
  if (verifyRef(sessRef)) {
    const s = diffSection(`merged into ${sessRef}`, `${baseRef}...${sessRef}`);
    if (s) sections.push(s);
  }

  // In-flight work: each <short>/* dev branch with commits not yet on the session
  // branch (diffed against it, so the already-merged part is not counted twice).
  const inflightBase = verifyRef(sessRef) ? sessRef : baseRef;
  const devBranches = git([
    "for-each-ref",
    "--format=%(refname:short)",
    `refs/heads/${ctx.sessionShort}/`,
  ])
    .stdout.split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  for (const br of devBranches) {
    const s = diffSection(`in flight: ${br}`, `${inflightBase}...${br}`);
    if (s) sections.push(s);
  }

  if (!sections.length) return null;
  return {
    patch: sections
      .map((s) => `### ${s.label} (${s.range})\n\n${s.patch}`)
      .join("\n\n"),
    stat: sections.map((s) => `${s.label}:\n${s.stat}`).join("\n\n"),
  };
}

function build() {
  const tickets = readTickets();
  const worktrees = liveWorktrees();
  const activeTasks = worktrees.filter((w) => /^TASK-\d+$/.test(w));
  const merged = tickets.filter((t) => t.status === "merged").length;
  const updated = new Date(statSync(progressLog).mtime).toISOString();
  const activity = recentActivity();
  const diff = sessionDiff();

  // STATUS.md - the live board.
  const statusMd = [
    `# ⚙ Harness session \`${ctx.sessionShort}\``,
    `_updated ${updated}_`,
    "",
    `**${merged}/${tickets.length} merged** · ${activeTasks.length} in flight`,
    "",
    "## Tickets",
    tickets.length
      ? "| Ticket | Status | Review | Title |"
      : "_no tickets yet_",
    tickets.length ? "|---|---|---|---|" : "",
    ...tickets.map(
      (t) =>
        `| ${t.id} | ${t.status} | ${approved(t.id) ? "✅" : ""} | ${cell(t.title)} |`,
    ),
    "",
    "## Live worktrees",
    worktrees.length
      ? worktrees.map((w) => `- \`${w}\``).join("\n")
      : "_none (nothing in flight)_",
    "",
    "## Changes",
    diff
      ? `Full patch in \`session.diff\` (same folder).\n\n\`\`\`\n${diff.stat}\n\`\`\``
      : "_no changes yet_",
    "",
    "## Recent activity",
    "```",
    ...activity,
    "```",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  // TICKETS.md - full ticket detail for the plan gate.
  const ticketsMd = [
    `# Tickets: session \`${ctx.sessionShort}\``,
    "",
    ...tickets.flatMap((t) => [
      `## ${t.id} · ${t.title}`,
      `- **Status:** ${t.status}${approved(t.id) ? " (reviewed ✅)" : ""}`,
      `- **Depends on:** ${t.dependencies?.length ? t.dependencies.join(", ") : "(none)"}`,
      `- **Files:** ${t.files?.length ? t.files.map((f) => `\`${f}\``).join(", ") : "(none)"}`,
      "- **Acceptance criteria:**",
      ...(t.acceptanceCriteria?.length
        ? t.acceptanceCriteria.map((c) => `  - ${c}`)
        : ["  - (none)"]),
      "",
    ]),
  ].join("\n");

  // status.json - compact, for the opt-in statusline.
  const statusJson = {
    short: ctx.sessionShort,
    updated,
    tickets: {
      total: tickets.length,
      merged,
      inProgress: activeTasks.length,
    },
    active: activeTasks.map((task) => ({ task })),
    last: activity[activity.length - 1] || "",
  };

  return { statusMd, ticketsMd, statusJson, diffPatch: diff?.patch };
}

try {
  const { statusMd, ticketsMd, statusJson, diffPatch } = build();
  const outDir = join(REPO, ".harness", ctx.sessionShort);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "STATUS.md"), statusMd);
  writeFileSync(join(outDir, "TICKETS.md"), ticketsMd);
  writeFileSync(
    join(outDir, "status.json"),
    JSON.stringify(statusJson, null, 2),
  );
  if (diffPatch) writeFileSync(join(outDir, "session.diff"), diffPatch);
  ctx.log(`rendered board -> ${outDir}`);
} catch (e) {
  ctx.log(`skipped: ${e?.message ?? e}`);
}

process.exit(0);
