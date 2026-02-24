import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { raSupabaseFrenchMessages } from "ra-supabase-language-french";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
  },
};

const raSupabaseFrenchMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset:
        "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    },
  },
};

const englishCrmMessages = {
  crm: {
    language: "Language",
    common: {
      account_manager: "Account manager",
    },
    companies: {
      action: {
        create: "Create Company",
      },
    },
    contacts: {
      action: {
        new: "New Contact",
      },
      inputs: {
        email_addresses: "Email addresses",
        phone_numbers: "Phone numbers",
        linkedin_url: "LinkedIn URL",
        background_info: "Background info (bio, how you met, etc)",
      },
      import: {
        csv_file: "CSV File",
      },
    },
    deals: {
      action: {
        create: "Create deal",
      },
      inputs: {
        name: "Deal name",
        contacts: "Contacts",
        category: "Category",
      },
      fields: {
        description: "Description",
      },
    },
    settings: {
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
    },
  },
};

const frenchCrmMessages = {
  crm: {
    language: "Langue",
    common: {
      account_manager: "Responsable de compte",
    },
    companies: {
      action: {
        create: "Créer une entreprise",
      },
    },
    contacts: {
      action: {
        new: "Nouveau contact",
      },
      inputs: {
        email_addresses: "Adresses e-mail",
        phone_numbers: "Numéros de téléphone",
        linkedin_url: "URL LinkedIn",
        background_info:
          "Informations de contexte (bio, comment vous vous êtes rencontrés, etc.)",
      },
      import: {
        csv_file: "Fichier CSV",
      },
    },
    deals: {
      action: {
        create: "Créer un deal",
      },
      inputs: {
        name: "Nom du deal",
        contacts: "Contacts",
        category: "Catégorie",
      },
      fields: {
        description: "Description",
      },
    },
    settings: {
      app_title: "Titre de l'application",
      sections: {
        branding: "Image de marque",
      },
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
  englishCrmMessages,
);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  raSupabaseFrenchMessages,
  raSupabaseFrenchMessagesOverride,
  frenchCrmMessages,
);

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    return englishCatalog;
  },
  "en",
  [
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);
