import { useMemo } from "react";
import { useStore } from "ra-core";

import type {
  AIConfig,
  FiscalConfig,
  LabeledValue,
  NoteStatus,
  OperationalConfig,
} from "../types";
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
}

type PartialConfigurationContextValue = Partial<ConfigurationContextValue> & {
  fiscalConfig?: Partial<FiscalConfig>;
  aiConfig?: Partial<AIConfig>;
  operationalConfig?: Partial<OperationalConfig>;
};

export const mergeConfigurationWithDefaults = (
  config?: PartialConfigurationContextValue,
): ConfigurationContextValue => ({
  ...defaultConfiguration,
  ...config,
  fiscalConfig: {
    ...defaultConfiguration.fiscalConfig,
    ...config?.fiscalConfig,
    taxabilityDefaults: {
      ...defaultConfiguration.fiscalConfig.taxabilityDefaults,
      ...config?.fiscalConfig?.taxabilityDefaults,
    },
  },
  aiConfig: {
    ...defaultConfiguration.aiConfig,
    ...config?.aiConfig,
  },
  operationalConfig: {
    ...defaultConfiguration.operationalConfig,
    ...config?.operationalConfig,
  },
});

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
