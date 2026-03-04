import type {
  AIConfig,
  BusinessProfile,
  FiscalConfig,
  OperationalConfig,
} from "../types";
import type { ConfigurationContextValue } from "./ConfigurationContext";
import { defaultHistoricalAnalysisModel } from "@/lib/analytics/historicalAnalysis";
import { defaultInvoiceExtractionModel } from "@/lib/ai/invoiceExtractionModel";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultTitle = "Gestionale Rosario Furnari";

export const defaultNoteStatuses = [
  { value: "cold", label: "Freddo", color: "#7dbde8" },
  { value: "warm", label: "Tiepido", color: "#e8cb7d" },
  { value: "hot", label: "Caldo", color: "#e88b7d" },
  { value: "in-contract", label: "In contratto", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "Nessuno" },
  { value: "email", label: "Email" },
  { value: "call", label: "Chiamata" },
  { value: "meeting", label: "Riunione" },
  { value: "follow-up", label: "Follow-up" },
  { value: "reminder", label: "Promemoria" },
];

export const defaultQuoteServiceTypes = [
  {
    value: "wedding",
    label: "Wedding",
    description: "Preventivo per matrimonio o servizio wedding.",
  },
  {
    value: "battesimo",
    label: "Battesimo",
    description: "Preventivo per battesimo o ricorrenza familiare simile.",
  },
  {
    value: "compleanno",
    label: "Compleanno",
    description: "Preventivo per compleanni, feste private o eventi piccoli.",
  },
  {
    value: "evento",
    label: "Evento",
    description: "Preventivo per evento generico non wedding e non TV.",
  },
  {
    value: "produzione_tv",
    label: "Produzione TV",
    description: "Preventivo per produzioni televisive o format editoriali.",
  },
  {
    value: "videoclip",
    label: "Videoclip",
    description: "Preventivo per videoclip musicali o contenuti assimilabili.",
  },
  {
    value: "documentario",
    label: "Documentario",
    description: "Preventivo per documentari, racconti o reportage.",
  },
  {
    value: "spot",
    label: "Spot",
    description: "Preventivo per spot, promo o contenuti advertising.",
  },
  {
    value: "sito_web",
    label: "Sito Web",
    description: "Preventivo per sviluppo web o consegna di sito.",
  },
];

export const defaultServiceTypeChoices = [
  {
    value: "riprese",
    label: "Riprese",
    description: "Esecuzione sul campo: video, camera, set o giornata riprese.",
  },
  {
    value: "montaggio",
    label: "Montaggio",
    description: "Post-produzione, editing o rifinitura del materiale.",
  },
  {
    value: "riprese_montaggio",
    label: "Riprese + Montaggio",
    description:
      "Servizio completo che comprende produzione e post-produzione.",
  },
  {
    value: "fotografia",
    label: "Fotografia",
    description: "Servizio fotografico o shooting non video.",
  },
  {
    value: "sviluppo_web",
    label: "Sviluppo Web",
    description: "Lavoro tecnico di sviluppo, revisione o consegna web.",
  },
  {
    value: "altro",
    label: "Altro",
    description: "Prestazione che non rientra chiaramente negli altri tipi.",
  },
];

export const defaultFiscalConfig: FiscalConfig = {
  taxProfiles: [
    {
      atecoCode: "731102",
      description: "Marketing e servizi pubblicitari",
      coefficienteReddititivita: 78,
      linkedCategories: ["produzione_tv", "spot", "wedding", "evento_privato"],
    },
    {
      atecoCode: "621000",
      description: "Produzione software e consulenza IT",
      coefficienteReddititivita: 67,
      linkedCategories: ["sviluppo_web"],
    },
  ],
  aliquotaINPS: 26.07,
  tettoFatturato: 85000,
  annoInizioAttivita: 2023,
  taxabilityDefaults: {
    nonTaxableCategories: [],
    nonTaxableClientIds: [],
  },
};

export const defaultAIConfig: AIConfig = {
  historicalAnalysisModel: defaultHistoricalAnalysisModel,
  invoiceExtractionModel: defaultInvoiceExtractionModel,
};

export const defaultOperationalConfig: OperationalConfig = {
  defaultKmRate: 0.19,
};

export const defaultBusinessProfile: BusinessProfile = {
  name: "Rosario Furnari",
  tagline: "Videomaker · Fotografo · Web Developer",
  vatNumber: "01309870861",
  fiscalCode: "FRNRRD87A11G580E",
  address: "Via Calabria 13, 94019 Valguarnera Caropepe EN",
  email: "rosariodavide.furnari@gmail.com",
  phone: "3286183554",
};

export const defaultConfiguration: ConfigurationContextValue = {
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  quoteServiceTypes: defaultQuoteServiceTypes,
  serviceTypeChoices: defaultServiceTypeChoices,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  fiscalConfig: defaultFiscalConfig,
  aiConfig: defaultAIConfig,
  operationalConfig: defaultOperationalConfig,
  businessProfile: defaultBusinessProfile,
};
