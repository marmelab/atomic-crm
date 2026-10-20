import { useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetIdentity,
  useLocales,
  useLocaleState,
  useNotify,
} from "ra-core";
import { useCallback } from "react";

import { useTheme } from "@/components/admin/use-theme";
import type { CrmDataProvider } from "../providers/types";
import type { UserPreferences } from "../types";
import { isOfferedLocale, PREFERENCES_QUERY_KEY } from "./preferences";

let pendingWrites: Promise<unknown> = Promise.resolve();
let pendingCount = 0;
let generation = 0;
let baseline: UserPreferences = {};
let writeCount = 0;
let latestWriteByKey: Partial<Record<keyof UserPreferences, number>> = {};

const PREFERENCE_KEYS = ["theme", "locale"] as const;

export const resetPendingPreferenceWrites = () => {
  generation += 1;
  pendingCount = 0;
  latestWriteByKey = {};
  pendingWrites = Promise.resolve();
};

export const hasPendingPreferenceWrites = () => pendingCount > 0;

const lastConfirmed = (
  stored: UserPreferences | undefined,
  locales: readonly { locale: string }[],
): UserPreferences => ({
  theme: stored?.theme ?? baseline.theme,
  locale: isOfferedLocale(stored?.locale, locales)
    ? stored.locale
    : baseline.locale,
});

export const usePersistPreference = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useLocaleState();
  const locales = useLocales();

  return useCallback(
    (patch: Partial<UserPreferences>) => {
      if (pendingCount === 0) baseline = { theme, locale };
      pendingCount += 1;
      writeCount += 1;
      const writeId = writeCount;
      const changedKeys = PREFERENCE_KEYS.filter(
        (key) => patch[key] !== undefined,
      );
      latestWriteByKey = {
        ...latestWriteByKey,
        ...Object.fromEntries(changedKeys.map((key) => [key, writeId])),
      };
      if (patch.theme !== undefined) setTheme(patch.theme);
      if (patch.locale !== undefined) setLocale(patch.locale);

      const identityId = identity?.id;
      const queryKey = [PREFERENCES_QUERY_KEY, identityId];
      const tracksCache = identityId !== undefined;
      const enqueuedAt = generation;
      const isCurrent = () => enqueuedAt === generation;

      const save = async () => {
        if (!isCurrent()) return;
        try {
          const preferences = await dataProvider.updatePreferences(patch);
          if (!isCurrent()) return;
          if (!tracksCache) {
            pendingCount -= 1;
            queryClient.invalidateQueries({
              queryKey: [PREFERENCES_QUERY_KEY],
            });
            return;
          }
          await queryClient.cancelQueries({ queryKey, exact: true });
          if (!isCurrent()) return;
          pendingCount -= 1;
          queryClient.setQueryData(queryKey, preferences);
        } catch {
          if (!isCurrent()) return;
          pendingCount -= 1;
          const keysToRevert = changedKeys.filter(
            (key) => latestWriteByKey[key] === writeId,
          );
          if (keysToRevert.length === 0) return;
          const confirmed = lastConfirmed(
            tracksCache
              ? queryClient.getQueryData<UserPreferences>(queryKey)
              : undefined,
            locales,
          );
          if (keysToRevert.includes("theme") && confirmed.theme) {
            setTheme(confirmed.theme);
          }
          if (keysToRevert.includes("locale") && confirmed.locale) {
            setLocale(confirmed.locale);
          }
          notify("crm.preferences.update_error", {
            type: "error",
            messageArgs: { _: "Could not save your preferences" },
          });
        }
      };

      pendingWrites = pendingWrites.catch(() => {}).then(save);
    },
    [
      dataProvider,
      identity?.id,
      queryClient,
      notify,
      theme,
      setTheme,
      locale,
      setLocale,
      locales,
    ],
  );
};
