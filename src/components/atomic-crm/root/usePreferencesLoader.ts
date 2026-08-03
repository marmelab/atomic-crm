import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useLocales, useStore } from "ra-core";
import { useEffect } from "react";

import type { Theme } from "@/components/admin/theme-context";
import type { CrmDataProvider } from "../providers/types";
import type { UserPreferences } from "../types";
import {
  isOfferedLocale,
  PREFERENCES_QUERY_KEY,
  PREFERENCES_STALE_TIME_MS,
} from "./preferences";

export const usePreferencesLoader = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const locales = useLocales();
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
    if (isOfferedLocale(data.locale, locales)) setLocale(data.locale);
  }, [data, locales, setTheme, setLocale]);
};
