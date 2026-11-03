import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetIdentity,
  useLocales,
  useNotify,
  useStore,
  useStoreContext,
} from "ra-core";
import { useEffect } from "react";

import type { Theme } from "@/components/admin/theme-context";
import type { CrmDataProvider } from "../providers/types";
import type { UserPreferences } from "../types";
import { isOfferedLocale, PREFERENCES_QUERY_KEY } from "./preferences";

export const usePreferencesSync = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const store = useStoreContext();
  const notify = useNotify();
  const locales = useLocales();
  const { identity } = useGetIdentity();
  const [theme] = useStore<Theme>("theme");
  const [locale] = useStore<string>("locale");
  const queryKey = [PREFERENCES_QUERY_KEY, identity?.id];

  const { data: synced } = useQuery<UserPreferences>({
    queryKey,
    queryFn: async () => {
      try {
        const preferences = await dataProvider.getPreferences();
        if (preferences.theme) store.setItem("theme", preferences.theme);
        if (isOfferedLocale(preferences.locale, locales)) {
          store.setItem("locale", preferences.locale);
        }
        return preferences;
      } catch {
        return {
          theme: store.getItem<Theme>("theme"),
          locale: store.getItem<string>("locale"),
        };
      }
    },
    enabled: identity !== undefined,
    staleTime: Infinity,
    meta: { persist: false },
  });

  const { mutate } = useMutation({
    mutationFn: (patch: Partial<UserPreferences>) =>
      dataProvider.updatePreferences(patch),
    onSuccess: (preferences) => queryClient.setQueryData(queryKey, preferences),
    onError: (_error, patch) => {
      queryClient.setQueryData<UserPreferences>(queryKey, (previous) => ({
        ...previous,
        ...patch,
      }));
      notify("crm.preferences.update_error", {
        type: "error",
        messageArgs: { _: "Could not save your preferences" },
      });
    },
  });

  useEffect(() => {
    if (!synced) return;
    const patch: Partial<UserPreferences> = {
      ...(theme && theme !== synced.theme ? { theme } : {}),
      ...(locale && locale !== synced.locale ? { locale } : {}),
    };
    if (Object.keys(patch).length > 0) mutate(patch);
  }, [synced, theme, locale, mutate]);
};
