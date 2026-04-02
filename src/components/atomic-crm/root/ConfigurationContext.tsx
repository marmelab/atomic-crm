import { useMemo } from "react";
import { useStore } from "ra-core";

import type {
  AIConfig,
  BusinessProfile,
  FiscalConfig,
  LabeledValue,
  NoteStatus,
  OperationalConfig,
} from "../types";
import { getFirstValidFiscalTaxProfileAtecoCode } from "@/lib/fiscalConfig";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  quoteServiceTypes: LabeledValue[];
  serviceTypeChoices: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
  fiscalConfig?: FiscalConfig;
  aiConfig?: AIConfig;
  operationalConfig?: OperationalConfig;
  businessProfile?: BusinessProfile;
}

type PartialConfigurationContextValue = Partial<ConfigurationContextValue> & {
  fiscalConfig?: Partial<FiscalConfig>;
  aiConfig?: Partial<AIConfig>;
  operationalConfig?: Partial<OperationalConfig>;
  businessProfile?: Partial<BusinessProfile>;
};

export const mergeConfigurationWithDefaults = (
  config?: PartialConfigurationContextValue,
): ConfigurationContextValue => {
  const mergedFiscalConfig: FiscalConfig = {
    ...defaultConfiguration.fiscalConfig,
    ...config?.fiscalConfig,
    taxabilityDefaults: {
      ...defaultConfiguration.fiscalConfig.taxabilityDefaults,
      ...config?.fiscalConfig?.taxabilityDefaults,
    },
    defaultTaxProfileAtecoCode:
      config?.fiscalConfig &&
      Object.prototype.hasOwnProperty.call(
        config.fiscalConfig,
        "defaultTaxProfileAtecoCode",
      )
        ? (config.fiscalConfig.defaultTaxProfileAtecoCode ??
          defaultConfiguration.fiscalConfig.defaultTaxProfileAtecoCode)
        : (getFirstValidFiscalTaxProfileAtecoCode(
            config?.fiscalConfig?.taxProfiles ??
              defaultConfiguration.fiscalConfig.taxProfiles,
          ) ?? defaultConfiguration.fiscalConfig.defaultTaxProfileAtecoCode),
  };

  return {
    ...defaultConfiguration,
    ...config,
    fiscalConfig: mergedFiscalConfig,
    aiConfig: {
      ...defaultConfiguration.aiConfig,
      ...config?.aiConfig,
    },
    operationalConfig: {
      ...defaultConfiguration.operationalConfig,
      ...config?.operationalConfig,
    },
    businessProfile: {
      ...defaultConfiguration.businessProfile,
      ...config?.businessProfile,
    },
  };
};

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  return useMemo(() => mergeConfigurationWithDefaults(config), [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
