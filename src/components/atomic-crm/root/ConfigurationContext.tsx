import { useMemo } from "react";
import { useStore } from "ra-core";

import type {
  DealStage,
  LabeledValue,
  NoteStatus,
  UpsellOffer,
} from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface SellerCompanyInfo {
  companyName: string;
  orgNumber: string;
  vatNumber: string;
  fSkatt: boolean;
  address: string;
  zipcode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  bankgiro: string;
  plusgiro: string;
  iban: string;
  bic: string;
  defaultPaymentTerms: string;
  defaultDeliveryTerms: string;
  defaultTermsAndConditions: string;
  quoteLogo: string;
}

export interface RevenueGoal {
  label: string;
  amount: number;
  period: "weekly" | "monthly" | "quarterly" | "yearly";
}

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  currency: string;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
  sellerCompany: SellerCompanyInfo;
  proposalKbTemplate: string;
  revenueGoals: RevenueGoal[];
  /** Upsell-katalog för månadsrapporten (utan pris). */
  monthlyReport?: { upsellCatalog: UpsellOffer[] };
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => {
    const merged = { ...defaultConfiguration, ...config };

    if (merged.title === "Atomic CRM") {
      merged.title = defaultConfiguration.title;
    }
    if (merged.darkModeLogo?.includes("logo_atomic_crm")) {
      merged.darkModeLogo = defaultConfiguration.darkModeLogo;
    }
    if (merged.lightModeLogo?.includes("logo_atomic_crm")) {
      merged.lightModeLogo = defaultConfiguration.lightModeLogo;
    }

    return merged;
  }, [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
