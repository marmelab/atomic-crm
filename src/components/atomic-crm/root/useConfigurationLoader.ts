import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import {
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "./ConfigurationContext";

export const useConfigurationLoader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const updateConfiguration = useConfigurationUpdater();

  const { data } = useQuery<ConfigurationContextValue>({
    queryKey: ["configuration"],
    queryFn: () => dataProvider.getConfiguration(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      updateConfiguration(data);
    }
  }, [data, updateConfiguration]);
};
