#!/usr/bin/env node
//
// Harness monitor — a terminal view of an agent-workflow session.
//
// Gather informations from three places, all keyed by the session id:
//
//   1. hooks.log            <TMP_ROOT>/<sanitized-repo>/<id>/hooks.log
//   2. subagent transcripts ~/.claude/projects/<slug>/<id>/subagents/*.jsonl
//   3. tickets              <CHAT_SESSION_DIR or TICKETS_DIR>/TASK-*.json
//
// Usage:
//   scripts/harness-monitor.mjs                 # latest session, one-shot summary
//   scripts/harness-monitor.mjs --watch         # latest session, live (re-renders)
//   scripts/harness-monitor.mjs --session <id>  # a specific session id
//   scripts/harness-monitor.mjs --list          # list known sessions, newest first

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

// ─── paths & session discovery ──────────────────────────────────────────────

const REPO = (() => {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.cwd();
  }
})();

const TMP_ROOT = process.env.CRM_TMP_ROOT || "/tmp";
const sanitize = (p) => String(p).replace(/\//g, "_");
const WORKTREE_ROOT = join(TMP_ROOT, sanitize(REPO)); // /tmp/_workspaces_atomic-crm
const CLAUDE_PROJ = join(
  homedir(),
  ".claude",
  "projects",
  REPO.replace(/\//g, "-"),
);
const HARNESS_ROOT = "/tmp/atomic-crm-harness";

// A session id is a worktree-base subdir that has a hooks.log. Test fixtures
// (td-1, td-2, …) are skipped — they are not real sessions.
function listSessions() {
  if (!existsSync(WORKTREE_ROOT)) return [];
  return readdirSync(WORKTREE_ROOT)
    .filter((name) => !/^td-/.test(name))
    .map((id) => ({ id, log: join(WORKTREE_ROOT, id, "hooks.log") }))
    .filter((s) => existsSync(s.log))
    .map((s) => ({ ...s, mtime: statSync(s.log).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

function sessionPaths(id) {
  const base = join(WORKTREE_ROOT, id);
  return {
    id,
    base,
    hooksLog: join(base, "hooks.log"),
    mainTranscript: join(CLAUDE_PROJ, `${id}.jsonl`),
    subagentsDir: join(CLAUDE_PROJ, id, "subagents"),
    ticketDirs: [join(HARNESS_ROOT, id), join(base, "tickets")],
  };
}

// A worktree path → a short, human label. `simple` is the simple-developer's
// worktree; `_session` is the shared integration worktree the merger merges
// into before promoting to the base branch.
function wtLabel(path) {
  if (!path) return "";
  const b = basename(path);
  if (b === "_session") return "_session (integration)";
  if (b === "simple") return "simple (dev worktree)";
  return b; // TASK-XXX
}

// ─── colour helpers ─────────────────────────────────────────────────────────

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);
const red = (s) => c("31", s);
const green = (s) => c("32", s);
const yellow = (s) => c("33", s);
const blue = (s) => c("36", s);
const mag = (s) => c("35", s);

const hhmmss = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(11, 19);
};

// ─── hooks.log parsing ──────────────────────────────────────────────────────
// Line shape: `[<iso-ts>] [<hook>] <rest...>`. Lines without that prefix are
// continuation output (e.g. a multi-line validation failure) and attach to the
// previous event as detail.

const LINE_RE = /^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/;

function parseHooksLog(path) {
  if (!existsSync(path)) return [];
  const events = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (!m) {
      if (events.length) events[events.length - 1].detail.push(line);
      continue;
    }
    const [, ts, hook, rest] = m;
    const fields = {};
    for (const f of rest.matchAll(/(\w+)=(\S+)/g)) fields[f[1]] = f[2];
    const state = rest.split(/\s+/)[0];
    events.push({ ts, hook, state, rest, fields, detail: [] });
  }
  return events;
}

// ─── subagent transcripts ───────────────────────────────────────────────────

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

// Claude Code records a failed hook command as an `attachment` whose inner type
// is hook_(non_)blocking_error.
function hookErrorsFrom(records) {
  const errs = [];
  for (const rec of records) {
    const a = rec.attachment;
    if (!a || !/hook_(non_)?blocking_error/.test(a.type || "")) continue;
    errs.push({
      ts: rec.timestamp,
      hookName: a.hookName || a.hookEvent || "hook",
      stderr: (a.stderr || "").split("\n")[0].slice(0, 120),
      command: (a.command || "").slice(0, 80),
      exitCode: a.exitCode,
      blocking: !/non_blocking/.test(a.type || ""),
    });
  }
  return errs;
}

function readAgents(dir) {
  if (!existsSync(dir)) return [];
  const agents = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const agentId = basename(file, ".jsonl");
    const meta = (() => {
      const p = join(dir, `${agentId}.meta.json`);
      try {
        return JSON.parse(readFileSync(p, "utf8"));
      } catch {
        return {};
      }
    })();

    const records = readJsonl(join(dir, file));
    const toolCounts = {};
    const messages = []; // SendMessage payloads, timestamped
    let lastText = "";
    let firstTs = null;
    let lastTs = null;
    for (const rec of records) {
      if (rec.timestamp) {
        if (!firstTs) firstTs = rec.timestamp;
        lastTs = rec.timestamp;
      }
      const content = rec.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === "tool_use") {
          toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
          if (block.name === "SendMessage") {
            const to = block.input?.to ?? "?";
            const msg = block.input?.message;
            messages.push({
              to,
              text: typeof msg === "string" ? msg : JSON.stringify(msg),
              ts: rec.timestamp,
            });
          }
        } else if (block.type === "text" && block.text.trim()) {
          lastText = block.text.trim();
        }
      }
    }
    agents.push({
      agentId,
      type: meta.agentType || "?",
      description: meta.description || "",
      toolCounts,
      messages,
      lastText,
      firstTs,
      lastTs,
      hookErrors: hookErrorsFrom(records),
      verdict: classifyVerdict(lastText),
    });
  }
  // Chronological by last activity so repeated dispatches of the same agent
  // (retries / resumes) read top-to-bottom in the order they ran.
  return agents.sort((a, b) =>
    String(a.lastTs || "").localeCompare(String(b.lastTs || "")),
  );
}

