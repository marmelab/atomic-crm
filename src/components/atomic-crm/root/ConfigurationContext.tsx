import { createContext, useContext, type ReactNode } from "react";

import type { ContactGender, DealStage, NoteStatus } from "../types";
import {
  defaultCompanySectors,
  defaultContactGender,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";

// Define types for the context value
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
}

export interface ConfigurationProviderProps extends ConfigurationContextValue {
  children: ReactNode;
}

// Create context with default value
export const ConfigurationContext = createContext<ConfigurationContextValue>({
  companySectors: defaultCompanySectors,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  contactGender: defaultContactGender,
});

export const ConfigurationProvider = ({
  children,
  companySectors,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  darkModeLogo,
  lightModeLogo,
  noteStatuses,
  taskTypes,
  title,
  contactGender,
}: ConfigurationProviderProps) => (
  <ConfigurationContext.Provider
    value={{
      companySectors,
      dealCategories,
      dealPipelineStatuses,
      dealStages,
      darkModeLogo,
      lightModeLogo,
      noteStatuses,
      title,
      taskTypes,
      contactGender,
    }}
  >
    {children}
  </ConfigurationContext.Provider>
);

export const useConfigurationContext = () => useContext(ConfigurationContext);
