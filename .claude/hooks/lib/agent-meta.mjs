// Read the sibling <agent>.meta.json for a SubagentStop payload.
//
// At SubagentStop the big transcript JSONL is often not flushed yet (a real
// race), but the <agent>.meta.json written at spawn already carries the
// stopping agent's identity. Three hooks (record-review-verdict, validate-on-stop,
// cleanup-worktree) need it to scope their work to the right agent/worktree, so
// the path derivation + parse lives here once instead of being copy-pasted.
//
// Returns { agentType, description } (both strings, possibly empty), or null
// when the meta is absent/unreadable — callers then fall back to transcript
// recovery.

import { existsSync, readFileSync } from "node:fs";

/**
 * @param {Record<string, unknown>} payload  Parsed SubagentStop payload.
 * @returns {{ agentType: string, description: string } | null}
 */
export function readAgentMeta(payload) {
  const tp = String(
    (payload && (payload.agent_transcript_path || payload.transcript_path)) ||
      "",
  );
  const metaPath = tp.replace(/\.jsonl$/, ".meta.json");
  if (!metaPath.endsWith(".meta.json") || !existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    return {
      agentType: String(meta.agentType || ""),
      description: String(meta.description || ""),
    };
  } catch {
    return null;
  }
}
