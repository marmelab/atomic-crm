export const englishCrmMessages = {
  resources: {
    companies: {
      name: "Company |||| Companies",
      fields: {
        name: "Company name",
        website: "Website",
        linkedin_url: "LinkedIn URL",
        phone_number: "Phone number",
        created_at: "Created at",
        nb_contacts: "Number of contacts",
        revenue: "Revenue",
        sector: "Sector",
        size: "Size",
        tax_identifier: "Tax Identifier",
        address: "Address",
        city: "City",
        zipcode: "Zip code",
        state_abbr: "State",
        country: "Country",
        description: "Description",
        context_links: "Context links",
        sales_id: "Account manager",
      },
    },
    contacts: {
      name: "Contact |||| Contacts",
      fields: {
        first_name: "First name",
        last_name: "Last name",
        last_seen: "Last seen",
        title: "Title",
        company_id: "Company",
        email_jsonb: "Email addresses",
        email: "Email",
        phone_jsonb: "Phone numbers",
        phone_number: "Phone number",
        linkedin_url: "LinkedIn URL",
        background: "Background info (bio, how you met, etc)",
        has_newsletter: "Has newsletter",
        sales_id: "Account manager",
      },
    },
    deals: {
      name: "Deal |||| Deals",
      fields: {
        name: "Name",
        description: "Description",
        company_id: "Company",
        contact_ids: "Contacts",
        category: "Category",
        amount: "Budget",
        expected_closing_date: "Expected closing date",
        stage: "Stage",
      },
    },
    notes: {
      name: "Note |||| Notes",
      fields: {
        status: "Status",
        date: "Date",
        attachments: "Attachments",
        contact_id: "Contact",
        deal_id: "Deal",
      },
    },
    sales: {
      name: "User |||| Users",
      fields: {
        first_name: "First name",
        last_name: "Last name",
        email: "Email",
        administrator: "Admin",
        disabled: "Disabled",
      },
    },
    tasks: {
      name: "Task |||| Tasks",
      fields: {
        text: "Description",
        due_date: "Due date",
        type: "Type",
        contact_id: "Contact",
        due_short: "due",
      },
    },
  },
  crm: {
    auth: {
      confirmation_required:
        "Please follow the link we just sent you by email to confirm your account.",
      recovery_email_sent:
        "If you're a registered user, you should receive a password recovery email shortly.",
      sign_in_failed: "Failed to log in.",
      sign_in_google_workspace: "Sign in with Google Workplace",
      signup: {
        create_account: "Create account",
        create_first_user:
          "Create the first user account to complete the setup.",
        creating: "Creating...",
        initial_user_created: "Initial user successfully created",
      },
      welcome_title: "Welcome to Atomic CRM",
    },
    common: {
      activity: "Activity",
      added: "added",
      ago: "ago",
      by: "By",
      details: "Details",
      errors: "errors",
      invalid_date: "Invalid date",
      last_activity: "last activity",
      load_more: "Load more",
      misc: "Misc",
      on: "on",
      past: "Past",
      read_more: "Read more",
      regarding: "Re:",
      retry: "Retry",
      show_less: "Show less",
      with: "with",
      account_manager: "Account manager",
      at: "at",
      copied: "Copied!",
      copy: "Copy",
      loading: "Loading...",
      me: "Me",
      task_count: "task |||| tasks",
    },
    activity: {
      you: "You",
      added_company: "added company",
      added_contact: "added",
      added_note_about: "added a note about",
      added_note_about_self: "added a note about",
      added_note_about_deal: "added a note about deal",
      added_note_about_deal_self: "added a note about deal",
      added_deal: "added deal",
      to: "to",
      load_more: "Load more activity",
    },
    companies: {
      empty: {
        description: "It seems your company list is empty.",
        title: "No companies found",
      },
      inputs: {
        additional_information: "Additional information",
        address: "Address",
        contact: "Contact",
        context: "Context",
      },
      name: "Company |||| Companies",
      forcedCaseName: "Company",
      action: {
        create: "Create Company",
        edit: "Edit company",
        new: "New Company",
        show: "Show company",
      },
      contacts: {
        many: "%{smart_count} Contacts",
        none: "No Contacts",
        one: "1 Contact",
      },
      deals: {
        many: "%{smart_count} deals",
        one: "1 deal",
      },
      aside: {
        additional_info: "Additional info",
        company_info: "Company info",
        context: "Context",
        main_address: "Main address",
      },
      fields: {
        name: "Company name",
        website: "Website",
        linkedin_url: "LinkedIn URL",
        phone_number: "Phone number",
        created_at: "Created at",
        nb_contacts: "Number of contacts",
        revenue: "Revenue",
        sector: "Sector",
        size: "Size",
        tax_identifier: "Tax Identifier",
        address: "Address",
        city: "City",
        zipcode: "Zip code",
        state_abbr: "State",
        country: "Country",
        description: "Description",
        context_links: "Context links",
      },
      filters: {
        only_mine: "Only companies I manage",
        sector: "Sector",
        size: "Size",
      },
      sizes: {
        one_employee: "1 employee",
        two_to_nine_employees: "2-9 employees",
        ten_to_forty_nine_employees: "10-49 employees",
        fifty_to_two_hundred_forty_nine_employees: "50-249 employees",
        two_hundred_fifty_or_more_employees: "250 or more employees",
      },
      autocomplete: {
        create_error: "An error occurred while creating the company",
        create_item: "Create %{item}",
        create_label: "Start typing to create a new company",
      },
    },
    contacts: {
      action: {
        add: "Add contact",
        add_first: "Add your first contact",
        edit: "Edit contact",
        export_vcard: "Export to vCard",
        new: "New Contact",
        show: "Show contact",
      },
      background: {
        last_activity_on: "Last activity on %{date}",
        added_on: "Added on",
        followed_by: "Followed by",
      },
      empty: {
        description: "It seems your contact list is empty.",
        title: "No contacts found",
      },
      import: {
        button: "Import CSV",
        complete:
          "Contacts import complete. Imported %{importCount} contacts, with %{errorCount} errors",
        error:
          "Failed to import this file, please make sure your provided a valid CSV file.",
        imported: "Imported",
        remaining_time: "Estimated remaining time:",
        running: "The import is running, please do not close this tab.",
        sample_download: "Download CSV sample",
        sample_hint: "Here is a sample CSV file you can use as a template",
        stop: "Stop import",
        csv_file: "CSV File",
        contacts_label: "contact |||| contacts",
      },
      inputs: {
        background_info_short: "Background info",
        first_name: "First name",
        last_name: "Last name",
        email: "Email",
        identity: "Identity",
        personal_info: "Personal info",
        phone_number: "Phone number",
        position: "Position",
        title: "Title",
        company: "Company",
        email_addresses: "Email addresses",
        phone_numbers: "Phone numbers",
        linkedin_url: "LinkedIn URL",
        background_info: "Background info (bio, how you met, etc)",
        has_newsletter: "Has newsletter",
        subscribed_newsletter: "Subscribed to newsletter",
        genders: {
          male: "He/Him",
          female: "She/Her",
          nonbinary: "They/Them",
        },
        personal_info_types: {
          work: "Work",
          home: "Home",
          other: "Other",
        },
      },
      list: {
        error_loading: "Error loading contacts",
      },
      fields: {
        first_name: "First name",
        last_name: "Last name",
        last_seen: "Last seen",
      },
      merge: {
        action: "Merge with another contact",
        confirm: "Merge Contacts",
        current_contact: "Current Contact (will be deleted)",
        description: "Merge this contact with another one.",
        error: "Failed to merge contacts",
        merging: "Merging...",
        no_additional_data: "No additional data to merge",
        select_target: "Please select a contact to merge with",
        success: "Contacts merged successfully",
        target_contact: "Target Contact (will be kept)",
        title: "Merge Contact",
        warning_description:
          "All data will be transferred to the second contact. This action cannot be undone.",
        warning_title: "Warning: Destructive Operation",
        what_will_be_merged: "What will be merged:",
      },
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
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
    dashboard: {
      deals_chart: "Upcoming Deal Revenue",
      deals_pipeline: "Deals Pipeline",
      latest_activity: "Latest Activity",
      latest_activity_error: "Error loading latest activity",
      latest_notes: "My Latest Notes",
      stepper: {
        install: "Install Atomic CRM",
        progress: "%{step}/3 done",
        whats_next: "What's next?",
      },
      upcoming_tasks: "Upcoming Tasks",
      welcome: {
        paragraph_1:
          "is a template designed to help you quickly build your own CRM.",
        paragraph_2:
          "This demo runs on a mock API, so you can explore and modify the data. It resets on reload. The full version uses Supabase for the backend.",
        paragraph_3:
          ", Atomic CRM is fully open-source. You can find the code at",
        powered_by: "Powered by",
        title: "Your CRM Starter Kit",
      },
    },
    deals: {
      action: {
        back_to_deal: "Back to deal",
        create: "Create deal",
        new: "New Deal",
      },
      archived: {
        action: "Archive",
        error: "Error: deal not archived",
        list_title: "Archived Deals",
        success: "Deal archived",
        title: "Archived Deal",
        view: "View archived deals",
      },
      edit: {
        title: "Edit %{name} deal",
      },
      fields: {
        budget: "Budget",
        category: "Category",
        expected_closing_date: "Expected closing date",
        stage: "Stage",
        description: "Description",
      },
      inputs: {
        linked_to: "Linked to",
        name: "Deal name",
        contacts: "Contacts",
        category: "Category",
      },
      unarchived: {
        action: "Send back to the board",
        error: "Error: deal not unarchived",
        success: "Deal unarchived",
      },
      updated: "Deal updated",
      name: "Deal |||| Deals",
      empty: {
        before_create: "before creating a deal.",
        description: "It seems your deal list is empty.",
        title: "No deals found",
      },
      filters: {
        company: "Company",
      },
      stage: {
        lost: "Lost",
        won: "Won",
      },
    },
    header: {
      import_data: "Import data",
    },
    image_editor: {
      change: "Change",
      drop_hint: "Drop a file to upload, or click to select it.",
      editable_content: "Editable content",
      title: "Upload and resize image",
      update_image: "Update Image",
    },
    import: {
      action: {
        download_error_report: "Download the error report",
        import: "Import",
        import_another: "Import another file",
      },
      error: {
        unable: "Unable to import this file.",
      },
      idle: {
        description_1:
          "You can import sales, companies, contacts, companies, notes, and tasks.",
        description_2:
          "Data must be in a JSON file matching the following sample:",
      },
      status: {
        all_success: "All records were imported successfully.",
        complete: "Import complete.",
        failed: "Failed",
        imported: "Imported",
        in_progress:
          "Import in progress, please don't navigate away from this page.",
        some_failed: "Some records were not imported.",
        table_caption: "Import status",
      },
      title: "Import Data",
    },
    notes: {
      action: {
        add: "Add note",
        add_first: "Add your first note",
        delete: "Delete note",
        edit: "Edit note",
        update: "Update note",
        add_this: "Add this note",
      },
      sheet: {
        create: "Create note",
        create_for: "Create note for",
        edit: "Edit note",
        edit_for: "Edit note for",
      },
      deleted: "Note deleted",
      empty: "No notes yet",
      feed: {
        added: "added a note",
      },
      list: {
        error_loading: "Error loading notes",
      },
      note_for: "Note for",
      stepper: {
        hint: "Go to a contact page and add a note",
      },
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      added: "Note added",
      inputs: {
        add_note: "Add a note",
        attachments: "Attachments",
        date: "Date",
        options_hint: "(attach files, or change details)",
        reference_contact: "Contact",
        reference_deal: "Deal",
        status: "Status",
        show_options: "Show options",
      },
    },
    sales: {
      create: {
        error: "An error occurred while creating the user.",
        success:
          "User created. They will soon receive an email to set their password.",
        title: "Create a new user",
      },
      edit: {
        error: "An error occurred. Please try again.",
        record_not_found: "Record not found",
        success: "User updated successfully",
        title: "Edit %{name}",
      },
      name: "User |||| Users",
      action: {
        new: "New user",
      },
      fields: {
        first_name: "First name",
        last_name: "Last name",
        email: "Email",
        admin: "Admin",
        disabled: "Disabled",
      },
    },
    settings: {
      companies: {
        sectors: "Sectors",
      },
      dark_mode_logo: "Dark Mode Logo",
      deals: {
        categories: "Categories",
        pipeline_help:
          "Select which deal stages should count as pipeline deals.",
        pipeline_statuses: "Pipeline Statuses",
        stages: "Stages",
      },
      light_mode_logo: "Light Mode Logo",
      notes: {
        statuses: "Statuses",
      },
      reset_defaults: "Reset to Defaults",
      save_error: "Failed to save configuration",
      saved: "Configuration saved successfully",
      saving: "Saving...",
      tasks: {
        types: "Types",
      },
      title: "Settings",
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
      validation: {
        duplicate: "Duplicate %{display_name}: %{items}",
        in_use:
          "Cannot remove %{display_name} that are still used by deals: %{items}",
        validating: "Validating…",
        entities: {
          categories: "categories",
          stages: "stages",
        },
      },
    },
    tasks: {
      action: {
        add: "Add task",
        create: "Create task",
        edit: "Edit task",
      },
      actions: {
        postpone_next_week: "Postpone to next week",
        postpone_tomorrow: "Postpone to tomorrow",
        title: "task actions",
      },
      added: "Task added",
      deleted: "Task deleted successfully",
      dialog: {
        create: "Create task",
        create_for: "Create task for",
      },
      sheet: {
        edit: "Edit task",
        edit_for: "Edit task for",
      },
      empty: "No tasks yet",
      empty_list_hint: "Tasks added to your contacts will appear here.",
      fields: {
        due: "due",
        due_date: "Due date",
        description: "Description",
        type: "Type",
      },
      filters: {
        later: "Later",
        overdue: "Overdue",
        this_week: "This week",
        today: "Today",
        tomorrow: "Tomorrow",
        with_pending: "With pending tasks",
      },
      updated: "Task updated",
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
    },
    theme: {
      dark: "Dark theme",
      dark_short: "Dark",
      light: "Light theme",
      light_short: "Light",
      system: "System theme",
      system_short: "System",
      toggle: "Toggle theme",
    },
    language: "Language",
    navigation: {
      label: "CRM navigation",
    },
    tags: {
      name: "Tag |||| Tags",
      action: {
        add: "Add tag",
        create_new: "Create new tag",
      },
      dialog: {
        color: "Color",
        create_title: "Create a new tag",
        edit_title: "Edit tag",
        name_label: "Tag name",
        name_placeholder: "Enter tag name",
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
      record_not_found: "Record not found",
      title: "Profile",
      updated: "Your profile has been updated",
      update_error: "An error occurred. Please try again",
    },
    validation: {
      invalid_url: "Must be a valid URL",
      invalid_linkedin_url: "URL must be from linkedin.com",
    },
  },
} as const;

type MessageSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? MessageSchema<T[K]>
      : never;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export type CrmMessages = MessageSchema<typeof englishCrmMessages>;
export type PartialCrmMessages = DeepPartial<CrmMessages>;