// The orchestrator is the main session transcript, NOT a subagent.
function readOrchestrator(path) {
  const records = readJsonl(path);
  if (!records.length) return null;
  let lastText = "";
  let lastTs = null;
  const dispatches = []; // { ts, type } — when the orchestrator spawned each agent
  for (const rec of records) {
    if (rec.timestamp) lastTs = rec.timestamp;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        block.type === "tool_use" &&
        (block.name === "Agent" || block.name === "Task")
      )
        dispatches.push({
          ts: rec.timestamp,
          type:
            block.input?.subagent_type || block.input?.description || "agent",
        });
      else if (block.type === "text" && block.text.trim())
        lastText = block.text.trim();
    }
  }
  return { lastText, lastTs, dispatches, hookErrors: hookErrorsFrom(records) };
}

// Merge every timestamped signal — orchestrator spawns, agent SendMessages,
// agent completions, and the key hook milestones — into one chronological
// stream. This is the "what happened, in order" view: dev → merger, etc.
function buildEventTimeline(orchestrator, agents, events) {
  const items = [];
  const push = (ts, color, icon, text) =>
    ts && items.push({ ts, color, icon, text });

  for (const d of orchestrator?.dispatches ?? [])
    push(d.ts, blue, "▶", `orchestrator spawned ${bold(d.type)}`);

  for (const a of agents) {
    for (const m of a.messages)
      push(
        m.ts,
        mag,
        "→",
        `${a.type} → ${bold(m.to)}: ${m.text.split("\n")[0].slice(0, 80)}`,
      );
    const mark =
      a.verdict.kind === "done"
        ? green("✓")
        : a.verdict.kind === "fail"
          ? red("✗")
          : dim("■");
    const vcolor =
      a.verdict.kind === "fail" ? red : a.verdict.kind === "done" ? green : dim;
    push(
      a.lastTs,
      vcolor,
      mark,
      `${a.type} finished — ${a.verdict.label.slice(0, 80)}`,
    );
  }

  for (const e of events) {
    if (e.hook === "setup-worktree" && e.state === "CREATED")
      push(e.ts, blue, "⊕", `worktree created ${dim(wtLabel(e.fields.path))}`);
    else if (e.hook === "validate" && e.state === "OK")
      push(e.ts, green, "✓", `validation OK ${dim(wtLabel(e.fields.wt))}`);
    else if (e.hook === "validate" && e.state === "FAIL")
      push(
        e.ts,
        red,
        "✗",
        `validation FAIL ${e.fields.step || ""}${e.detail.length ? dim(" — " + e.detail.join(" ").slice(0, 60)) : ""}`,
      );
    else if (e.hook === "circuit-breaker" && /^BLOCK/.test(e.rest))
      push(e.ts, red, "⛔", `circuit-breaker BLOCK (count=${e.fields.count})`);
  }

  if (orchestrator?.lastTs)
    push(
      orchestrator.lastTs,
      dim,
      "▣",
      `orchestrator last said: ${orchestrator.lastText.split("\n").pop().slice(0, 80)}`,
    );

  return items.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

// Synthesize a single completion verdict for the whole session from the
// strongest available signal: the merger's DONE line, then a clean
// no-dirty-worktree finish, else still-running / unknown.
function sessionStatus(agents, events) {
  const merger = agents.find((a) => a.type === "merger");
  if (merger) {
    const m = merger.lastText.match(/DONE:\s*commit=(\S+)/i);
    if (m)
      return green(
        `✓ COMPLETE — merger promoted to main (commit ${m[1].replace(/[.,]$/, "")})`,
      );
    if (/promotion merged|merged .*into main/i.test(merger.lastText))
      return green("✓ COMPLETE — merger reported the session merged into main");
    if (merger.verdict.kind === "fail")
      return red(`✗ merger FAILED — ${merger.verdict.label.slice(0, 120)}`);
  }
  if (agents.some((a) => a.verdict.kind === "fail"))
    return red("✗ FAILED — an agent ended in failure (see DIAGNOSIS)");
  const lastValidate = [...events]
    .reverse()
    .find((e) => e.hook === "validate" && e.state === "ACCEPT");
  if (lastValidate && /no_dirty_worktree/.test(lastValidate.rest))
    return yellow(
      "… likely done — last validation found nothing left to do, but no merger DONE was seen",
    );
  return yellow("… in progress / outcome unclear");
}

// The structured-text contract: agents end with DONE / FAILED / BLOCKED, or a
// reviewer verdict.
function classifyVerdict(text) {
  if (!text) return { kind: "running", label: "running / no final message" };
  const head =
    text
      .split("\n")
      .find((l) => l.trim())
      ?.slice(0, 200) ?? "";
  if (/^FAILED\b|permanently deadlocked|\bBLOCKED\b/im.test(text))
    return { kind: "fail", label: head };
  if (
    /^DONE:|merged\s+TASK|merged successfully|promotion merged|completed successfully|^Verdict:\s*(APPROVED|GREEN)/im.test(
      text,
    )
  )
    return { kind: "done", label: head };
  return { kind: "info", label: head };
}

// ─── tickets ────────────────────────────────────────────────────────────────

function readTickets(dirs) {
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => /^TASK-\d+\.json$/.test(f));
    if (!files.length) continue;
    return files.sort().map((f) => {
      try {
        const t = JSON.parse(readFileSync(join(dir, f), "utf8"));
        return {
          id: t.id || basename(f, ".json"),
          status: t.status || "?",
          title: t.title || t.description || "",
        };
      } catch {
        return { id: basename(f, ".json"), status: "unreadable", title: "" };
      }
    });
  }
  return [];
}

