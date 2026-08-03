import { z } from "zod";

import type { UserPreferences } from "../types";

export const PREFERENCES_QUERY_KEY = "preferences";

export const PREFERENCES_STALE_TIME_MS = 5 * 60 * 1000;

const themeSchema = z.enum(["light", "dark", "system"]);

const localeSchema = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

export const parseUserPreferences = (value: unknown): UserPreferences => {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;

  const theme = themeSchema.safeParse(source.theme);
  const locale = localeSchema.safeParse(source.locale);

  return {
    ...(theme.success ? { theme: theme.data } : {}),
    ...(locale.success ? { locale: locale.data } : {}),
  };
};

export const isOfferedLocale = (
  locale: string | undefined,
  offered: readonly { locale: string }[],
): locale is string =>
  !!locale &&
  (offered.length === 0 || offered.some((one) => one.locale === locale));
