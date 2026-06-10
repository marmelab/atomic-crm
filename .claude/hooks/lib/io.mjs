// SendMessage bodies may be strings or structured objects; gating hooks match
// substrings (shutdown_request, TASK-XXX) against one canonical stringification.
export function stringifyMessage(message) {
  if (typeof message === "string") return message;
  return message != null ? JSON.stringify(message) : "";
}

export function decisionBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
}
