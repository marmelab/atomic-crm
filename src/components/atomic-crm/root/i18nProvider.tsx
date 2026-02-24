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
      at: "at",
      copied: "Copied!",
      copy: "Copy",
      loading: "Loading...",
      me: "Me",
    },
    navigation: {
      label: "CRM navigation",
    },
    companies: {
      name: "Company |||| Companies",
      forcedCaseName: "Company",
      action: {
        create: "Create Company",
        edit: "Edit company",
        new: "New Company",
        show: "Show company",
      },
      aside: {
        additional_info: "Additional info",
        company_info: "Company info",
        context: "Context",
        main_address: "Main address",
      },
      fields: {
        name: "Company name",
        revenue: "Revenue",
        sector: "Sector",
        size: "Size",
        tax_identifier: "Tax Identifier",
      },
      filters: {
        sector: "Sector",
        size: "Size",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
      action: {
        edit: "Edit contact",
        new: "New Contact",
        show: "Show contact",
      },
      background: {
        added_on: "Added on",
        followed_by: "Followed by",
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
      filters: {
        before_last_month: "Before last month",
        before_this_month: "Before this month",
        before_this_week: "Before this week",
        last_activity: "Last activity",
        managed_by_me: "Managed by me",
        search: "Search name, company...",
        status: "Status",
        tags: "Tags",
        this_week: "This week",
        today: "Today",
      },
      hot: {
        create: "Create contact",
        empty_change_status:
          'Change the status of a contact by adding a note to that contact and clicking on "show options".',
        empty_hint: 'Contacts with a "hot" status will appear here.',
        title: "Hot Contacts",
      },
    },
    deals: {
      name: "Deal |||| Deals",
      action: {
        create: "Create deal",
        new: "New Deal",
      },
      filters: {
        company: "Company",
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
      action: {
        add_this: "Add this note",
      },
      added: "Note added",
      inputs: {
        add_note: "Add a note",
        date: "Date",
        options_hint: "(attach files, or change details)",
        reference_contact: "Contact",
        reference_deal: "Deal",
        show_options: "Show options",
      },
    },
    sales: {
      name: "User |||| Users",
      action: {
        new: "New user",
      },
      fields: {
        admin: "Admin",
        disabled: "Disabled",
      },
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
      dialog: {
        color: "Color",
        name_label: "Tag name",
        name_placeholder: "Enter tag name",
      },
    },
    tasks: {
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
      fields: {
        description: "Description",
      },
      filters: {
        with_pending: "With pending tasks",
      },
    },
    profile: {
      inbound: {
        description_prefix:
          "You can start sending emails to your server's inbound email address, e.g. by adding it to the",
        description_suffix:
          "field. Atomic CRM will process the emails and add notes to the corresponding contacts.",
        title: "Inbound email",
      },
      password: {
        change: "Change password",
      },
      password_reset_sent:
        "A reset password email has been sent to your email address",
      title: "Profile",
      updated: "Your profile has been updated",
      update_error: "An error occurred. Please try again",
    },
  },
};

const frenchCrmMessages = {
  crm: {
    language: "Langue",
    common: {
      account_manager: "Responsable de compte",
      at: "chez",
      copied: "Copié !",
      copy: "Copier",
      loading: "Chargement...",
      me: "Moi",
    },
    navigation: {
      label: "Navigation CRM",
    },
    companies: {
      name: "Entreprise |||| Entreprises",
      forcedCaseName: "Entreprise",
      action: {
        create: "Créer une entreprise",
        edit: "Modifier l'entreprise",
        new: "Nouvelle entreprise",
        show: "Afficher l'entreprise",
      },
      aside: {
        additional_info: "Informations supplémentaires",
        company_info: "Informations de l'entreprise",
        context: "Contexte",
        main_address: "Adresse principale",
      },
      fields: {
        name: "Nom de l'entreprise",
        revenue: "Chiffre d'affaires",
        sector: "Secteur",
        size: "Taille",
        tax_identifier: "Identifiant fiscal",
      },
      filters: {
        sector: "Secteur",
        size: "Taille",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
      action: {
        edit: "Modifier le contact",
        new: "Nouveau contact",
        show: "Afficher le contact",
      },
      background: {
        added_on: "Ajouté le",
        followed_by: "Suivi par",
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
      filters: {
        before_last_month: "Avant le mois dernier",
        before_this_month: "Avant ce mois-ci",
        before_this_week: "Avant cette semaine",
        last_activity: "Dernière activité",
        managed_by_me: "Géré par moi",
        search: "Rechercher nom, entreprise...",
        status: "Statut",
        tags: "Étiquettes",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
      },
      hot: {
        create: "Créer un contact",
        empty_change_status:
          'Changez le statut d\'un contact en ajoutant une note à ce contact et en cliquant sur "afficher les options".',
        empty_hint: 'Les contacts avec un statut "chaud" apparaîtront ici.',
        title: "Contacts chauds",
      },
    },
    deals: {
      name: "Affaire |||| Affaires",
      action: {
        create: "Créer un deal",
        new: "Nouvelle affaire",
      },
      filters: {
        company: "Entreprise",
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
      action: {
        add_this: "Ajouter cette note",
      },
      added: "Note ajoutée",
      inputs: {
        add_note: "Ajouter une note",
        date: "Date",
        options_hint: "(joindre des fichiers ou modifier les détails)",
        reference_contact: "Contact",
        reference_deal: "Affaire",
        show_options: "Afficher les options",
      },
    },
    sales: {
      name: "Utilisateur |||| Utilisateurs",
      action: {
        new: "Nouvel utilisateur",
      },
      fields: {
        admin: "Admin",
        disabled: "Désactivé",
      },
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
      dialog: {
        color: "Couleur",
        name_label: "Nom de l'étiquette",
        name_placeholder: "Saisir le nom de l'étiquette",
      },
    },
    tasks: {
      name: "Tâche |||| Tâches",
      forcedCaseName: "Tâche",
      fields: {
        description: "Description",
      },
      filters: {
        with_pending: "Avec des tâches en attente",
      },
    },
    profile: {
      inbound: {
        description_prefix:
          "Vous pouvez commencer à envoyer des e-mails vers l'adresse de réception de votre serveur, par exemple en l'ajoutant au champ",
        description_suffix:
          "champ. Atomic CRM traitera les e-mails et ajoutera des notes aux contacts correspondants.",
        title: "E-mail entrant",
      },
      password: {
        change: "Changer le mot de passe",
      },
      password_reset_sent:
        "Un e-mail de réinitialisation du mot de passe a été envoyé à votre adresse e-mail",
      title: "Profil",
      updated: "Votre profil a été mis à jour",
      update_error: "Une erreur s'est produite. Veuillez réessayer",
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
