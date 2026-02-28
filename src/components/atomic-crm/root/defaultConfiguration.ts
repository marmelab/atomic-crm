import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Atomic CRM";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Usługi komunikacyjne" },
  { value: "consumer-discretionary", label: "Dobra konsumpcyjne (cykliczne)" },
  { value: "consumer-staples", label: "Dobra konsumpcyjne (podstawowe)" },
  { value: "energy", label: "Energetyka" },
  { value: "financials", label: "Finanse" },
  { value: "health-care", label: "Ochrona zdrowia" },
  { value: "industrials", label: "Przemysł" },
  { value: "information-technology", label: "Technologie informacyjne" },
  { value: "materials", label: "Materiały" },
  { value: "real-estate", label: "Nieruchomości" },
  { value: "utilities", label: "Usługi komunalne" },
];

export const defaultDealStages = [
  { value: "opportunity", label: "Szansa" },
  { value: "proposal-sent", label: "Wysłana oferta" },
  { value: "in-negociation", label: "Negocjacje" },
  { value: "won", label: "Wygrana" },
  { value: "lost", label: "Przegrana" },
  { value: "delayed", label: "Wstrzymana" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "other", label: "Inne" },
  { value: "copywriting", label: "Copywriting" },
  { value: "print-project", label: "Projekt drukowany" },
  { value: "ui-design", label: "Projekt UI" },
  { value: "website-design", label: "Projekt strony WWW" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Zimny", color: "#7dbde8" },
  { value: "warm", label: "Ciepły", color: "#e8cb7d" },
  { value: "hot", label: "Gorący", color: "#e88b7d" },
  { value: "in-contract", label: "W kontrakcie", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "Brak" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Demo" },
  { value: "lunch", label: "Lunch" },
  { value: "meeting", label: "Spotkanie" },
  { value: "follow-up", label: "Follow-up" },
  { value: "thank-you", label: "Podziękowanie" },
  { value: "ship", label: "Wysyłka" },
  { value: "call", label: "Telefon" },
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
