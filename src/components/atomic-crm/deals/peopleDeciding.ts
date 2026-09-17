// "People Deciding" is ONE population with ONE definition, shared by the
// Dashboard and the Pipeline: the Opportunities sitting at the Decision
// stage that are still live.
//
// It used to mean something narrower on the Dashboard —
// `prospect_decision === 'thinking' && owner_decision === 'would_work_with'`
// — while the Pipeline's Decision column meant `stage === 'decision'`. The
// two disagreed in production: the Pipeline showed 8 people deciding and the
// Dashboard said "Nobody is currently deciding", because those two optional
// follow-up fields are set on exactly one Opportunity out of 120. The stage
// is the fact that is always recorded, so the stage is the definition.
//
// The decision fields are still meaningful — they say how a conversation is
// going — but they annotate a person who is deciding, they do not decide
// whether the person is in the list.

// The live-pipeline condition every other view already uses (see
// DealList.tsx): not archived, not Won, no exit outcome.
const isActiveOpportunity = (deal: {
  stage: string;
  outcome?: string | null;
  archived_at?: string | null;
}): boolean =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

export const DECIDING_STAGE = "decision";

export const isPersonDeciding = (deal: {
  stage: string;
  outcome?: string | null;
  archived_at?: string | null;
}): boolean => isActiveOpportunity(deal) && deal.stage === DECIDING_STAGE;

// Has this person actually told Leif they are thinking it over? Optional
// colour for the row, never a filter — an imported Opportunity at the
// Decision stage records the stage but not the conversation.
export const hasStatedDeciding = (deal: {
  prospect_decision?: string | null;
  owner_decision?: string | null;
}): boolean =>
  deal.prospect_decision === "thinking" &&
  deal.owner_decision === "would_work_with";
