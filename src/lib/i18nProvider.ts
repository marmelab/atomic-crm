import defaultMessages from "ra-language-farsi";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import farsiTranslations from "./farsiTranslations";
import { TranslationMessages } from "ra-core";

const messages: Record<string, TranslationMessages> = {
  fa: { ...defaultMessages, ...farsiTranslations },
  en: englishMessages,
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => messages[locale] || messages.fa,
  "fa",
  [
    { name: "fa", value: "فارسی" },
    { name: "en", value: "English" },
  ],
  { allowMissing: true },
);