// ─── diagnosis ──────────────────────────────────────────────────────────────
// Turn the raw event stream into named pathologies.

function diagnose(events, agents, hookErrors = []) {
  const findings = [];

  // 0. Failed hook commands (from the transcript, not hooks.log). Aggregate by
  //    hook + first error line so a hook that fires on every tool use collapses
  //    into one finding with a count.
  const byErr = new Map();
  for (const h of hookErrors) {
    const key = `${h.hookName} → ${h.stderr}`;
    const row = byErr.get(key) ?? { ...h, count: 0 };
    row.count++;
    byErr.set(key, row);
  }
  for (const h of byErr.values()) {
    const sev = h.blocking ? red("✗") : yellow("⚠");
    const cmd = h.command ? dim(` [${h.command}]`) : "";
    findings.push(
      `${sev} ${h.blocking ? "BLOCKING " : ""}hook error ×${h.count}: ${h.hookName} — ${h.stderr} (exit ${h.exitCode})${cmd}`,
    );
  }

  // 1. A validation step that keeps failing on the same worktree.
  const validFails = events.filter(
    (e) => e.hook === "validate" && e.state === "FAIL" && e.fields.step,
  );
  const byStep = {};
  for (const e of validFails)
    byStep[e.fields.step] = (byStep[e.fields.step] || 0) + 1;
  for (const [step, n] of Object.entries(byStep)) {
    if (n >= 2)
      findings.push(
        red(
          `✗ validation never passes: '${step}' failed ${n}× — the flow cannot complete until this is green.`,
        ),
      );
  }

  // 2. Circuit-breaker blocks → an agent is re-submitting an identical action.
  const blocks = events.filter(
    (e) => e.hook === "circuit-breaker" && /^BLOCK/.test(e.rest),
  );
  if (blocks.length) {
    const maxCount = Math.max(
      ...blocks.map((b) => Number(b.fields.count) || 0),
    );
    findings.push(
      red(
        `✗ retry loop: circuit-breaker BLOCKED ${blocks.length}× (up to ${maxCount} identical attempts) — the agent is stuck repeating the same call.`,
      ),
    );
  }

  // 3. bash-guard blocks → agent fighting the validation/permission rules.
  const guard = events.filter(
    (e) => e.hook === "bash-guard" && /BLOCK/.test(e.rest),
  );
  if (guard.length >= 3)
    findings.push(
      yellow(
        `⚠ ${guard.length} bash-guard blocks — the agent tried to run forbidden commands (often a sign it's flailing).`,
      ),
    );

  // 4. Agents that reported failure
  const seen = new Set();
  for (const a of agents) {
    const signals = [
      a.verdict.kind === "fail" ? a.verdict.label : "",
      ...a.messages.map((m) => m.text),
    ];
    for (const s of signals) {
      const head = s.split("\n")[0];
      if (
        !/FAILED|BLOCKED|worktree not found|cannot create worktree/i.test(head)
      )
        continue;
      const key = `${a.type}:${head.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(red(`✗ ${a.type}: ${head.slice(0, 140)}`));
    }
  }

  // 4b. A TASK developer ran but its worktree was never created.
  const createdTasks = new Set(
    events
      .filter(
        (e) =>
          e.hook === "setup-worktree" &&
          /CREATED/.test(e.rest) &&
          e.fields.branch,
      )
      .map((e) => (e.fields.branch.match(/TASK-\d+/) || [])[0])
      .filter(Boolean),
  );
  for (const a of agents) {
    const task = (a.type.match(/TASK-\d+/) || [])[0];
    if (task && !createdTasks.has(task) && /developer/.test(a.type))
      findings.push(
        red(
          `✗ ${task}: worktree never created (no setup-worktree CREATED entry) — the developer has nowhere to work.`,
        ),
      );
  }

  // 5. Worktree setup failure.
  if (
    events.some(
      (e) => e.hook === "setup-worktree" && /FAILED|EXIT=2/.test(e.rest),
    )
  )
    findings.push(
      red("✗ setup-worktree failed — no usable worktree was created."),
    );

  if (!findings.length) findings.push(green("✓ no known pathology detected."));
  return findings;
}

// ─── rendering ──────────────────────────────────────────────────────────────

function render(id, limit = 0) {
  const p = sessionPaths(id);
  const events = parseHooksLog(p.hooksLog);
  const agents = readAgents(p.subagentsDir);
  const orchestrator = readOrchestrator(p.mainTranscript);
  const tickets = readTickets(p.ticketDirs);
  const out = [];
  const line = (s = "") => out.push(s);

  line(bold(blue(`━━━ harness session ${id} ━━━`)));
  line(dim(`repo: ${REPO}`));
  line(dim(`base: ${p.base}`));
  if (existsSync(p.hooksLog))
    line(
      dim(
        `hooks.log: ${events.length} events, updated ${hhmmss(new Date(statSync(p.hooksLog).mtime).toISOString())}`,
      ),
    );
  else line(red("hooks.log: missing"));
  line();

  // Headline: did the session complete?
  line(bold("STATUS  ") + sessionStatus(agents, events));
  if (orchestrator)
    line(
      `  ${dim("orchestrator last said:")} ${orchestrator.lastText.split("\n").pop().slice(0, 140) || dim("(none)")}`,
    );
  else line(`  ${dim("orchestrator: main transcript not found")}`);
  line();

  // Agents
  line(bold("AGENTS"));
  if (!agents.length) line(dim("  (no subagent transcripts found)"));
  for (const a of agents) {
    const mark =
      a.verdict.kind === "done"
        ? green("✓")
        : a.verdict.kind === "fail"
          ? red("✗")
          : yellow("…");
    const tools = Object.entries(a.toolCounts)
      .map(([n, k]) => `${n}:${k}`)
      .join(" ");
    line(`  ${mark} ${bold(a.type)} ${dim(a.description)}`);
    if (tools) line(`      ${dim("tools")} ${tools}`);
    for (const m of a.messages)
      line(`      ${mag("→ " + m.to)} ${m.text.split("\n")[0].slice(0, 100)}`);
    if (a.verdict.label)
      line(
        `      ${a.verdict.kind === "fail" ? red(a.verdict.label) : dim(a.verdict.label)}`,
      );
  }
  line();

  // Tickets
  if (tickets.length) {
    line(bold("TICKETS"));
    for (const t of tickets) {
      const cl =
        t.status === "merged"
          ? green
          : t.status === "in_progress"
            ? yellow
            : dim;
      line(`  ${cl(t.status.padEnd(12))} ${t.id} ${dim(t.title.slice(0, 80))}`);
    }
    line();
  }

  // Unified event timeline: orchestrator spawns + agent messages + completions
  // + key hook milestones, in chronological order. Consecutive identical rows
  // (e.g. the same validation failing 40×) are run-length collapsed to `×N`.
  let timeline = buildEventTimeline(orchestrator, agents, events);
  const total = timeline.length;
  if (limit && total > limit) timeline = timeline.slice(total - limit);
  line(
    bold("EVENT TIMELINE") +
      dim(
        `  (chronological${limit && total > limit ? `, last ${limit} of ${total}` : ""})`,
      ),
  );
  let i = 0;
  while (i < timeline.length) {
    let j = i;
    while (j + 1 < timeline.length && timeline[j + 1].text === timeline[i].text)
      j++;
    const n = j - i + 1;
    const ev = timeline[i];
    const span = n > 1 ? dim(`  ×${n} (until ${hhmmss(timeline[j].ts)})`) : "";
    line(`  ${dim(hhmmss(ev.ts))} ${ev.color(ev.icon)} ${ev.text}${span}`);
    i = j + 1;
  }
  line();

  // Diagnosis — include hook-command failures gathered from every transcript
  // (orchestrator + each subagent), which never appear in hooks.log.
  const hookErrors = [
    ...(orchestrator?.hookErrors ?? []),
    ...agents.flatMap((a) => a.hookErrors ?? []),
  ];
  line(bold("DIAGNOSIS"));
  for (const f of diagnose(events, agents, hookErrors)) line(`  ${f}`);

  return out.join("\n");
}

// ─── main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

// This is a CLI tool: its whole job is to write a report to stdout. ESLint's
// no-console rule only permits warn/error, so write to stdout directly.
const print = (s = "") => process.stdout.write(s + "\n");

if (has("--list")) {
  const sessions = listSessions();
  if (!sessions.length) {
    print("No sessions found under " + WORKTREE_ROOT);
    process.exit(0);
  }
  print(bold("Sessions (newest first):"));
  for (const s of sessions)
    print(
      `  ${s.id}  ${dim(new Date(s.mtime).toISOString().slice(0, 19).replace("T", " "))}`,
    );
  process.exit(0);
}

const sessionId = valueOf("--session") || listSessions()[0]?.id;
if (!sessionId) {
  console.error(
    red(
      `No session found under ${WORKTREE_ROOT}. Start the harness first (make harness).`,
    ),
  );
  process.exit(1);
}

if (has("--watch")) {
  // Use the terminal's alternate screen buffer (like top/htop/less): the view
  // redraws in place and never pollutes the scrollback. We restore the normal
  // screen on exit. The timeline is capped to the visible height so the newest
  // events are always on screen instead of scrolling off the top.
  const enter = () => process.stdout.write("\x1b[?1049h\x1b[?25l");
  const leave = () => process.stdout.write("\x1b[?1049l\x1b[?25h");
  const tick = () => {
    const limit = Math.max(8, (process.stdout.rows || 40) - 18); // leave room for header/agents
    process.stdout.write("\x1b[H\x1b[J"); // home + clear to end
    process.stdout.write(render(sessionId, limit));
    process.stdout.write(
      "\n" + dim(`watching ${sessionId} — refresh 1.5s — Ctrl-C to quit`),
    );
  };
  enter();
  tick();
  const iv = setInterval(tick, 1500);
  const quit = () => {
    clearInterval(iv);
    leave();
    process.exit(0);
  };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
} else {
  print(render(sessionId));
}
