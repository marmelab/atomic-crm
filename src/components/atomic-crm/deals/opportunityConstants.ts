// Fixed reference data for this proof slice. A single hardcoded offer
// stands in for a future `offers` table; everything below is deliberately
// plain data (no config/settings indirection) since it describes Leif's
// sales process itself, not per-tenant branding.
import type {
  OpportunityEntryPath,
  OpportunityOffer,
  OpportunityOutcome,
  OpportunityOwnerDecision,
  OpportunityProspectDecision,
  OpportunitySource,
} from "../types";

export const LIVING_EXAMPLE_OFFER: OpportunityOffer = "the_living_example";

export const offerLabels: Record<OpportunityOffer, string> = {
  the_living_example: "The Living Example",
};

// 4-month 1:1 coaching. Payment options and active-client capacity are
// reference data only for this slice — not yet enforced anywhere.
export const LIVING_EXAMPLE_PRICE = 4000;

export const opportunitySources: { value: OpportunitySource; label: string }[] =
  [
    { value: "instagram", label: "Instagram" },
    { value: "referral", label: "Referral" },
    { value: "podcast", label: "Podcast" },
    { value: "workshop", label: "Workshop" },
    { value: "substack", label: "Substack" },
    { value: "google", label: "Google" },
    { value: "other", label: "Other" },
  ];

export const opportunityEntryPaths: {
  value: OpportunityEntryPath;
  label: string;
}[] = [
  { value: "instagram_conversation", label: "Instagram Conversation" },
  { value: "sales_page", label: "Sales Page" },
  { value: "other", label: "Other" },
];

export const opportunityOutcomes: {
  value: OpportunityOutcome;
  label: string;
}[] = [
  { value: "nurture", label: "Nurture" },
  { value: "needs_higher_care", label: "Needs Higher Care" },
  { value: "not_fit", label: "Not Fit" },
  { value: "lost", label: "Lost" },
];

export const ownerDecisions: {
  value: OpportunityOwnerDecision;
  label: string;
}[] = [
  { value: "would_work_with", label: "Would Work With" },
  { value: "workshops_only", label: "Workshops Only" },
  { value: "do_not_engage", label: "Do Not Engage" },
];

export const prospectDecisions: {
  value: OpportunityProspectDecision;
  label: string;
}[] = [
  { value: "yes", label: "Yes" },
  { value: "thinking", label: "Thinking" },
  { value: "no", label: "No" },
];
