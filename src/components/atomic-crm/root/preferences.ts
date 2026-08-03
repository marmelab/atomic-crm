import { z } from "zod";

import type { UserPreferences } from "../types";

export const PREFERENCES_QUERY_KEY = "preferences";

export const PREFERENCES_STALE_TIME_MS = 5 * 60 * 1000;

const themeSchema = z.enum(["light", "dark", "system"]);

const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Za-z]{2})?$/);

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
