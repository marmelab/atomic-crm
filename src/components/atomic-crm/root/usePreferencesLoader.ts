import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDataProvider, useStore } from "ra-core";

import type { CrmDataProvider } from "../providers/types";

export const usePreferencesLoader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [, setTheme] = useStore<string>("theme");
  const [, setLocale] = useStore<string>("locale");

  const { data } = useQuery<Record<string, string>>({
    queryKey: ["preferences"],
    queryFn: () => dataProvider.getPreferences(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  useEffect(() => {
    if (data) {
      if (data.theme) setTheme(data.theme);
      if (data.locale) setLocale(data.locale);
    }
  }, [data, setTheme, setLocale]);
};
