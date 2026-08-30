// "People Deciding" is not "Hot Contacts" — it's the small set of active
// prospects genuinely in a decision/follow-up holding pattern. An
// Opportunity qualifies only when the owner would work with them, the
// prospect said they're thinking it over, and nothing has closed the loop
// (Won or an exit outcome) yet.
export const isPersonDeciding = (deal: {
  prospect_decision?: string | null;
  owner_decision?: string | null;
  stage: string;
  outcome?: string | null;
}): boolean =>
  deal.prospect_decision === "thinking" &&
  deal.owner_decision === "would_work_with" &&
  deal.stage !== "won" &&
  deal.outcome == null;
