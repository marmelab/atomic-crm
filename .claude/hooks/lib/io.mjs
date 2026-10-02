// Emit a PreToolUse "block" decision on stdout — the channel Claude Code reads to
// deny a tool call while surfacing `reason` to the agent.
export function decisionBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
}

// Replace a PreToolUse call's `tool_input` and let it proceed. Sent without
// `permissionDecision`, so the call still goes through the project's permission rules.
export function updatedToolInput(toolInput) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: toolInput,
      },
    }) + "\n",
  );
}
