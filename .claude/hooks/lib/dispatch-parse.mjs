// Parse a PreToolUse(Agent) hook payload: the dispatch tool_input plus the
// `KEY: value` contract carried in the dispatch prompt (chat-orchestrator STATE B
// templates). Every Agent-gating hook (setup-worktree, enforce-dev-dispatch,
// block-merger-without-review, block-promote-unmerged) parses through here, so
// the contract regexes live in exactly one place.
//
// TASK_ID is anchored at line start and only accepts TASK-<n> | SIMPLE | MIGRATION
// | PROMOTE | ROLLBACK, so prose mentioning another ticket (e.g. "TASK-001 is
// merged; now merge this one") can never mis-key a gate.

/**
 * @param {Record<string, unknown>} input  Parsed PreToolUse(Agent) payload.
 * @returns {object} Dispatch fields used by the Agent-gating hooks.
 */
export function parseDispatch(input) {
  const ti = (input && input.tool_input) || {};
  const prompt = String(ti.prompt ?? "");
  const grab = (re) => {
    const m = prompt.match(re);
    return m ? m[1] : "";
  };
  return {
    // "" for the main orchestrator; the agent's own type for a subagent-issued
    // dispatch (none of the ticket agents can dispatch, so this is informational).
    callerAgentType: String(input?.agent_type ?? ""),
    subagentType: String(ti.subagent_type ?? ""),
    name: String(ti.name ?? ""),
    isolation: String(ti.isolation ?? ""),
    runInBackground: Boolean(ti.run_in_background),
    role: grab(/^ROLE:\s*(\S+)/m),
    taskId: grab(/^TASK_ID:\s*(TASK-\d+|SIMPLE|MIGRATION|PROMOTE|ROLLBACK)\b/m),
    worktreePath: grab(/^WORKTREE_PATH:\s*(\S+)/m),
    branchName: grab(/^BRANCH_NAME:\s*(\S+)/m),
    mode: grab(/^MODE:\s*(\S+)/m),
    sessionShortId: grab(/^SESSION_SHORT_ID:\s*(\S+)/m),
    ticketFile: grab(/^TICKET_FILE:\s*(\S+)/m),
    ticketsDir: grab(/^TICKETS_DIR:\s*(\S+)/m),
  };
}
