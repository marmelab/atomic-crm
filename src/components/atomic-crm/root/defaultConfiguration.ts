import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_hatch_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_hatch_crm_light.svg";

export const defaultCurrency = "CAD";

export const defaultTitle = "Hatch CRM";

export const defaultCompanySectors = [
  { value: "roofing", label: "Roofing" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "general-contractor", label: "General Contractor" },
  { value: "landscaping", label: "Landscaping" },
  { value: "painting", label: "Painting" },
  { value: "flooring", label: "Flooring" },
  { value: "windows-doors", label: "Windows & Doors" },
  { value: "other", label: "Other" },
];

export const defaultDealStages = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "audit-scheduled", label: "Audit Scheduled" },
  { value: "proposal-sent", label: "Proposal Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "ai-audit", label: "AI Audit" },
  { value: "workflow-automation", label: "Workflow Automation" },
  { value: "crm-setup", label: "CRM Setup" },
  { value: "full-package", label: "Full Package" },
  { value: "other", label: "Other" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "closed", label: "Closed", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "site-visit", label: "Site Visit" },
  { value: "demo", label: "Demo" },
  { value: "follow-up", label: "Follow-up" },
  { value: "audit-call", label: "Audit Call" },
  { value: "proposal", label: "Proposal" },
  { value: "meeting", label: "Meeting" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
