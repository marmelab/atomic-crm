import type { DataProvider } from "ra-core";

import type { ConfigurationContextValue } from "../root/ConfigurationContext";

export type CrmDataProvider = DataProvider & {
  getConfiguration: () => Promise<ConfigurationContextValue>;
  isInitialized: () => Promise<boolean>;
};
