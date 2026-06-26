import type { ConfigurationContextValue } from "./ConfigurationContext";

// Hyer branding
export const defaultDarkModeLogo = "./logos/logo_hyer_dark.svg";
export const defaultLightModeLogo = "./logos/logo_hyer_light.svg";

export const defaultCurrency = "USD";

export const defaultTitle = "Hyer CRM";

export const defaultCompanySectors = [
  { value: "saas", label: "SaaS" },
  { value: "ai-ml", label: "AI / ML" },
  { value: "fintech", label: "FinTech" },
  { value: "devtools", label: "Dev Tools / Infra" },
  { value: "ecommerce", label: "E-commerce / DTC" },
  { value: "healthtech", label: "HealthTech" },
  { value: "marketing-agency", label: "Marketing Agency" },
  { value: "energy", label: "Energy / Oil & Gas" },
  { value: "other", label: "Other" },
];

export const defaultDealStages = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "connected", label: "Connected" },
  { value: "replied", label: "Replied – Warm" },
  { value: "call-booked", label: "Call Booked" },
  { value: "proposal", label: "Proposal Sent" },
  { value: "won", label: "Won" },
  { value: "nurture", label: "Nurture / Later" },
  { value: "lost", label: "Not a Fit" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "dev-pod", label: "Dev Pod" },
  { value: "eor", label: "EOR Only" },
  { value: "ea-ops", label: "EA / Ops" },
  { value: "support", label: "Customer Support" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "energy", label: "Energy / O&G Search" },
  { value: "other", label: "Other" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "Client", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "None" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "call", label: "Call" },
  { value: "follow-up", label: "Follow-up" },
  { value: "demo", label: "Demo / Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "thank-you", label: "Thank you" },
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
