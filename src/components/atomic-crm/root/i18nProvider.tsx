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
    profile: {
      title: "Profile",
    },
    common: {
      account_manager: "Account manager",
    },
    companies: {
      name: "Company |||| Companies",
      forcedCaseName: "Company",
      action: {
        create: "Create Company",
      },
      fields: {
        name: "Company name",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
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
        contacts_label: "contact |||| contacts",
      },
    },
    deals: {
      name: "Deal |||| Deals",
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
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
    },
    sales: {
      name: "User |||| Users",
    },
    settings: {
      title: "Settings",
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
    },
    tags: {
      name: "Tag |||| Tags",
    },
    tasks: {
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
    },
  },
};

const frenchCrmMessages = {
  crm: {
    language: "Langue",
    profile: {
      title: "Profil",
    },
    common: {
      account_manager: "Responsable de compte",
    },
    companies: {
      name: "Entreprise |||| Entreprises",
      forcedCaseName: "Entreprise",
      action: {
        create: "Créer une entreprise",
      },
      fields: {
        name: "Nom de l'entreprise",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
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
        contacts_label: "contact |||| contacts",
      },
    },
    deals: {
      name: "Affaire |||| Affaires",
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
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
    },
    sales: {
      name: "Utilisateur |||| Utilisateurs",
    },
    settings: {
      title: "Paramètres",
      app_title: "Titre de l'application",
      sections: {
        branding: "Image de marque",
      },
    },
    tags: {
      name: "Étiquette |||| Étiquettes",
    },
    tasks: {
      name: "Tâche |||| Tâches",
      forcedCaseName: "Tâche",
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
