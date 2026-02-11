import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Store } from "ra-core";

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
import {
  CONFIGURATION_STORE_KEY,
  mergeConfiguration,
  type StoredConfiguration,
} from "./storedConfiguration";

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
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
}

export interface ConfigurationProviderProps extends ConfigurationContextValue {
  children: ReactNode;
  store: Store;
}

// Create context with default value
// eslint-disable-next-line react-refresh/only-export-components
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
  disableEmailPasswordAuthentication: false,
});

const ConfigurationUpdaterContext = createContext<
  (config: StoredConfiguration) => void
>(() => {});

export const ConfigurationProvider = ({
  children,
  store,
  ...codeDefaults
}: ConfigurationProviderProps) => {
  const [localConfig, setLocalConfig] = useState<StoredConfiguration | null>(
    () => store.getItem<StoredConfiguration>(CONFIGURATION_STORE_KEY) ?? null,
  );

  // Subscribe to external store changes (e.g. config written during login)
  useEffect(() => {
    const unsubscribe = store.subscribe(
      CONFIGURATION_STORE_KEY,
      (value: StoredConfiguration) => {
        setLocalConfig(value);
      },
    );
    return unsubscribe;
  }, [store]);

  const value = useMemo(
    () => mergeConfiguration(codeDefaults, localConfig),
    [codeDefaults, localConfig],
  );

  const updateLocalConfig = useCallback(
    (config: StoredConfiguration) => {
      setLocalConfig(config);
      store.setItem(CONFIGURATION_STORE_KEY, config);
    },
    [store],
  );

  return (
    <ConfigurationUpdaterContext.Provider value={updateLocalConfig}>
      <ConfigurationContext.Provider value={value}>
        {children}
      </ConfigurationContext.Provider>
    </ConfigurationUpdaterContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfigurationContext = () => useContext(ConfigurationContext);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfigurationUpdater = () =>
  useContext(ConfigurationUpdaterContext);
