import { useCallback, useMemo } from "react";
import { useStore } from "ra-core";

import type { DealStage, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface CustomView {
  id: string;
  label: string;
  companyType: string;
  visibleStages?: string[];
  /** Sales IDs allowed to see this view. undefined or [] = all users. */
  allowedUserIds?: number[];
}

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  companyTypes: LabeledValue[];
  customViews: CustomView[];
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
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => ({ ...defaultConfiguration, ...config }), [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};

/**
 * Hook to read/write only the `customViews` field in the store.
 * Uses the raw stored config (not merged with defaults) to avoid
 * creating new references for unrelated fields (companySectors, dealStages…)
 * which would cause SettingsForm's defaultValues to change and reset the form.
 */
export const useCustomViewsStore = (): [
  CustomView[],
  (views: CustomView[]) => void,
] => {
  const [storedConfig, setStoredConfig] = useStore<
    Partial<ConfigurationContextValue>
  >(CONFIGURATION_STORE_KEY, {});
  const setCustomViews = useCallback(
    (views: CustomView[]) => {
      setStoredConfig({ ...storedConfig, customViews: views });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedConfig],
  );
  return [
    storedConfig.customViews ?? defaultConfiguration.customViews,
    setCustomViews,
  ];
};
