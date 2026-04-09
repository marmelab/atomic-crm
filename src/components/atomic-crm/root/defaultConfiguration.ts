import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultCurrency = "EUR";

export const defaultTitle = "Tondix CRM";

export const defaultCompanySectors = [
  { value: "golf", label: "Golf" },
  { value: "collectivite", label: "Collectivité" },
  { value: "paysagiste", label: "Paysagiste" },
  { value: "camping-hotellerie", label: "Camping/Hôtellerie" },
  { value: "sports-loisirs", label: "Sports & Loisirs" },
  { value: "syndic-immobilier", label: "Syndic/Immobilier" },
];

export const defaultDealStages = [
  { value: "prospection", label: "Prospection" },
  { value: "demonstration", label: "Démonstration" },
  { value: "devis-envoye", label: "Devis envoyé" },
  { value: "negociation", label: "Négociation" },
  { value: "gagne", label: "Gagné" },
  { value: "perdu", label: "Perdu" },
];

export const defaultDealPipelineStatuses = ["gagne"];

export const defaultDealCategories = [
  { value: "tondeuse-thermique", label: "Tondeuse thermique" },
  { value: "tondeuse-electrique", label: "électrique" },
  { value: "robot-tondeuse", label: "Robot tondeuse" },
  { value: "autoportee", label: "Autoportée" },
  { value: "accessoires", label: "Accessoires" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "appel", label: "Appel" },
  { value: "demonstration", label: "Démonstration" },
  { value: "email", label: "Email" },
  { value: "devis", label: "Devis" },
  { value: "reunion", label: "Réunion" },
  { value: "relance", label: "Relance" },
  { value: "renouvellement-contrat", label: "Renouvellement contrat" },
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
