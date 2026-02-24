export const frenchCrmMessages = {
  crm: {
    auth: {
      confirmation_required:
        "Veuillez suivre le lien que nous venons de vous envoyer par email pour confirmer votre compte.",
      recovery_email_sent:
        "Si vous êtes un utilisateur enregistré, vous devriez recevoir prochainement un e-mail de récupération de mot de passe.",
      sign_in_failed: "Échec de la connexion.",
      sign_in_google_workspace: "Connectez-vous avec Google Workplace",
      signup: {
        create_account: "Créer un compte",
        create_first_user:
          "Créez le premier compte utilisateur pour terminer la configuration.",
        creating: "Création...",
        initial_user_created: "Utilisateur initial créé avec succès",
      },
      welcome_title: "Bienvenue sur Atomic CRM",
    },
    common: {
      activity: "Activité",
      ago: "il y a",
      by: "Par",
      details: "Détails",
      errors: "erreurs",
      invalid_date: "Date invalide",
      last_activity: "dernière activité",
      load_more: "Charger plus",
      misc: "Divers",
      past: "Passé",
      read_more: "En savoir plus",
      regarding: "Concernant:",
      retry: "Réessayer",
      show_less: "Afficher moins",
      task_count: "tâche |||| tâches",
      with: "avec",
      account_manager: "Responsable de compte",
      at: "chez",
      copied: "Copié !",
      copy: "Copier",
      loading: "Chargement...",
      me: "Moi",
    },
    companies: {
      empty: {
        description: "Il semble que la liste de vos entreprises soit vide.",
        title: "Aucune entreprise trouvée",
      },
      inputs: {
        additional_information: "Informations Complémentaires",
        address: "Adresse",
        contact: "Contact",
        context: "Contexte",
      },
      name: "Entreprise |||| Entreprises",
      forcedCaseName: "Entreprise",
      action: {
        create: "Créer une entreprise",
        edit: "Modifier l'entreprise",
        new: "Nouvelle entreprise",
        show: "Afficher l'entreprise",
      },
      contacts: {
        many: "%{smart_count} contacts",
        none: "Aucun contact",
        one: "1 contact",
      },
      deals: {
        many: "%{smart_count} affaires",
        one: "1 affaire",
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
        only_mine: "Seulement les entreprises que je gère",
        sector: "Secteur",
        size: "Taille",
      },
    },
    contacts: {
      action: {
        add: "Ajouter un contact",
        add_first: "Ajoutez votre premier contact",
        edit: "Modifier le contact",
        new: "Nouveau contact",
        show: "Afficher le contact",
      },
      background: {
        last_activity_on: "Dernière activité sur",
        added_on: "Ajouté le",
        followed_by: "Suivi par",
      },
      empty: {
        description: "Il semble que votre liste de contacts soit vide.",
        title: "Aucun contact trouvé",
      },
      import: {
        button: "Importer un fichier CSV",
        complete:
          "Import des contacts terminé. %{importCount} contacts importés, %{errorCount} erreurs",
        error:
          "Échec de l'importation de ce fichier. Veuillez vous assurer que vous avez fourni un fichier CSV valide.",
        imported: "Importé",
        remaining_time: "Temps restant estimé :",
        running: "L'import est en cours, merci de ne pas fermer cet onglet.",
        sample_download: "Télécharger un exemple CSV",
        sample_hint:
          "Voici un exemple de fichier CSV que vous pouvez utiliser comme modèle",
        stop: "Arrêter l'importation",
        csv_file: "Fichier CSV",
        contacts_label: "contact |||| contacts",
      },
      inputs: {
        background_info_short: "Informations générales",
        email: "E-mail",
        identity: "Identité",
        personal_info: "Informations personnelles",
        phone_number: "Numéro de téléphone",
        position: "Position",
        email_addresses: "Adresses e-mail",
        phone_numbers: "Numéros de téléphone",
        linkedin_url: "URL LinkedIn",
        background_info:
          "Informations de contexte (bio, comment vous vous êtes rencontrés, etc.)",
      },
      list: {
        error_loading: "Erreur lors du chargement des contacts",
      },
      merge: {
        action: "Fusionner avec un autre contact",
        confirm: "Fusionner les contacts",
        current_contact: "Contact actuel (sera supprimé)",
        description: "Fusionnez ce contact avec un autre.",
        error: "Échec de la fusion des contacts",
        merging: "Fusion...",
        no_additional_data: "Aucune donnée supplémentaire à fusionner",
        select_target: "Veuillez sélectionner un contact avec lequel fusionner",
        success: "Contacts fusionnés avec succès",
        target_contact: "Contact cible (sera conservé)",
        title: "Fusionner les contacts",
        warning_description:
          "Toutes les données seront transférées au deuxième contact. Cette action ne peut pas être annulée.",
        warning_title: "Avertissement : opération destructrice",
        what_will_be_merged: "Ce qui sera fusionné :",
      },
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
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
    dashboard: {
      stepper: {
        install: "Installer Atomic CRM",
        progress: "%{step}/3 terminé",
        whats_next: "Et ensuite ?",
      },
      welcome: {
        paragraph_1:
          "est un modèle conçu pour vous aider à créer rapidement votre propre CRM.",
        paragraph_2:
          "Cette démo s'exécute sur une API fictive, vous pouvez donc explorer et modifier les données. Il se réinitialise au rechargement. La version complète utilise Supabase pour le backend.",
        paragraph_3:
          ", Atomic CRM est entièrement open source. Vous pouvez trouver le code sur",
        powered_by: "Alimenté par",
        title: "Votre kit de démarrage CRM",
      },
    },
    deals: {
      action: {
        back_to_deal: "Retour à l'affaire",
        create: "Créer un deal",
        new: "Nouvelle affaire",
      },
      archived: {
        action: "Archiver",
        error: "Erreur : affaire non archivée",
        list_title: "Affaires archivées",
        success: "Affaire archivée",
        title: "Affaire archivée",
        view: "Afficher les affaires archivées",
      },
      edit: {
        title: "Modifier l'affaire %{name}",
      },
      fields: {
        budget: "Budget",
        category: "Catégorie",
        expected_closing_date: "Date de clôture prévue",
        stage: "Étape",
        description: "Description",
      },
      inputs: {
        linked_to: "Lié à",
        name: "Nom du deal",
        contacts: "Contacts",
        category: "Catégorie",
      },
      unarchived: {
        action: "Renvoyer au tableau",
        error: "Erreur : affaire non désarchivée",
        success: "Affaire désarchivée",
      },
      updated: "Affaire mise à jour",
      name: "Affaire |||| Affaires",
      empty: {
        before_create: "avant de créer une affaire.",
        description: "Il semble que votre liste d'affaires soit vide.",
        title: "Aucune affaire trouvée",
      },
      filters: {
        company: "Entreprise",
      },
    },
    header: {
      import_data: "Importer des données",
    },
    image_editor: {
      change: "Changement",
      drop_hint:
        "Déposez un fichier à télécharger ou cliquez pour le sélectionner.",
      editable_content: "Contenu modifiable",
      title: "Télécharger et redimensionner l'image",
      update_image: "Mettre à jour l'image",
    },
    import: {
      action: {
        download_error_report: "Téléchargez le rapport d'erreur",
        import: "Importer",
        import_another: "Importer un autre fichier",
      },
      error: {
        unable: "Impossible d'importer ce fichier.",
      },
      idle: {
        description_1:
          "Vous pouvez importer des ventes, des entreprises, des contacts, des entreprises, des notes et des tâches.",
        description_2:
          "Les données doivent se trouver dans un fichier JSON correspondant à l'exemple suivant :",
      },
      status: {
        all_success: "Tous les enregistrements ont été importés avec succès.",
        complete: "Importation terminée.",
        failed: "Échoué",
        imported: "Importé",
        in_progress: "Import en cours, veuillez ne pas quitter cette page.",
        some_failed: "Certains enregistrements n'ont pas été importés.",
        table_caption: "Statut d'importation",
      },
      title: "Importer des données",
    },
    notes: {
      action: {
        add: "Ajouter une note",
        add_first: "Ajoutez votre première note",
        delete: "Supprimer la note",
        edit: "Modifier la note",
        update: "Mettre à jour la note",
        add_this: "Ajouter cette note",
      },
      deleted: "Note supprimée",
      empty: "Aucune note pour l'instant",
      note_for: "Note pour",
      stepper: {
        hint: "Accédez à une page de contact et ajoutez une note",
      },
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      added: "Note ajoutée",
      inputs: {
        add_note: "Ajouter une note",
        date: "Date",
        options_hint: "(joindre des fichiers ou modifier les détails)",
        reference_contact: "Contact",
        reference_deal: "Affaire",
        show_options: "Afficher les options",
      },
      statuses: {
        cold: "Froid",
        warm: "Tiède",
        hot: "Chaud",
        in_contract: "Sous contrat",
      },
    },
    sales: {
      create: {
        error:
          "Une erreur s'est produite lors de la création de l'utilisateur.",
        success:
          "Utilisateur créé. Ils recevront prochainement un email pour définir leur mot de passe.",
        title: "Créer un nouvel utilisateur",
      },
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
      companies: {
        sectors: "Secteurs",
      },
      dark_mode_logo: "Logo du mode sombre",
      deals: {
        categories: "Catégories",
        pipeline_help:
          "Sélectionnez les étapes de deal qui comptent comme deals de pipeline (terminés).",
        pipeline_statuses: "Statuts des pipelines",
        stages: "Étapes",
      },
      light_mode_logo: "Logo du mode clair",
      notes: {
        statuses: "Statuts",
      },
      reset_defaults: "Réinitialiser aux valeurs par défaut",
      save_error: "Échec de l'enregistrement de la configuration",
      saved: "Configuration enregistrée avec succès",
      saving: "Enregistrement...",
      tasks: {
        types: "Types",
      },
      title: "Paramètres",
      app_title: "Titre de l'application",
      sections: {
        branding: "Image de marque",
      },
    },
    tasks: {
      action: {
        add: "Ajouter une tâche",
        create: "Créer une tâche",
        edit: "Modifier la tâche",
      },
      actions: {
        postpone_next_week: "Reporté à la semaine prochaine",
        postpone_tomorrow: "Reporter à demain",
        title: "Actions de tâche",
      },
      added: "Tâche ajoutée",
      deleted: "Tâche supprimée avec succès",
      dialog: {
        create: "Créer une nouvelle tâche",
        create_for: "Créer une nouvelle tâche pour",
      },
      empty: "Aucune tâche pour l'instant",
      empty_list_hint: "Les tâches ajoutées à vos contacts apparaîtront ici.",
      fields: {
        due: "échéance",
        description: "Description",
      },
      filters: {
        later: "Plus tard",
        overdue: "En retard",
        this_week: "Cette semaine",
        today: "Aujourd'hui",
        tomorrow: "Demain",
        with_pending: "Avec des tâches en attente",
      },
      updated: "Tâche mise à jour",
      name: "Tâche |||| Tâches",
      forcedCaseName: "Tâche",
    },
    theme: {
      dark: "Thème sombre",
      dark_short: "Sombre",
      light: "Thème clair",
      light_short: "Clair",
      system: "Thème système",
      system_short: "Système",
    },
    language: "Langue",
    navigation: {
      label: "Navigation CRM",
    },
    tags: {
      name: "Étiquette |||| Étiquettes",
      dialog: {
        color: "Couleur",
        name_label: "Nom de l'étiquette",
        name_placeholder: "Saisir le nom de l'étiquette",
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
} as const;
