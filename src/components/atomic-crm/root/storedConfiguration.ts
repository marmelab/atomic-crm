import type { ContactGender, DealStage, NoteStatus } from "../types";
import type { ConfigurationContextValue } from "./ConfigurationContext";
import { genderIconRegistry } from "./iconRegistry";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface StoredContactGender {
  value: string;
  label: string;
  icon: string;
}

export interface StoredConfiguration {
  companySectors?: string[];
  dealCategories?: string[];
  dealPipelineStatuses?: string[];
  dealStages?: DealStage[];
  noteStatuses?: NoteStatus[];
  taskTypes?: string[];
  title?: string;
  darkModeLogo?: string;
  lightModeLogo?: string;
  contactGender?: StoredContactGender[];
}

export const hydrateContactGender = (
  stored: StoredContactGender[],
): ContactGender[] =>
  stored.map((g) => ({
    value: g.value,
    label: g.label,
    icon: genderIconRegistry[g.icon] ?? genderIconRegistry.User,
  }));

export const dehydrateContactGender = (
  genders: ContactGender[],
): StoredContactGender[] =>
  genders.map((g) => ({
    value: g.value,
    label: g.label,
    icon:
      Object.entries(genderIconRegistry).find(
        ([, component]) => component === g.icon,
      )?.[0] ?? "User",
  }));

export const mergeConfiguration = (
  codeDefaults: ConfigurationContextValue,
  dbConfig: StoredConfiguration | null,
): ConfigurationContextValue => {
  if (!dbConfig) return codeDefaults;

  return {
    ...codeDefaults,
    ...(dbConfig.companySectors && {
      companySectors: dbConfig.companySectors,
    }),
    ...(dbConfig.dealCategories && {
      dealCategories: dbConfig.dealCategories,
    }),
    ...(dbConfig.dealPipelineStatuses && {
      dealPipelineStatuses: dbConfig.dealPipelineStatuses,
    }),
    ...(dbConfig.dealStages && { dealStages: dbConfig.dealStages }),
    ...(dbConfig.noteStatuses && { noteStatuses: dbConfig.noteStatuses }),
    ...(dbConfig.taskTypes && { taskTypes: dbConfig.taskTypes }),
    ...(dbConfig.title && { title: dbConfig.title }),
    ...(dbConfig.darkModeLogo && { darkModeLogo: dbConfig.darkModeLogo }),
    ...(dbConfig.lightModeLogo && { lightModeLogo: dbConfig.lightModeLogo }),
    ...(dbConfig.contactGender && {
      contactGender: hydrateContactGender(dbConfig.contactGender),
    }),
  };
};
