import { useStore } from "ra-core";

import type { ContactGender, DealStage, NoteStatus } from "../types";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: string[];
  dealCategories: string[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: string[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  contactGender: ContactGender[];
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(CONFIGURATION_STORE_KEY);
  return config;
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
