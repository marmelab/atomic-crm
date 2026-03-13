import type { CrmMessages } from "./englishCrmMessages";

export const spanishCrmMessages = {
  resources: {
    companies: {
      name: "Empresa |||| Empresas",
      forcedCaseName: "Empresa",
      fields: {
        name: "Nombre de la empresa",
        website: "Sitio web",
        linkedin_url: "URL de LinkedIn",
        phone_number: "Teléfono",
        created_at: "Fecha de creación",
        nb_contacts: "Número de contactos",
        revenue: "Ingresos",
        sector: "Sector",
        size: "Tamaño",
        tax_identifier: "Identificador fiscal",
        address: "Dirección",
        city: "Ciudad",
        zipcode: "Código postal",
        state_abbr: "Provincia/Estado",
        country: "País",
        description: "Descripción",
        context_links: "Enlaces de contexto",
        sales_id: "Gestor/a de cuenta",
      },
      empty: {
        description: "Parece que tu lista de empresas está vacía.",
        title: "No se encontraron empresas",
      },
      field_categories: {
        contact: "Contacto",
        additional_info: "Información adicional",
        address: "Dirección",
        context: "Contexto",
      },
      action: {
        create: "Crear empresa",
        edit: "Editar empresa",
        new: "Nueva empresa",
        show: "Ver empresa",
      },
      added_on: "Añadida el %{date}",
      followed_by: "Seguida por %{name}",
      followed_by_you: "Seguida por ti",
      no_contacts: "Sin contactos",
      nb_contacts: "%{smart_count} contacto |||| %{smart_count} contactos",
      nb_deals: "%{smart_count} oportunidad |||| %{smart_count} oportunidades",
      sizes: {
        one_employee: "1 empleado",
        two_to_nine_employees: "2-9 empleados",
        ten_to_forty_nine_employees: "10-49 empleados",
        fifty_to_two_hundred_forty_nine_employees: "50-249 empleados",
        two_hundred_fifty_or_more_employees: "250 o más empleados",
      },
      autocomplete: {
        create_error: "Se produjo un error al crear la empresa",
        create_item: "Crear %{item}",
        create_label: "Empieza a escribir para crear una nueva empresa",
      },
    },
    contacts: {
      name: "Contacto |||| Contactos",
      forcedCaseName: "Contacto",
      field_categories: {
        background_info: "Información adicional",
        identity: "Identidad",
        misc: "Varios",
        personal_info: "Información personal",
        position: "Cargo",
      },
      fields: {
        first_name: "Nombre",
        last_name: "Apellidos",
        last_seen: "Última actividad",
        title: "Cargo",
        company_id: "Empresa",
        email_jsonb: "Direcciones de email",
        email: "Email",
        phone_jsonb: "Números de teléfono",
        phone_number: "Número de teléfono",
        linkedin_url: "URL de LinkedIn",
        background: "Información de contexto (bio, cómo os conocisteis, etc.)",
        has_newsletter: "Suscrito al boletín",
        sales_id: "Gestor/a de cuenta",
      },
      action: {
        add: "Añadir contacto",
        add_first: "Añade tu primer contacto",
        create: "Crear contacto",
        edit: "Editar contacto",
        export_vcard: "Exportar a vCard",
        new: "Nuevo contacto",
        show: "Ver contacto",
      },
      background: {
        last_activity_on: "Última actividad el %{date}",
        added_on: "Añadido el %{date}",
        followed_by: "Seguido por %{name}",
        followed_by_you: "Seguido por ti",
      },
      position_at: "%{title} en",
      position_at_company: "%{title} en %{company}",
      empty: {
        description: "Parece que tu lista de contactos está vacía.",
        title: "No se encontraron contactos",
      },
      import: {
        title: "Importar contactos",
        button: "Importar CSV",
        complete:
          "Importación de contactos completada. Se importaron %{importCount} contactos, con %{errorCount} errores",
        progress:
          "%{importCount} / %{rowCount} contactos importados, con %{errorCount} errores.",
        error:
          "No se pudo importar este archivo. Por favor, asegúrate de que proporcionaste un archivo CSV válido.",
        imported: "Importado",
        remaining_time: "Tiempo restante estimado:",
        running:
          "La importación está en curso, por favor no cierres esta pestaña.",
        sample_download: "Descargar CSV de ejemplo",
        sample_hint:
          "Aquí tienes un archivo CSV de ejemplo que puedes usar como plantilla",
        stop: "Detener importación",
        csv_file: "Archivo CSV",
        contacts_label: "contacto |||| contactos",
      },
      inputs: {
        genders: {
          male: "Él",
          female: "Ella",
          nonbinary: "Elle",
        },
        personal_info_types: {
          work: "Trabajo",
          home: "Personal",
          other: "Otro",
        },
      },
      list: {
        error_loading: "Error al cargar los contactos",
      },
      merge: {
        action: "Fusionar con otro contacto",
        confirm: "Fusionar contactos",
        current_contact: "Contacto actual (será eliminado)",
        description: "Fusiona este contacto con otro.",
        error: "Error al fusionar los contactos",
        merging: "Fusionando...",
        no_additional_data: "No hay datos adicionales que fusionar",
        select_target: "Por favor, selecciona un contacto con el que fusionar",
        success: "Contactos fusionados correctamente",
        target_contact: "Contacto destino (se mantendrá)",
        title: "Fusionar contacto",
        warning_description:
          "Todos los datos se transferirán al segundo contacto. Esta acción no se puede deshacer.",
        warning_title: "Advertencia: operación destructiva",
        what_will_be_merged: "Lo que se fusionará:",
      },
      filters: {
        before_last_month: "Antes del mes pasado",
        before_this_month: "Antes de este mes",
        before_this_week: "Antes de esta semana",
        managed_by_me: "Gestionados por mí",
        search: "Buscar nombre, empresa...",
        this_week: "Esta semana",
        today: "Hoy",
        tags: "Etiquetas",
        tasks: "Tareas",
      },
      hot: {
        empty_change_status:
          'Cambia el estado de un contacto añadiendo una nota y haciendo clic en "mostrar opciones".',
        empty_hint: 'Los contactos con estado "caliente" aparecerán aquí.',
        title: "Contactos calientes",
      },
    },
    deals: {
      name: "Oportunidad |||| Oportunidades",
      fields: {
        name: "Nombre",
        description: "Descripción",
        company_id: "Empresa",
        contact_ids: "Contactos",
        category: "Categoría",
        amount: "Presupuesto",
        expected_closing_date: "Fecha de cierre estimada",
        stage: "Etapa",
      },
      action: {
        back_to_deal: "Volver a la oportunidad",
        create: "Crear oportunidad",
        new: "Nueva oportunidad",
      },
      field_categories: {
        misc: "Varios",
      },
      archived: {
        action: "Archivar",
        error: "Error: no se pudo archivar la oportunidad",
        list_title: "Oportunidades archivadas",
        success: "Oportunidad archivada",
        title: "Oportunidad archivada",
        view: "Ver oportunidades archivadas",
      },
      inputs: {
        linked_to: "Vinculado a",
      },
      unarchived: {
        action: "Devolver al tablero",
        error: "Error: no se pudo desarchivar la oportunidad",
        success: "Oportunidad desarchivada",
      },
      updated: "Oportunidad actualizada",
      empty: {
        before_create: "antes de crear una oportunidad.",
        description: "Parece que tu lista de oportunidades está vacía.",
        title: "No se encontraron oportunidades",
      },
      invalid_date: "Fecha no válida",
    },
    notes: {
      name: "Nota |||| Notas",
      forcedCaseName: "Nota",
      fields: {
        status: "Estado",
        date: "Fecha",
        attachments: "Archivos adjuntos",
        contact_id: "Contacto",
        deal_id: "Oportunidad",
      },
      action: {
        add: "Añadir nota",
        add_first: "Añade tu primera nota",
        delete: "Eliminar nota",
        edit: "Editar nota",
        update: "Actualizar nota",
        add_this: "Añadir esta nota",
      },
      sheet: {
        create: "Crear nota",
        create_for: "Crear nota para %{name}",
        edit: "Editar nota",
        edit_for: "Editar nota para %{name}",
      },
      deleted: "Nota eliminada",
      empty: "Aún no hay notas",
      author_added: "%{name} añadió una nota",
      you_added: "Has añadido una nota",
      me: "Yo",
      list: {
        error_loading: "Error al cargar las notas",
      },
      note_for_contact: "Nota para %{name}",
      stepper: {
        hint: "Ve a la página de un contacto y añade una nota",
      },
      added: "Nota añadida",
      inputs: {
        add_note: "Añadir una nota",
        options_hint: "(adjuntar archivos o cambiar detalles)",
        show_options: "Mostrar opciones",
      },
    },
    sales: {
      name: "Usuario |||| Usuarios",
      fields: {
        first_name: "Nombre",
        last_name: "Apellidos",
        email: "Email",
        administrator: "Administrador/a",
        disabled: "Deshabilitado/a",
      },
      create: {
        error: "Se produjo un error al crear el usuario.",
        success:
          "Usuario creado. Recibirá pronto un email para establecer su contraseña.",
        title: "Crear un nuevo usuario",
      },
      edit: {
        error: "Se produjo un error. Por favor, inténtalo de nuevo.",
        record_not_found: "Registro no encontrado",
        success: "Usuario actualizado correctamente",
        title: "Editar %{name}",
      },
      action: {
        new: "Nuevo usuario",
      },
    },
    tasks: {
      name: "Tarea |||| Tareas",
      forcedCaseName: "Tarea",
      fields: {
        text: "Descripción",
        due_date: "Fecha de vencimiento",
        type: "Tipo",
        contact_id: "Contacto",
        due_short: "vence",
      },
      action: {
        add: "Añadir tarea",
        create: "Crear tarea",
        edit: "Editar tarea",
      },
      actions: {
        postpone_next_week: "Posponer a la próxima semana",
        postpone_tomorrow: "Posponer a mañana",
        title: "Acciones de tarea",
      },
      added: "Tarea añadida",
      deleted: "Tarea eliminada correctamente",
      dialog: {
        create: "Crear tarea",
        create_for: "Crear tarea para %{name}",
      },
      sheet: {
        edit: "Editar tarea",
        edit_for: "Editar tarea para %{name}",
      },
      empty: "Aún no hay tareas",
      empty_list_hint: "Las tareas añadidas a tus contactos aparecerán aquí.",
      filters: {
        later: "Más adelante",
        overdue: "Atrasadas",
        this_week: "Esta semana",
        today: "Hoy",
        tomorrow: "Mañana",
        with_pending: "Con tareas pendientes",
      },
      regarding_contact: "(Ref: %{name})",
      updated: "Tarea actualizada",
    },
    tags: {
      name: "Etiqueta |||| Etiquetas",
      action: {
        add: "Añadir etiqueta",
        create: "Crear nueva etiqueta",
      },
      dialog: {
        color: "Color",
        create_title: "Crear una nueva etiqueta",
        edit_title: "Editar etiqueta",
        name_label: "Nombre de la etiqueta",
        name_placeholder: "Introduce el nombre de la etiqueta",
      },
    },
  },
  crm: {
    auth: {
      confirmation_required:
        "Por favor, sigue el enlace que te acabamos de enviar por email para confirmar tu cuenta.",
      recovery_email_sent:
        "Si estás registrado/a, recibirás pronto un email para recuperar tu contraseña.",
      sign_in_failed: "Error al iniciar sesión.",
      sign_in_google_workspace: "Iniciar sesión con Google Workplace",
      signup: {
        create_account: "Crear cuenta",
        create_first_user:
          "Crea la primera cuenta de usuario para completar la configuración.",
        creating: "Creando...",
        initial_user_created: "Usuario inicial creado correctamente",
      },
      welcome_title: "Bienvenido/a a Atomic CRM",
    },
    common: {
      activity: "Actividad",
      added: "añadido",
      details: "Detalles",
      last_activity_with_date: "última actividad %{date}",
      load_more: "Cargar más",
      misc: "Varios",
      past: "Pasado",
      read_more: "Leer más",
      retry: "Reintentar",
      show_less: "Mostrar menos",
      copied: "¡Copiado!",
      copy: "Copiar",
      loading: "Cargando...",
      me: "Yo",
      task_count: "%{smart_count} tarea |||| %{smart_count} tareas",
    },
    activity: {
      added_company: "%{name} añadió la empresa",
      you_added_company: "Añadiste la empresa",
      added_contact: "%{name} añadió",
      you_added_contact: "Añadiste",
      added_note: "%{name} añadió una nota sobre",
      you_added_note: "Añadiste una nota sobre",
      added_note_about_deal: "%{name} añadió una nota sobre la oportunidad",
      you_added_note_about_deal: "Añadiste una nota sobre la oportunidad",
      added_deal: "%{name} añadió la oportunidad",
      you_added_deal: "Añadiste la oportunidad",
      at_company: "en",
      to: "a",
      load_more: "Cargar más actividad",
    },
    dashboard: {
      deals_chart: "Ingresos de oportunidades próximas",
      deals_pipeline: "Pipeline de oportunidades",
      latest_activity: "Última actividad",
      latest_activity_error: "Error al cargar la última actividad",
      latest_notes: "Mis últimas notas",
      latest_notes_added_ago: "añadida %{timeAgo}",
      stepper: {
        install: "Instalar Atomic CRM",
        progress: "%{step}/3 completado",
        whats_next: "¿Qué sigue?",
      },
      upcoming_tasks: "Tareas próximas",
    },
    header: {
      import_data: "Importar datos",
    },
    image_editor: {
      change: "Cambiar",
      drop_hint: "Suelta un archivo para subir o haz clic para seleccionarlo.",
      editable_content: "Contenido editable",
      title: "Subir y redimensionar imagen",
      update_image: "Actualizar imagen",
    },
    import: {
      action: {
        download_error_report: "Descargar el informe de errores",
        import: "Importar",
        import_another: "Importar otro archivo",
      },
      error: {
        unable: "No se pudo importar este archivo.",
      },
      idle: {
        description_1:
          "Puedes importar vendedores, empresas, contactos, notas y tareas.",
        description_2:
          "Los datos deben estar en un archivo JSON que coincida con el siguiente ejemplo:",
      },
      status: {
        all_success: "Todos los registros se importaron correctamente.",
        complete: "Importación completada.",
        failed: "Fallido",
        imported: "Importado",
        in_progress:
          "Importación en curso, por favor no salgas de esta página.",
        some_failed: "Algunos registros no se pudieron importar.",
        table_caption: "Estado de la importación",
      },
      title: "Importar datos",
    },
    settings: {
      companies: {
        sectors: "Sectores",
      },
      dark_mode_logo: "Logo en modo oscuro",
      deals: {
        categories: "Categorías",
        pipeline_help:
          "Selecciona qué etapas de oportunidad deben contar como oportunidades del pipeline.",
        pipeline_statuses: "Estados del pipeline",
        stages: "Etapas",
      },
      light_mode_logo: "Logo en modo claro",
      notes: {
        statuses: "Estados",
      },
      reset_defaults: "Restablecer valores por defecto",
      save_error: "Error al guardar la configuración",
      saved: "Configuración guardada correctamente",
      saving: "Guardando...",
      tasks: {
        types: "Tipos",
      },
      title: "Configuración",
      app_title: "Título de la aplicación",
      sections: {
        branding: "Imagen de marca",
      },
      validation: {
        duplicate: "%{display_name} duplicados: %{items}",
        in_use:
          "No se pueden eliminar %{display_name} que aún están en uso en oportunidades: %{items}",
        validating: "Validando\u2026",
        entities: {
          categories: "categorías",
          stages: "etapas",
        },
      },
    },
    welcome: {
      title: "Tu kit de inicio CRM",
      description:
        "es una plantilla diseñada para ayudarte a construir rápidamente tu propio CRM.",
      demo_description:
        "Esta demo funciona con una API simulada, puedes explorar y modificar los datos. Se reinician al recargar. La versión completa usa Supabase como backend.",
      powered_by: "Desarrollado con",
      open_source_suffix:
        ", Atomic CRM es completamente open-source. Puedes encontrar el código en",
    },
    deals_chart: {
      won: "Ganadas",
      lost: "Perdidas",
    },
    theme: {
      dark: "Oscuro",
      light: "Claro",
      system: "Sistema",
    },
    language: "Idioma",
    navigation: {
      label: "Navegación CRM",
    },
    profile: {
      inbound: {
        description:
          "Puedes empezar a enviar emails a la dirección de correo entrante de tu servidor, por ejemplo añadiéndola al campo %{field}. Atomic CRM procesará los emails y añadirá notas a los contactos correspondientes.",
        title: "Email entrante",
      },
      password: {
        change: "Cambiar contraseña",
      },
      password_reset_sent:
        "Se ha enviado un email de restablecimiento de contraseña a tu dirección de correo",
      record_not_found: "Registro no encontrado",
      title: "Perfil",
      updated: "Tu perfil ha sido actualizado",
      update_error: "Se produjo un error. Por favor, inténtalo de nuevo",
    },
    validation: {
      invalid_url: "Debe ser una URL válida",
      invalid_linkedin_url: "La URL debe ser de linkedin.com",
    },
  },
} satisfies CrmMessages;
