// Agent identity helpers — the single source for every hook that gates on who
// an agent is.

export const getFirstTaskId = (text) => (String(text ?? "").match(/TASK-[0-9]+/) || [])[0] || "";

// Agent-name role predicates. Match the bare role, a suffixed name
// (merger-TASK-003), or an @-qualified address.
export const isQualityReviewer = (name) => /^quality-reviewer([-@]|$)/.test(name || "");
export const isTestValidator = (name) => /^test-validator([-@]|$)/.test(name || "");
export const isMerger = (name) => /^merger([-@]|$)/.test(name || "");
