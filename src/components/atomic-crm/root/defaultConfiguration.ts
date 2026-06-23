import type { UpsellOffer } from "../types";
import type {
  ConfigurationContextValue,
  SellerCompanyInfo,
} from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/axona-logo-dark.png";
export const defaultLightModeLogo = "./logos/axona-logo-light.png";

export const defaultCurrency = "USD";

export const defaultTitle = "Axona Digital CRM";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Communication Services" },
  { value: "consumer-discretionary", label: "Consumer Discretionary" },
  { value: "consumer-staples", label: "Consumer Staples" },
  { value: "energy", label: "Energy" },
  { value: "financials", label: "Financials" },
  { value: "health-care", label: "Health Care" },
  { value: "industrials", label: "Industrials" },
  { value: "information-technology", label: "Information Technology" },
  { value: "materials", label: "Materials" },
  { value: "real-estate", label: "Real Estate" },
  { value: "utilities", label: "Utilities" },
];

export const defaultDealStages = [
  { value: "opportunity", label: "Opportunity" },
  { value: "generating-proposal", label: "Generating Proposal" },
  { value: "proposal-sent", label: "Proposal Sent" },
  { value: "in-negociation", label: "In Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "delayed", label: "Delayed" },
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

export const defaultSellerCompany: SellerCompanyInfo = {
  companyName: "",
  orgNumber: "",
  vatNumber: "",
  fSkatt: true,
  address: "",
  zipcode: "",
  city: "",
  country: "Sverige",
  phone: "",
  email: "",
  website: "",
  bankgiro: "",
  plusgiro: "",
  iban: "",
  bic: "",
  defaultPaymentTerms: "30 dagar netto",
  defaultDeliveryTerms: "",
  defaultTermsAndConditions: "",
  quoteLogo: "",
};

export const defaultRevenueGoals: import("./ConfigurationContext").RevenueGoal[] =
  [];

// Default upsell-katalog för månadsrapporten (utan pris — pris tas i dialog).
// Speglar DEFAULT_UPSELL_CATALOG i supabase/functions/_shared/monthlyReport/upsellCatalog.ts.
export const defaultUpsellCatalog: UpsellOffer[] = [
  {
    service: "Prestandaoptimering",
    label: "Prestandaoptimering",
    description:
      "Er sida laddar långsamt — och varje sekund kostar er besökare som annars blivit kunder.",
    pitch:
      "Vi gör sidan snabbare. Snabbare laddning ger lägre avhopp och fler bokningar/förfrågningar.",
  },
  {
    service: "SEO-optimering",
    label: "SEO-optimering",
    description:
      "Ni ligger nära förstasidan på Google men inte riktigt framme — där de flesta klicken finns.",
    pitch:
      "Ni är några steg från förstasidan på era viktigaste sökord. Den snabbaste synlighetsvinsten.",
  },
  {
    service: "AI-sök-optimering",
    label: "AI-sök-optimering",
    description:
      "När folk frågar ChatGPT, Claude eller Google AI om er bransch nämns ni sällan.",
    pitch:
      "Vi strukturerar ert innehåll så att AI förstår och rekommenderar er — inte konkurrenten.",
  },
  {
    service: "Google Business-paket",
    label: "Google Business-paket",
    description:
      "Er Google Business-profil saknas eller har för få/för gamla recensioner.",
    pitch:
      "Vi sätter upp och vårdar profilen och bygger en rutin för jämn ström av recensioner.",
  },
  {
    service: "Innehåll & synlighet",
    label: "Innehåll & synlighet",
    description: "Google och AI förstår inte riktigt vad ni erbjuder.",
    pitch: "Vi gör innehållet tydligt och begripligt för både Google och AI.",
  },
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
  sellerCompany: defaultSellerCompany,
  proposalKbTemplate: "",
  revenueGoals: defaultRevenueGoals,
  monthlyReport: { upsellCatalog: defaultUpsellCatalog },
};
