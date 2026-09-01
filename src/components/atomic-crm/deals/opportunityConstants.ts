// Deliberately plain data (no config/settings indirection) since this
// describes Leif's sales process itself, not per-tenant branding. Offer/
// Cohort choices are real data now (see the `offers` and `cohorts`
// resources) — this file only holds the sales-process vocabulary that has
// no table of its own.
import type {
  OpportunityEntryPath,
  OpportunityOutcome,
  OpportunityOwnerDecision,
  OpportunityProspectDecision,
  OpportunitySource,
} from "../types";

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
  // Native Application Intake slice, §9: the public /apply form sets this
  // automatically — it is not meant to be hand-picked from this list for a
  // Deal that didn't actually originate there, but stays selectable here
  // so an internally-created backfill/correction can still use it.
  { value: "application_form", label: "Application Form" },
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
  // Acuity/Sales Call Lifecycle slice: a genuine pipeline exit, explicitly
  // not a lost sale (set together with owner_decision = "workshops_only").
  { value: "workshops_only", label: "Workshops Only" },
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
