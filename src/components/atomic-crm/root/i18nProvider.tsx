import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";

// Override Supabase auth messages in French
const raSupabaseFrenchMessages = {
  "ra-supabase": {
    auth: {
      sign_in_with: "Se connecter avec %{provider}",
      password_reset:
        "Vérifiez vos emails pour un lien de réinitialisation du mot de passe.",
      confirm_magic_link: "Vérifiez vos emails pour un lien de connexion.",
      email: "Email",
      password: "Mot de passe",
    },
  },
};

// Custom application messages in French
export const customFrenchMessages = {
  crm: {
    // Navigation
    nav: {
      dashboard: "Tableau de bord",
      contacts: "Contacts",
      companies: "Sociétés",
      deals: "Opportunités",
      tasks: "Tâches",
      home: "Accueil",
    },
    // User menu
    menu: {
      profile: "Profil",
      settings: "Paramètres",
      users: "Utilisateurs",
      import: "Importer",
    },
    // Contact form
    contact: {
      identity: "Identité",
      position: "Poste",
      personal_info: "Infos personnelles",
      misc: "Divers",
      email_addresses: "Adresses email",
      phone_numbers: "Téléphones",
      background: "Notes contextuelles (bio, contexte de rencontre…)",
      account_manager: "Responsable commercial",
      linkedin_url: "URL LinkedIn",
      gender: {
        male: "Homme",
        female: "Femme",
        nonbinary: "Autre",
      },
    },
    // Deal form
    deal: {
      name: "Nom de l'opportunité",
      linked_to: "Lié à",
      misc: "Divers",
      category: "Catégorie",
    },
    // Note form
    note: {
      placeholder: "Ajouter une note…",
      show_options: "Options avancées",
      options_hint: "(joindre un fichier ou modifier les détails)",
      contact: "Contact",
      deal: "Opportunité",
    },
    // Task form
    task: {
      description: "Description",
      contact: "Contact",
    },
    // Dashboard
    dashboard: {
      hot_contacts: "Contacts chauds",
      create_contact: "Créer un contact",
      hot_contacts_empty:
        'Les contacts avec le statut "Chaud" apparaissent ici.',
      hot_contacts_hint:
        'Changez le statut d\'un contact via "Options avancées" lors d\'une note.',
      upcoming_tasks: "Tâches à venir",
      latest_activity: "Activité récente",
      deal_revenue: "Revenus prévisionnels",
    },
    // Dashboard stepper
    stepper: {
      whats_next: "Et maintenant ?",
      done: "fait",
      install: "Installer Atomic CRM",
      add_contact: "Ajouter votre premier contact",
      new_contact: "Nouveau contact",
      add_note: "Ajouter votre première note",
      add_note_hint: "Ouvrez une fiche contact et ajoutez une note",
      add_note_button: "Ajouter note",
    },
    // Settings
    settings: {
      title: "Paramètres",
      branding: "Personnalisation",
      app_title: "Titre de l'application",
      light_logo: "Logo (mode clair)",
      dark_logo: "Logo (mode sombre)",
      companies: "Sociétés",
      sectors: "Secteurs",
      deals: "Opportunités",
      stages: "Étapes",
      pipeline_statuses: "Statuts pipeline",
      pipeline_hint:
        'Sélectionnez les étapes considérées comme "gagnées" dans le pipeline.',
      categories: "Catégories",
      notes: "Notes",
      statuses: "Statuts",
      tasks: "Tâches",
      types: "Types",
      reset: "Réinitialiser",
      cancel: "Annuler",
      save: "Enregistrer",
      saving: "Enregistrement…",
      saved: "Configuration enregistrée",
      save_error: "Erreur lors de l'enregistrement",
    },
    // Mobile create button
    create: {
      contact: "Contact",
      note: "Note",
      task: "Tâche",
    },
    // Misc
    chart: {
      won: "Gagné",
      lost: "Perdu",
    },
  },
};

export const i18nProvider = polyglotI18nProvider(
  () => {
    return mergeTranslations(
      frenchMessages,
      raSupabaseEnglishMessages, // Supabase auth base (no official French package)
      raSupabaseFrenchMessages,
      customFrenchMessages,
    );
  },
  "fr",
  [{ locale: "fr", name: "Français" }],
  { allowMissing: true },
);
