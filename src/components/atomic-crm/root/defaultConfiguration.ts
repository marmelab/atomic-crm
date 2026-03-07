import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Atomic CRM";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Services comm." },
  { value: "consumer-discretionary", label: "Distrib. sélective" },
  { value: "consumer-staples", label: "Biens de conso." },
  { value: "energy", label: "Énergie" },
  { value: "financials", label: "Finance" },
  { value: "health-care", label: "Santé" },
  { value: "industrials", label: "Industrie" },
  { value: "information-technology", label: "Tech. info." },
  { value: "materials", label: "Matériaux" },
  { value: "real-estate", label: "Immobilier" },
  { value: "utilities", label: "Services publics" },
];

export const defaultDealStages = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualifié" },
  { value: "follow-up", label: "Suivi" },
  { value: "trial", label: "Essai" },
  { value: "closed-won", label: "Gagné" },
  { value: "perdu", label: "Perdu" },
  { value: "trial-failed", label: "Essai échoué" },
  { value: "declined", label: "Décliné" },
];

export const defaultDealPipelineStatuses = [
  "closed-won",
  "perdu",
  "trial-failed",
  "declined",
];

export const defaultDealCategories = [
  { value: "other", label: "Autre" },
  { value: "copywriting", label: "Rédaction" },
  { value: "print-project", label: "Impression" },
  { value: "ui-design", label: "Design UI" },
  { value: "website-design", label: "Site web" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Froid", color: "#7dbde8" },
  { value: "warm", label: "Tiède", color: "#e8cb7d" },
  { value: "hot", label: "Chaud", color: "#e88b7d" },
  { value: "in-contract", label: "Signé", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "Sans type" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Démo" },
  { value: "lunch", label: "Déjeuner" },
  { value: "meeting", label: "Réunion" },
  { value: "follow-up", label: "Suivi" },
  { value: "thank-you", label: "Remerciement" },
  { value: "ship", label: "Livraison" },
  { value: "call", label: "Appel" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
