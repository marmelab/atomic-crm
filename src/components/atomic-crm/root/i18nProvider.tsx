import polyglotI18nProvider from "ra-i18n-polyglot";

// Italian translations for ra-core (inlined from @christianascone/ra-language-italian
// to avoid pulling in ra-core v4 + react-router v6 as transitive deps)
const italianMessages = {
  ra: {
    action: {
      add_filter: "Aggiungi filtro",
      add: "Aggiungi",
      back: "Indietro",
      bulk_actions:
        "1 elemento selezionato |||| %{smart_count} elementi selezionati",
      cancel: "Annulla",
      clear_array_input: "Svuota la lista",
      clear_input_value: "Pulisci valore",
      clone: "Clona",
      confirm: "Conferma",
      create: "Crea",
      create_item: "Crea %{item}",
      delete: "Elimina",
      edit: "Modifica",
      export: "Esporta",
      list: "Elenco",
      refresh: "Aggiorna",
      remove_filter: "Rimuovi questo filtro",
      remove_all_filters: "Rimuovi tutti i filtri",
      remove: "Rimuovi",
      save: "Salva",
      search: "Cerca",
      select_all: "Seleziona tutto",
      select_row: "Seleziona questa riga",
      show: "Visualizza",
      sort: "Ordina",
      undo: "Annulla",
      unselect: "Deseleziona",
      expand: "Espandi",
      close: "Chiudi",
      open_menu: "Apri menu",
      close_menu: "Chiudi menu",
      update: "Aggiorna",
      move_up: "Sposta su",
      move_down: "Sposta giù",
      open: "Apri",
      toggle_theme: "Attiva/disattiva modalità chiara/scura",
      select_columns: "Colonne",
      search_columns: "Cerca colonne",
      clear_search: "Cancella ricerca",
      update_application: "Ricarica applicazione",
    },
    boolean: {
      true: "Sì",
      false: "No",
      null: " ",
    },
    page: {
      create: "Crea %{name}",
      dashboard: "Dashboard",
      edit: "%{name} %{recordRepresentation}",
      error: "Qualcosa è andato storto",
      list: "%{name}",
      loading: "Caricamento",
      not_found: "Non trovato",
      show: "%{name} %{recordRepresentation}",
      empty: "Ancora nessun %{name}.",
      invite: "Vuoi aggiungerne uno?",
    },
    input: {
      file: {
        upload_several:
          "Trascina i file per caricarli, o clicca per selezionarne uno.",
        upload_single:
          "Trascina un file per caricarlo, o clicca per selezionarlo.",
      },
      image: {
        upload_several:
          "Trascina le immagini per caricarle, o clicca per selezionarne una.",
        upload_single:
          "Trascina un'immagine per caricarla, o clicca per selezionarla.",
      },
      references: {
        all_missing: "Impossibile trovare i dati di riferimento.",
        many_missing:
          "Almeno uno dei riferimenti associati sembra non essere più disponibile.",
        single_missing:
          "Il riferimento associato sembra non essere più disponibile.",
      },
      password: {
        toggle_visible: "Nascondi password",
        toggle_hidden: "Mostra password",
      },
    },
    message: {
      about: "Informazioni",
      are_you_sure: "Sei sicuro?",
      auth_error:
        "Si è verificato un errore durante la validazione del token di autenticazione.",
      bulk_delete_content:
        "Sei sicuro di voler eliminare questo %{name}? |||| Sei sicuro di voler eliminare questi %{smart_count} elementi?",
      bulk_delete_title: "Elimina %{name} |||| Elimina %{smart_count} %{name}",
      bulk_update_content:
        "Sei sicuro di voler aggiornare questo %{name}? |||| Sei sicuro di voler aggiornare questi %{smart_count} elementi?",
      bulk_update_title:
        "Aggiorna %{name} |||| Aggiorna %{smart_count} %{name}",
      clear_array_input: "Sei sicuro di voler cancellare l'intera lista?",
      delete_content: "Sei sicuro di voler eliminare questo elemento?",
      delete_title: "Elimina %{name} #%{id}",
      details: "Dettagli",
      error:
        "Si è verificato un errore lato client e la tua richiesta non è stata completata.",
      invalid_form:
        "Il modulo non è valido. Si prega di controllare gli errori",
      loading: "Attendere prego",
      no: "No",
      not_found: "O hai digitato un URL errato, o hai seguito un link errato.",
      yes: "Sì",
      unsaved_changes:
        "Alcune delle tue modifiche non sono state salvate. Sei sicuro di voler proseguire?",
    },
    navigation: {
      no_results: "Nessun risultato trovato",
      no_more_results:
        "La pagina %{page} è fuori dai limiti. Prova la pagina precedente.",
      page_out_of_boundaries: "Il numero di pagina %{page} è fuori dai limiti",
      page_out_from_end: "Non puoi andare oltre l'ultima pagina",
      page_out_from_begin: "Non puoi andare prima della pagina 1",
      page_range_info: "%{offsetBegin}-%{offsetEnd} di %{total}",
      partial_page_range_info:
        "%{offsetBegin}-%{offsetEnd} di più di %{offsetEnd}",
      current_page: "Pagina %{page}",
      page: "Vai alla pagina %{page}",
      first: "Vai alla prima pagina",
      last: "Vai all'ultima pagina",
      next: "Vai alla pagina successiva",
      previous: "Vai alla pagina precedente",
      page_rows_per_page: "Righe per pagina:",
      skip_nav: "Salta al contenuto",
      no_filtered_results: "Nessun risultato con i filtri correnti.",
      clear_filters: "Rimuovi filtri",
      breadcrumb_drawer_title: "Naviga a",
      breadcrumb_drawer_instructions: "Seleziona una pagina.",
    },
    sort: {
      sort_by: "Ordina per %{field} %{order}",
      ASC: "crescente",
      DESC: "decrescente",
    },
    auth: {
      auth_check_error: "Effettua il login per continuare",
      user_menu: "Profilo",
      username: "Nome utente",
      password: "Password",
      sign_in: "Accedi",
      sign_in_error: "Autenticazione fallita, riprova",
      logout: "Esci",
    },
    notification: {
      updated: "Elemento aggiornato |||| %{smart_count} elementi aggiornati",
      created: "Elemento creato",
      deleted: "Elemento eliminato |||| %{smart_count} elementi eliminati",
      bad_item: "Elemento non corretto",
      item_doesnt_exist: "L'elemento non esiste",
      http_error: "Errore di comunicazione con il server",
      data_provider_error:
        "Errore del dataProvider. Controlla la console per i dettagli.",
      i18n_error:
        "Impossibile caricare le traduzioni per la lingua specificata",
      canceled: "Azione annullata",
      logged_out: "La tua sessione è terminata, effettua nuovamente l'accesso.",
      not_authorized: "Non sei autorizzato ad accedere a questa risorsa.",
      application_update_available: "È disponibile una nuova versione.",
    },
    validation: {
      required: "Richiesto",
      minLength: "Deve contenere almeno %{min} caratteri",
      maxLength: "Deve contenere al massimo %{max} caratteri",
      minValue: "Deve essere almeno %{min}",
      maxValue: "Deve essere al massimo %{max}",
      number: "Deve essere un numero",
      email: "Deve essere un'email valida",
      oneOf: "Deve essere uno di: %{options}",
      regex: "Deve corrispondere a un formato specifico (regexp): %{pattern}",
      unique: "Deve essere univoco",
    },
    saved_queries: {
      label: "Query salvate",
      query_name: "Nome query",
      new_label: "Salva la query corrente...",
      new_dialog_title: "Salva la query corrente come",
      remove_label: "Rimuovi query salvata",
      remove_label_with_name: 'Rimuovi query "%{name}"',
      remove_dialog_title: "Rimuovere la query salvata?",
      remove_message:
        "Sei sicuro di voler rimuovere questo elemento dalla tua lista di query salvate?",
      help: "Filtra l'elenco e salva questa query per dopo",
    },
    configurable: {
      customize: "Personalizza",
      configureMode: "Configura questa pagina",
      inspector: {
        title: "Ispettore",
        content:
          "Passa sopra gli elementi dell'interfaccia utente dell'applicazione per configurarli",
        reset: "Ripristina impostazioni",
        hideAll: "Nascondi tutto",
        showAll: "Mostra tutto",
      },
      Datagrid: {
        title: "Datagrid",
        unlabeled: "Colonna senza etichetta #%{column}",
      },
      SimpleForm: {
        title: "Modulo",
        unlabeled: "Input senza etichetta #%{input}",
      },
      SimpleList: {
        title: "Elenco",
        primaryText: "Testo principale",
        secondaryText: "Testo secondario",
        tertiaryText: "Testo terziario",
      },
    },
  },
};

