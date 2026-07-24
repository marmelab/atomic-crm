// Append a timestamped line to the #technical-harness progress log, but ONLY when
// that log already exists.
//
// Its existence is the technical-run gate: the orchestrator creates
// <sessionDir>/harness-progress.log under PERSONA: technical, render-status reads it,
// and a web-chat / normal run has none. Enrichers (validate-on-stop) call this to
// fill the otherwise-silent stretches BETWEEN the orchestrator's milestones, e.g.
// the multi-minute validation chain a developer runs on stop, so a `tail -f`, the
// board's "Recent activity", or a Monitor shows what is happening instead of going
// dark. Best-effort: logging must never break a run, and it never CREATES the log
// (creating it would leak a board into a non-technical run).

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} sessionDir  The harness session dir (ctx.sessionDir).
 * @param {string} line  Event text; a `HH:MM:SS ` UTC stamp is prepended to match
 *   the orchestrator's own lines.
 * @returns {boolean} true if a line was written, false if the log was absent/unwritable.
 */
export function appendProgress(sessionDir, line) {
  try {
    const file = join(sessionDir, "harness-progress.log");
    if (!existsSync(file)) return false; // not a technical run -> stay inert
    const stamp = new Date().toISOString().slice(11, 19); // HH:MM:SS UTC
    appendFileSync(file, `${stamp} ${line}\n`);
    return true;
  } catch {
    return false;
  }
}
