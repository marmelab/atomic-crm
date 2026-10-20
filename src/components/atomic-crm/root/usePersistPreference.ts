import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
  type Identifier,
  useDataProvider,
  useGetIdentity,
  useLocales,
  useLocaleState,
  useNotify,
} from "ra-core";
import { useCallback, useEffect, useRef } from "react";

import type { Theme } from "@/components/admin/theme-context";
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

type PreferenceWrite = {
  patch: Partial<UserPreferences>;
  changedKeys: (keyof UserPreferences)[];
  writeId: number;
  enqueuedAt: number;
};

type SaveContext = {
  dataProvider: CrmDataProvider;
  queryClient: QueryClient;
  notify: ReturnType<typeof useNotify>;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: string) => void;
  locales: readonly { locale: string }[];
  getIdentityId: () => Identifier | undefined;
};

const startWrite = (
  patch: Partial<UserPreferences>,
  displayed: UserPreferences,
): PreferenceWrite => {
  if (pendingCount === 0) baseline = displayed;
  pendingCount += 1;
  writeCount += 1;
  const write: PreferenceWrite = {
    patch,
    changedKeys: PREFERENCE_KEYS.filter((key) => patch[key] !== undefined),
    writeId: writeCount,
    enqueuedAt: generation,
  };
  latestWriteByKey = {
    ...latestWriteByKey,
    ...Object.fromEntries(write.changedKeys.map((key) => [key, write.writeId])),
  };
  return write;
};

const applyConfirmedWhenSettled = (context: SaveContext) => {
  const { queryClient, locales, setTheme, setLocale } = context;
  const identityId = context.getIdentityId();
  if (identityId === undefined || pendingCount > 0) return;
  const stored = queryClient.getQueryData<UserPreferences>([
    PREFERENCES_QUERY_KEY,
    identityId,
  ]);
  if (stored?.theme) setTheme(stored.theme);
  if (isOfferedLocale(stored?.locale, locales)) setLocale(stored.locale);
};

const revertFailedWrite = (write: PreferenceWrite, context: SaveContext) => {
  const { queryClient, locales, setTheme, setLocale } = context;
  const identityId = context.getIdentityId();
  const keysToRevert = write.changedKeys.filter(
    (key) => latestWriteByKey[key] === write.writeId,
  );
  if (keysToRevert.length === 0) return;
  const confirmed = lastConfirmed(
    identityId !== undefined
      ? queryClient.getQueryData<UserPreferences>([
          PREFERENCES_QUERY_KEY,
          identityId,
        ])
      : undefined,
    locales,
  );
  if (keysToRevert.includes("theme") && confirmed.theme) {
    setTheme(confirmed.theme);
  }
  if (keysToRevert.includes("locale") && confirmed.locale) {
    setLocale(confirmed.locale);
  }
  context.notify("crm.preferences.update_error", {
    type: "error",
    messageArgs: { _: "Could not save your preferences" },
  });
};

const savePreferenceWrite = async (
  write: PreferenceWrite,
  context: SaveContext,
) => {
  const { dataProvider, queryClient } = context;
  const isCurrent = () => write.enqueuedAt === generation;
  if (!isCurrent()) return;
  try {
    const preferences = await dataProvider.updatePreferences(write.patch);
    if (!isCurrent()) return;
    const identityId = context.getIdentityId();
    if (identityId === undefined) {
      pendingCount -= 1;
      return;
    }
    const queryKey = [PREFERENCES_QUERY_KEY, identityId];
    await queryClient.cancelQueries({ queryKey, exact: true });
    if (!isCurrent()) return;
    pendingCount -= 1;
    queryClient.setQueryData(queryKey, preferences);
    applyConfirmedWhenSettled(context);
  } catch {
    if (!isCurrent()) return;
    pendingCount -= 1;
    applyConfirmedWhenSettled(context);
    revertFailedWrite(write, context);
  }
};

export const usePersistPreference = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useLocaleState();
  const locales = useLocales();
  const identityIdRef = useRef(identity?.id);
  useEffect(() => {
    identityIdRef.current = identity?.id;
  }, [identity?.id]);

  return useCallback(
    (patch: Partial<UserPreferences>) => {
      const write = startWrite(patch, { theme, locale });
      if (patch.theme !== undefined) setTheme(patch.theme);
      if (patch.locale !== undefined) setLocale(patch.locale);

      const context: SaveContext = {
        dataProvider,
        queryClient,
        notify,
        setTheme,
        setLocale,
        locales,
        getIdentityId: () => identityIdRef.current,
      };
      pendingWrites = pendingWrites
        .catch(() => {})
        .then(() => savePreferenceWrite(write, context));
    },
    [
      dataProvider,
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