// Italian translations for ra-supabase auth messages
const raSupabaseItalianMessages = {
  "ra-supabase": {
    auth: {
      email: "Email",
      confirm_password: "Conferma password",
      sign_in_with: "Accedi con %{provider}",
      forgot_password: "Password dimenticata?",
      reset_password: "Reimposta password",
      password_reset:
        "Controlla la tua email per il link di reimpostazione password.",
      missing_tokens: "Token di accesso mancanti",
      back_to_login: "Torna al login",
    },
    reset_password: {
      forgot_password: "Password dimenticata?",
      forgot_password_details:
        "Inserisci la tua email per ricevere le istruzioni.",
    },
    set_password: {
      new_password: "Scegli la tua password",
    },
    validation: {
      password_mismatch: "Le password non corrispondono",
    },
  },
};

// Custom resource translations for the gestionale
const gestionaleMessages = {
  resources: {
    clients: {
      name: "Cliente |||| Clienti",
      fields: {
        name: "Nome / Ragione sociale",
        billing_name: "Denominazione fiscale",
        client_type: "Tipo cliente",
        phone: "Telefono",
        email: "Email",
        address: "Indirizzo operativo / recapito",
        vat_number: "Partita IVA",
        fiscal_code: "Codice fiscale",
        billing_address_street: "Via / Piazza",
        billing_address_number: "Numero civico",
        billing_postal_code: "CAP",
        billing_city: "Comune",
        billing_province: "Provincia",
        billing_country: "Nazione",
        billing_sdi_code: "Codice destinatario",
        billing_pec: "PEC",
        source: "Fonte acquisizione",
        notes: "Note",
        created_at: "Data creazione",
        updated_at: "Ultimo aggiornamento",
      },
    },
    projects: {
      name: "Progetto |||| Progetti",
      fields: {
        name: "Nome progetto",
        client_id: "Cliente",
        category: "Categoria",
        tv_show: "Programma TV",
        status: "Stato",
        start_date: "Data inizio",
        end_date: "Data fine",
        all_day: "Tutto il giorno",
        budget: "Budget",
        notes: "Note",
      },
    },
    services: {
      name: "Servizio |||| Registro Lavori",
      fields: {
        project_id: "Progetto",
        service_date: "Data inizio",
        service_end: "Data fine",
        all_day: "Tutto il giorno",
        is_taxable: "Tassabile",
        service_type: "Tipo servizio",
        fee_shooting: "Compenso riprese",
        fee_editing: "Compenso montaggio",
        fee_other: "Compenso altro",
        km_distance: "Km percorsi",
        km_rate: "Tariffa km",
        location: "Località",
        invoice_ref: "Rif. Fattura",
        notes: "Note",
      },
    },
    quotes: {
      name: "Preventivo |||| Preventivi",
      fields: {
        client_id: "Cliente",
        project_id: "Progetto collegato",
        service_type: "Tipo servizio",
        event_start: "Data inizio evento",
        event_end: "Data fine evento",
        all_day: "Tutto il giorno",
        description: "Descrizione",
        amount: "Importo",
        status: "Stato",
        sent_date: "Data invio",
        response_date: "Data risposta",
        rejection_reason: "Motivo rifiuto",
        notes: "Note",
      },
    },
    payments: {
      name: "Incasso |||| Incassi",
      fields: {
        client_id: "Cliente",
        project_id: "Progetto",
        quote_id: "Preventivo",
        payment_date: "Data pagamento",
        payment_type: "Tipo",
        amount: "Importo",
        method: "Metodo pagamento",
        invoice_ref: "Rif. Fattura",
        status: "Stato",
        notes: "Note",
      },
    },
    expenses: {
      name: "Spesa |||| Spese",
      fields: {
        project_id: "Progetto",
        client_id: "Cliente",
        expense_date: "Data",
        expense_type: "Tipo spesa",
        km_distance: "Km percorsi",
        km_rate: "Tariffa km",
        amount: "Importo",
        markup_percent: "Ricarico %",
        description: "Descrizione",
        invoice_ref: "Rif. Fattura",
      },
    },
    contacts: {
      name: "Contatto |||| Contatti",
      fields: {
        first_name: "Nome",
        last_name: "Cognome",
        title: "Qualifica libera",
        contact_role: "Ruolo strutturato",
        is_primary_for_client: "Referente principale cliente",
        client_id: "Cliente",
        email_jsonb: "Email",
        phone_jsonb: "Telefoni",
        linkedin_url: "LinkedIn",
        background: "Note",
        created_at: "Creato il",
        updated_at: "Aggiornato il",
      },
    },
    companies: {
      name: "Azienda |||| Aziende",
    },
    project_contacts: {
      name: "Referente progetto |||| Referenti progetto",
      fields: {
        project_id: "Progetto",
        contact_id: "Referente",
        is_primary: "Principale",
      },
    },
    deals: {
      name: "Trattativa |||| Trattative",
    },
    tasks: {
      name: "Attività |||| Attività",
    },
    sales: {
      name: "Utente |||| Utenti",
    },
    tags: {
      name: "Tag |||| Tag",
    },
  },
};

const allMessages = {
  ...italianMessages,
  ...raSupabaseItalianMessages,
  ...gestionaleMessages,
};

export const i18nProvider = polyglotI18nProvider(
  () => allMessages,
  "it",
  [{ locale: "it", name: "Italiano" }],
  { allowMissing: true },
);
