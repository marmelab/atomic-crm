import defaultMessages from "ra-language-english";
import polyglotI18nProvider from "ra-i18n-polyglot";
import type { TranslationMessages } from "ra-core";

// TODO: Move these messages to ra-core when available in the next minor release.
// Remove this override once ra-core ships built-in guesser translations.
const guesserMessages = {
  guesser: {
    empty: {
      title: "No data to display",
      message: "Please check your data provider",
    },
  },
};

export const i18nProvider = polyglotI18nProvider(
  () =>
    ({
      ...defaultMessages,
      ra: {
        ...defaultMessages.ra,
        ...guesserMessages,
      },
    }) as TranslationMessages,
  "en",
  [{ name: "en", value: "English" }],
  { allowMissing: true },
);
