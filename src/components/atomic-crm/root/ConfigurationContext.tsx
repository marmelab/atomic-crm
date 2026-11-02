import { useMemo } from "react";
import { useStore } from "ra-core";

import type { DealStage, LabeledValue, NoteStatus } from "../types";
import {
  defaultConfiguration,
  defaultDealStages,
} from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

/**
 * Legacy deal stage values replaced by the 2026 pipeline rework.
 *
 * When a previously saved configuration (React Admin store or the
 * `configuration` table) still references these, the whole stage list is
 * replaced by the new defaults. Admins can further customize the list in the
 * settings page.
 */
export const LEGACY_DEAL_STAGE_VALUES = [
  "opportunity",
  "proposal-sent",
  "in-negociation",
  "delayed",
];

const isLegacyDealStageList = (stages?: DealStage[]): boolean =>
  (stages ?? []).some((stage) =>
    LEGACY_DEAL_STAGE_VALUES.includes(stage.value),
  );

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
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );

  return useMemo(() => {
    const mergedConfig = {
      ...defaultConfiguration,
      ...config,
    };

    // Merge new defaults with previously saved custom industries.
    // Map prevents duplicate industry values.
    const sectors = new Map(
      defaultConfiguration.companySectors.map((sector) => [
        sector.value,
        sector,
      ]),
    );

    (config?.companySectors ?? []).forEach((sector) => {
      sectors.set(sector.value, sector);
    });

    // A saved configuration may still hold the pre-rework stage list
    // (opportunity / proposal-sent / in-negociation / delayed). The database
    // values were migrated, so replace the stale list with the new defaults.
    // Lists without legacy values are custom and left untouched.
    if (isLegacyDealStageList(mergedConfig.dealStages ?? [])) {
      mergedConfig.dealStages = [
        ...defaultDealStages.map((stage) => ({ ...stage })),
      ];
    }

    return {
      ...mergedConfig,
      companySectors: Array.from(sectors.values()),
    };
  }, [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
