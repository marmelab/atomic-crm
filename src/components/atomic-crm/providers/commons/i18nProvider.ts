import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { englishCrmMessages } from "./englishCrmMessages";
import { ukrainianCrmMessages } from "./ukrainianCrmMessages";
import { ukrainianRaMessages } from "./ukrainianRaMessages";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
    oauth: {
      authorize: "Authorize Application",
      authorize_details: "This application wants to access your account.",
      access_scope:
        "It will be able to read and modify your data, with the same permissions as your account.",
      approved: "Authorization Approved",
      close_tab: "You can now close this tab.",
      no_request: "No authorization request found",
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
  englishCrmMessages,
);

// English is the base: a key missing in Ukrainian falls back to English
const ukrainianCatalog = mergeTranslations(
  englishCatalog,
  ukrainianRaMessages,
  ukrainianCrmMessages,
);

export const SUPPORTED_LOCALES = ["uk", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** The interface language for a language code: Ukrainian, else English. */
export const toSupportedLocale = (language?: string | null): SupportedLocale =>
  language?.toLowerCase().startsWith("en") ? "en" : "uk";

/** The interface language for a business country pack: Ukrainian for
 * Ukraine, English for the countries without a translation yet (Poland). */
export const businessLocale = (language: string): SupportedLocale =>
  language === "uk" ? "uk" : "en";

/**
 * Ukrainian by default (the product starts in Ukraine); English when the
 * browser asks for English. Once a business exists, its country decides
 * (see useBusinessLocale), unless the person chose a language themselves.
 */
export const getInitialLocale = (): SupportedLocale => {
  if (typeof navigator === "undefined") {
    return "uk";
  }
  return toSupportedLocale(navigator.languages?.[0] ?? navigator.language);
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => (locale === "en" ? englishCatalog : ukrainianCatalog),
  getInitialLocale(),
  [
    { locale: "uk", name: "Українська" },
    { locale: "en", name: "English" },
  ],
  { allowMissing: true },
);

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);
