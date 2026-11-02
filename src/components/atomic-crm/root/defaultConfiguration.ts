import type { ConfigurationContextValue } from "./ConfigurationContext";
// Import the logos as module assets so Vite resolves their URL relative to the
// JS chunk (import.meta.url), not the current route. A plain "./logos/..." path
// breaks on nested routes like /oauth/consent and under a deployment sub-path.
import darkModeLogo from "./logos/logo_atomic_crm_dark.svg";
import lightModeLogo from "./logos/logo_atomic_crm_light.svg";

export const defaultDarkModeLogo = darkModeLogo;
export const defaultLightModeLogo = lightModeLogo;

export const defaultCurrency = "USD";

export const defaultTitle = "Atomic CRM";

export const defaultCompanySectors = [
  // Technology & IT
  { value: "information-technology", label: "Information Technology" },
  { value: "software-development", label: "Software Development" },
  { value: "web-development", label: "Web Development" },
  { value: "mobile-app-development", label: "Mobile App Development" },
  { value: "it-services", label: "IT Services" },
  { value: "saas", label: "SaaS / Software as a Service" },
  { value: "cloud-computing", label: "Cloud Computing" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "artificial-intelligence", label: "Artificial Intelligence" },
  { value: "data-analytics", label: "Data Analytics" },
  { value: "technology-consulting", label: "Technology Consulting" },
  { value: "software-consulting", label: "Software Consulting" },
  { value: "devops", label: "DevOps & Cloud Engineering" },

  // Digital & Creative Services
  { value: "digital-agency", label: "Digital Agency" },
  { value: "digital-marketing", label: "Digital Marketing" },
  { value: "ui-ux-design", label: "UI/UX Design" },
  { value: "graphic-design", label: "Graphic Design" },
  { value: "branding", label: "Branding & Creative Services" },
  { value: "seo", label: "SEO & Search Marketing" },
  { value: "content-creation", label: "Content Creation" },
  { value: "advertising", label: "Advertising" },
  { value: "web-design", label: "Web Design" },
  { value: "e-learning", label: "E-learning & EdTech" },

  // Business & Professional Services
  { value: "business-consulting", label: "Business Consulting" },
  { value: "professional-services", label: "Professional Services" },
  { value: "staffing-recruitment", label: "Staffing & Recruitment" },
  { value: "education", label: "Education & Training" },
  { value: "financial-services", label: "Financial Services" },
  { value: "legal-services", label: "Legal Services" },
  { value: "accounting", label: "Accounting & Tax Services" },

  // Commerce & Retail
  { value: "e-commerce", label: "E-commerce" },
  { value: "retail", label: "Retail" },
  { value: "wholesale-distribution", label: "Wholesale & Distribution" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "consumer-goods", label: "Consumer Goods" },

  // Other Industries
  { value: "communication-services", label: "Communication Services" },
  { value: "consumer-discretionary", label: "Consumer Discretionary" },
  { value: "consumer-staples", label: "Consumer Staples" },
  { value: "energy", label: "Energy" },
  { value: "health-care", label: "Healthcare" },
  { value: "industrials", label: "Industrials" },
  { value: "materials", label: "Materials" },
  { value: "real-estate", label: "Real Estate" },
  { value: "utilities", label: "Utilities" },
  { value: "hospitality", label: "Hospitality & Tourism" },
  { value: "transportation-logistics", label: "Transportation & Logistics" },
  { value: "agriculture", label: "Agriculture" },
  { value: "automotive", label: "Automotive" },
  { value: "construction", label: "Construction" },
  { value: "food-beverage", label: "Food & Beverage" },
  { value: "media-entertainment", label: "Media & Entertainment" },
  { value: "non-profit", label: "Non-profit & NGOs" },
  { value: "other", label: "Other" },
];

export const defaultDealStages = [
  { value: "cold", label: "Cold" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "demo", label: "Demo" },
  { value: "interested", label: "Interested" },
  // Not Interested keeps the internal "lost" value so existing closed-lost
  // reporting logic keeps working.
  { value: "lost", label: "Not Interested" },
  { value: "proposal", label: "Proposal" },
  { value: "follow-up", label: "Follow-up" },
  { value: "won", label: "Won" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "other", label: "Other" },
  { value: "copywriting", label: "Copywriting" },
  { value: "print-project", label: "Print project" },
  { value: "ui-design", label: "UI Design" },
  { value: "website-design", label: "Website design" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "None" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Demo" },
  { value: "lunch", label: "Lunch" },
  { value: "meeting", label: "Meeting" },
  { value: "follow-up", label: "Follow-up" },
  { value: "thank-you", label: "Thank you" },
  { value: "ship", label: "Ship" },
  { value: "call", label: "Call" },
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
