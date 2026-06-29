// Agent identity helpers — the single source for every hook that gates on who
// an agent is.

export const getFirstTaskId = (text) => (String(text ?? "").match(/TASK-[0-9]+/) || [])[0] || "";

// Agent-name role predicates. Match the bare role, a suffixed name
// (merger-TASK-003), or an @-qualified address.
export const isQualityReviewer = (name) => /^quality-reviewer([-@]|$)/.test(name || "");
export const isMerger = (name) => /^merger([-@]|$)/.test(name || "");
export const isDeveloper = (name) => /^developer([-@]|$)/.test(name || "");
// The orchestrator, including the chat- web variant and any runtime suffix
// (orchestrator-…). Single source for every gate that keys on "is this the
// orchestrator" (bash-guard guard-state rule, block-nested-orchestrator).
export const isOrchestrator = (name) => /^(chat-)?orchestrator([-@]|$)/.test(name || "");
