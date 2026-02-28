import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { polishMessages } from "./polishMessages";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
    oauth: {
      no_request: "No authorization request found",
      approved: "Authorization Approved",
      close_tab: "You can now close this tab.",
      authorize: "Authorize Application",
      authorize_details: "This application wants to access your account",
      permissions: "Requested permissions",
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
);

const polishCatalog = mergeTranslations(englishCatalog, polishMessages);

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "pl") {
      return polishCatalog;
    }
    return englishCatalog;
  },
  "pl",
  [
    { locale: "pl", name: "Polski" },
    { locale: "en", name: "English" },
  ],
  { allowMissing: true },
);
