import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import { useConfigurationUpdater } from "./ConfigurationContext";
import type { StoredConfiguration } from "./storedConfiguration";

export const useConfigurationLoader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const updateConfiguration = useConfigurationUpdater();

  const { data } = useQuery<StoredConfiguration>({
    queryKey: ["configuration"],
    queryFn: () => dataProvider.getConfiguration(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (data) {
      updateConfiguration(data);
    }
  }, [data, updateConfiguration]);
};
