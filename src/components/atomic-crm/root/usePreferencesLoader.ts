import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useStore } from "ra-core";
import { useEffect } from "react";

import type { Theme } from "@/components/admin/theme-context";
import type { CrmDataProvider } from "../providers/types";
import type { UserPreferences } from "../types";
import {
  PREFERENCES_QUERY_KEY,
  PREFERENCES_STALE_TIME_MS,
} from "./preferences";

export const usePreferencesLoader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const [, setTheme] = useStore<Theme>("theme");
  const [, setLocale] = useStore<string>("locale");

  const { data } = useQuery<UserPreferences>({
    queryKey: [PREFERENCES_QUERY_KEY, identity?.id],
    queryFn: () => dataProvider.getPreferences(),
    enabled: !!identity,
    staleTime: PREFERENCES_STALE_TIME_MS,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    if (data.theme) setTheme(data.theme);
    if (data.locale) setLocale(data.locale);
  }, [data, setTheme, setLocale]);
};
