import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Nosho CRM";

export const defaultCompanySectors = [
  { value: "cabinet-liberal", label: "Cabinet libéral" },
  { value: "dentiste-orthodontiste", label: "Dentiste / Orthodontiste" },
  { value: "hopital-clinique", label: "Hôpital / Clinique" },
  { value: "radiologie-imagerie", label: "Radiologie / Imagerie" },
  { value: "centre-sante", label: "Centre de santé" },
  { value: "groupement-sante", label: "Groupement de santé" },
  { value: "editeur-logiciel", label: "Éditeur de logiciel" },
  { value: "integrateur-esn", label: "Intégrateur / ESN" },
  { value: "pharmacie", label: "Pharmacie" },
  { value: "centre-esthetique", label: "Centre esthétique" },
  { value: "autre", label: "Autre" },
];

export const defaultDealStages = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualifié" },
  { value: "follow-up", label: "Suivi" },
  { value: "rdv-prix", label: "Rendez-vous prix" },
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
  { value: "angiologue", label: "Angiologue" },
  { value: "api", label: "API" },
  { value: "cardiologue", label: "Cardiologue" },
  { value: "centre-dentaire", label: "Centre dentaire" },
  { value: "centre-esthetique", label: "Centre esthétique" },
  { value: "chirurgien", label: "Chirurgien" },
  { value: "dentiste", label: "Dentiste" },
  { value: "dermatologue", label: "Dermatologue" },
  { value: "entreprise", label: "Entreprise" },
  { value: "esthetique", label: "Esthétique" },
  { value: "groupement", label: "Groupement" },
  { value: "hopital", label: "Hôpital" },
  { value: "institut", label: "Institut" },
  { value: "maison-de-sante", label: "Maison de santé" },
  { value: "medecin", label: "Médecin" },
  { value: "nephrologue", label: "Néphrologue" },
  { value: "ophtalmo", label: "Ophtalmo" },
  { value: "orthodontiste", label: "Orthodontiste" },
  { value: "pediatre", label: "Pédiatre" },
  { value: "radiologie", label: "Radiologie" },
];

export const defaultCompanyTypes = [
  { value: "investisseur", label: "Investisseur" },
  { value: "partenaire", label: "Partenaire" },
  { value: "client", label: "Client" },
  { value: "prospect", label: "Prospect" },
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
  companyTypes: defaultCompanyTypes,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
