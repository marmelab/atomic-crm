import type { Contact } from "../types";

export const researchStatusChoices = [
  { id: "new", name: "New" },
  { id: "researching", name: "Researching" },
  { id: "enriched", name: "Enriched" },
  { id: "verified", name: "Verified" },
  { id: "ready_for_review", name: "Ready for review" },
  { id: "approved_for_instantly", name: "Approved for Instantly" },
  { id: "needs_fixing", name: "Needs fixing" },
  { id: "rejected", name: "Rejected" },
  { id: "in_campaign", name: "In campaign" },
  { id: "replied", name: "Replied" },
  { id: "bad_fit", name: "Bad fit" },
];

export const getResearchStatusLabel = (status?: string | null) =>
  researchStatusChoices.find((choice) => choice.id === status)?.name ?? "New";

export const getLeadQualityItems = (lead: Contact) => {
  const hasEmail = lead.email_jsonb?.some((item) => item.email);
  return [
    { label: "Company name", complete: Boolean(lead.company_name) },
    { label: "Website", complete: Boolean(lead.company_website) },
    {
      label: "LinkedIn company page",
      complete: Boolean(lead.company_linkedin_url),
      optional: true,
    },
    {
      label: "Employee count",
      complete: lead.company_size != null,
      optional: true,
    },
    { label: "ICP score", complete: lead.icp_score != null },
    { label: "Trigger reason", complete: Boolean(lead.trigger_reason) },
    {
      label: "Decision maker name",
      complete: Boolean(lead.first_name || lead.last_name),
    },
    { label: "Decision maker title", complete: Boolean(lead.title) },
    {
      label: "LinkedIn profile",
      complete: Boolean(lead.linkedin_url),
      optional: true,
    },
    {
      label: "Verified email",
      complete: Boolean(hasEmail && lead.email_verified),
    },
    { label: "Notes", complete: Boolean(lead.background) },
  ];
};

export const isLeadReadyForReview = (lead: Contact) =>
  getLeadQualityItems(lead)
    .filter((item) => !item.optional)
    .every((item) => item.complete);
