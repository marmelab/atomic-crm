import { useMemo } from "react";
import { useLocaleState, useStore } from "ra-core";

import type { DealStage, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";
import { ukrainianDefaultConfiguration } from "./ukrainianDefaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  /** Base currency of the current business (ISO 4217) */
  currency: string;
  /** Formats of dates, numbers and money of the current business, e.g. uk-UA */
  locale: string;
  /** Country of the current business (ISO 3166-1 alpha-2), null without one */
  countryCode: string | null;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  const [locale] = useLocaleState();
  // Merge with defaults so that missing fields in stored config fall back to
  // default values (e.g. when new settings are added), labelled in the
  // interface language
  return useMemo(
    () => ({
      ...(locale === "uk"
        ? ukrainianDefaultConfiguration
        : defaultConfiguration),
      ...withoutPropDefaults(config),
    }),
    [config, locale],
  );
};

// CRM.tsx seeds the store with its (English) prop defaults before the
// business configuration loads; those must not hide the localized defaults.
const withoutPropDefaults = (
  config: ConfigurationContextValue,
): Partial<ConfigurationContextValue> =>
  Object.fromEntries(
    Object.entries(config ?? {}).filter(
      ([key, value]) =>
        // compared by content: the store persists it as JSON
        JSON.stringify(value) !==
        JSON.stringify(
          defaultConfiguration[key as keyof ConfigurationContextValue],
        ),
    ),
  );

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
