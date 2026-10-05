// Emit a PreToolUse "block" decision on stdout — the channel Claude Code reads to
// deny a tool call while surfacing `reason` to the agent.
export function decisionBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
}
