export const englishCrmMessages = {
  resources: {
    companies: {
      name: "Company |||| Companies",
      forcedCaseName: "Company",
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
      empty: {
        description: "It seems your company list is empty.",
        title: "No companies found",
      },
      field_categories: {
        contact: "Contact",
        additional_info: "Additional information",
        address: "Address",
        context: "Context",
      },
      action: {
        create: "Create Company",
        edit: "Edit company",
        new: "New Company",
        show: "Show company",
      },
      added_on: "Added on %{date}",
      followed_by: "Followed by %{name}",
      followed_by_you: "Followed by you",
      no_contacts: "No contact",
      nb_contacts: "%{smart_count} contact |||| %{smart_count} contacts",
      nb_deals: "%{smart_count} deal |||| %{smart_count} deals",
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
      name: "Contact |||| Contacts",
      forcedCaseName: "Contact",
      field_categories: {
        background_info: "Background info",
        identity: "Identity",
        misc: "Misc",
        personal_info: "Personal info",
        position: "Position",
      },
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
      action: {
        add: "Add contact",
        add_first: "Add your first contact",
        create: "Create contact",
        edit: "Edit contact",
        export_vcard: "Export to vCard",
        new: "New Contact",
        show: "Show contact",
      },
      background: {
        last_activity_on: "Last activity on %{date}",
        added_on: "Added on %{date}",
        followed_by: "Followed by %{name}",
        followed_by_you: "Followed by you",
        status_none: "None",
      },
      position_at: "%{title} at",
      position_at_company: "%{title} at %{company}",
      sales_eligibility: {
        do_not_engage: "Do Not Engage",
      },
      empty: {
        description: "It seems your contact list is empty.",
        title: "No contacts found",
      },
      import: {
        title: "Import contacts",
        button: "Import CSV",
        complete:
          "Contacts import complete. Imported %{importCount} contacts, with %{errorCount} errors",
        progress:
          "Imported %{importCount} / %{rowCount} contacts, with %{errorCount} errors.",
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
      bulk_tag: {
        action: "Tag",
        back: "Back to tags",
        create_description:
          "Create a new tag and apply it to the selected contacts.",
        description:
          "Choose an existing tag or create a new one for the selected contacts.",
        empty: "No tags yet. Create one to tag the selected contacts.",
        error: "Failed to add tag to contacts",
        noop: "Selected contacts already have this tag",
        success:
          "Tag added to %{smart_count} contact |||| Tag added to %{smart_count} contacts",
        title: "Add tag to contacts",
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
      filters: {
        search: "Search name, company...",
        tasks: "Tasks",
        relationship: "Relationship",
        current_client: "Current Client",
        past_client: "Past Client",
        applicant: "Applicant",
        waitlist: "Waitlist",
        nurture: "Nurture",
        sales_eligibility: "Sales Eligibility",
        eligibility_normal: "Normal",
        eligibility_dne: "Do Not Engage",
        offer_history: "Offer History",
      },
      hot: {
        empty_change_status:
          'Change the status of a contact by adding a note to that contact and clicking on "show options".',
        empty_hint: 'Contacts with a "hot" status will appear here.',
        title: "Hot Contacts",
      },
    },
    deals: {
      name: "Opportunity |||| Opportunities",
      pipeline_orientation:
        "Everyone currently moving toward a yes/no on an offer.",
      fields: {
        name: "Name",
        description: "Description",
        company_id: "Company",
        contact_id: "Contact",
        category: "Category",
        offer_id: "Offer",
        cohort_id: "Cohort",
        selected_payment_option_id: "Payment option",
        amount: "Potential value",
        expected_closing_date: "Expected closing date",
        stage: "Stage",
        outcome: "Outcome",
        owner_decision: "Owner decision",
        prospect_decision: "Prospect decision",
        follow_up_date: "Follow-up date",
        sales_call_at: "Sales call",
        source: "Source",
        entry_path: "Entry path",
      },
      outcome_none: "No outcome",
      source_none: "Unknown",
      entry_path_none: "Unknown",
      owner_decision_none: "Not decided yet",
      prospect_decision_none: "Not decided yet",
      action: {
        back_to_deal: "Back to opportunity",
        create: "Create opportunity",
        new: "New Opportunity",
      },
      field_categories: {
        misc: "Misc",
        sales_process: "Sales process",
      },
      archived: {
        action: "Archive",
        error: "Error: opportunity not archived",
        list_title: "Archived Opportunities",
        success: "Opportunity archived",
        title: "Archived Opportunity",
        view: "View archived opportunities",
      },
      person_input: {
        label: "Person",
        placeholder: "Search by name or email…",
        create_label: "Add a new person",
        create_item_label: 'Add "%{item}" as a new person',
        create_error: "An error occurred while creating the person",
        do_not_engage_title: "Do Not Engage",
        do_not_engage_error:
          "This person is marked Do Not Engage — a new Opportunity can't be created for them.",
      },
      unarchived: {
        action: "Send back to the board",
        error: "Error: opportunity not unarchived",
        success: "Opportunity unarchived",
      },
      updated: "Opportunity updated",
      empty: {
        before_create: "before creating an opportunity.",
        description: "It seems your opportunity list is empty.",
        title: "No opportunities found",
      },
      invalid_date: "Invalid date",
      sales_call: {
        name: "Sales Call",
        status_cancelled: "Cancelled",
        rescheduled_count: "rescheduled %{count}×",
        complete_title: "Complete Sales Call",
        complete_description: "%{name}'s sales call",
        complete_action: "Complete Sales Call",
        completed: "Sales call completed.",
        already_completed: "This call's outcome was already recorded.",
        attendance: "Attendance",
        owner_fit_question: "Would I work with this person?",
        prospect_decision_question: "Their decision",
        follow_up_on: "Follow up on",
      },
    },
    offers: {
      name: "Offer |||| Offers",
      fields: {
        name: "Name",
        type: "Type",
        duration: "Duration",
        current_price: "Current price",
        max_active_clients: "Max active clients",
        is_active: "Active",
      },
      action: {
        create: "Create Offer",
      },
      active: "Active",
      inactive: "Inactive",
    },
    offer_payment_options: {
      name: "Payment option |||| Payment options",
      fields: {
        name: "Name",
        total: "Total",
        installments: "Installments",
        installment_amount: "Installment amount",
      },
      authorized_only: "Authorized only",
    },
    cohorts: {
      name: "Cohort |||| Cohorts",
      orientation:
        "Group-program rounds, including who's enrolled and still deciding.",
      fields: {
        name: "Name",
        offer_id: "Offer",
        status: "Status",
        applications_open_at: "Applications open",
        applications_close_at: "Applications close",
        program_start_at: "Program start",
        program_end_at: "Program end",
        minimum_capacity: "Minimum",
        target_capacity: "Target",
        maximum_capacity: "Maximum",
      },
      action: {
        new: "New Cohort",
        create: "Create Cohort",
      },
      enrolled_count: "%{enrolled} / %{maximum} enrolled",
      enrolled_count_label: "Enrolled",
      people: {
        enrolled: "Enrolled Clients",
        empty: "Nobody yet.",
      },
    },
    applications: {
      name: "Application |||| Applications",
      orientation: "New applications waiting for review or decision.",
      fields: {
        contact: "Contact",
        offer: "Offer",
        cohort: "Cohort",
        opportunity: "Opportunity",
        submitted_at: "Submitted",
        status: "Status",
        raw_answers: "Answers",
      },
      action: {
        approve: "Approve",
        needs_higher_care: "Needs Higher Care",
        not_fit: "Not Fit",
        do_not_engage: "Do Not Engage",
      },
      review: {
        summary_title: "Application Summary",
        summary_empty: "No summary yet.",
        answers_title: "Application Answers",
        decision_title: "Review Decision",
        related_sales_title: "Related Sales",
        already_reviewed: "Reviewed — no further action needed.",
        already_reviewed_notice:
          "This application was already reviewed — showing the current state.",
        dne_confirm_title: "Mark %{name} as Do Not Engage?",
        dne_confirm_body:
          "This removes them from future direct sales eligibility.",
      },
      updated: "Application updated",
      empty: "No applications yet.",
      needs_review: "Needs Review",
      needs_review_empty: "Nothing waiting for review.",
      reviewed: "Reviewed Applications",
    },
    sales_calls: {
      resolve: {
        title: "Sales call needs matching",
        not_found: "This booking no longer exists.",
        no_match_title: "No matching opportunity found",
        no_match_explanation:
          "%{name} booked a sales call for %{offer}, but they don't have an open opportunity for %{offer} in the CRM.",
        match_found_title: "A matching opportunity was found",
        ambiguous_title: "More than one opportunity could match this call",
        choose_explanation:
          "%{name} booked a sales call for %{offer}. Choose the opportunity this call belongs to.",
        unknown_type_title: "Appointment type not mapped to an Offer",
        was_dismissed:
          "This booking was dismissed — it was never a sales situation.",
        was_attached: "This booking is already attached to an Opportunity.",
        attached_success: "Sales call attached ✓",
        view_opportunity: "View the Opportunity",
        attach_heading: "Attach to an existing Opportunity",
        attach: "Attach",
        attached: "Attached to the Opportunity.",
        create: "Create %{offer} opportunity",
        created: "Opportunity created.",
        unknown_type:
          "This booking's appointment type isn't mapped to an Offer yet — only Dismiss is available.",
        dismiss: "Dismiss booking",
        dismiss_reason_placeholder:
          "Why? (optional) — test booking, mistake, etc.",
      },
    },
    enrollments: {
      name: "Client |||| Clients",
      orientation: "People who completed the sales process and enrolled.",
      fields: {
        contact: "Contact",
        offer: "Offer",
        cohort: "Cohort",
        opportunity: "Opportunity",
        status: "Status",
        start_date: "Start",
        end_date: "End",
      },
      empty: "No clients yet.",
      needs_onboarding: "Needs Onboarding",
      active_clients: "Active",
      past_clients: "Past Clients",
      payment_context: "Payment",
      paid_in_full: "Paid in full.",
      onboarding_checklist: "Onboarding",
      onboarding_complete: "Onboarding complete",
      onboarding_collapsed_summary: "Onboarding · Complete %{done}/%{total}",
      optional: "Optional",
      contract_sent: "Sent",
      mark_sent: "Mark sent",
      activate: "Activate client",
      activating: "Activating…",
      activated: "Enrollment activated.",
      already_activated:
        "This Enrollment is no longer awaiting onboarding — showing the current state.",
      activation_incomplete:
        "Some required items are still incomplete — showing the current state.",
      start_offboarding: "Start offboarding",
      not_active:
        "This client is no longer active — showing the current state.",
      offboarding_started: "Offboarding started.",
      offboarding_checklist: "Offboarding",
      offboarding_collapsed_summary: "Offboarding · Complete %{done}/%{total}",
      complete_client: "Complete client",
      completing: "Completing…",
      completed: "Offboarding complete",
      already_completed:
        "This client is no longer awaiting offboarding — showing the current state.",
      completion_incomplete:
        "Some required items are still incomplete — showing the current state.",
      sessions: {
        title: "Sessions",
        orientation:
          "A booked session counts by default — no need to mark anything, unless something didn't happen as planned.",
        sessions_this_period:
          "%{fulfilled} of %{expected} sessions this period",
        next_at: "Next: %{when}",
        no_start_date: "No expected sessions assigned yet.",
        no_session_booked: "No session booked",
        needs_attention: "Needs attention",
        session_marked_no_show: "%{date} session marked no-show",
        current_period: "Current Service Period",
        session_on: "Session %{date}",
        upcoming: "Upcoming",
        resolve: "Resolve",
        history: "History",
        no_sessions_yet: "No %{offer} sessions booked yet.",
        mark_no_show: "No-show",
        undo_no_show: "Undo No-show",
        no_show: "No-show",
        rescheduled: "Rescheduled",
        not_yet_occurred: "This session hasn't happened yet.",
        cancelled_session:
          "This session was cancelled — showing the current state.",
        status: {
          booked: "Booked",
          cancelled: "Cancelled",
        },
        cadence_status: {
          known_skip: "Known skip",
          rescheduled: "Rescheduled",
          missed_ghosted: "Missed / ghosted",
        },
      },
      cadence: {
        modal_title: "What happened this week?",
        not_found: "This item no longer exists.",
        no_session_booked: "No session booked",
        session_marked_no_show: "%{date} session marked no-show",
        note_placeholder: "Note (optional)",
        currently: "Currently: %{classification}",
        clear_decision: "Clear decision",
      },
    },
    waitlist_entries: {
      name: "Waitlist |||| Waitlists",
      count: "%{count} waiting",
      empty: "Nobody waiting.",
      search_placeholder: "Search name or email…",
      search_empty: "No one matches “%{query}”.",
      fields: {
        joined_at: "Joined",
        desired_timing: "Desired timing",
        notes: "Notes",
        priority: "Priority (lower = sooner; optional)",
        source: "Source",
      },
      action: {
        add: "Add to Waitlist",
      },
      actions: {
        title: "Waitlist entry actions",
        edit: "Edit",
        mark_invited: "Mark Invited",
        convert: "Convert to Opportunity",
        remove: "Remove from Waitlist",
      },
      sheet: {
        add: "Add to Waitlist",
        edit: "Edit waitlist entry",
      },
      person_input: {
        do_not_engage_error:
          "This person is marked Do Not Engage — they can't be added to a waitlist.",
        duplicate_error: "This person is already waiting for this program.",
        create_error: "An error occurred while creating the person",
      },
      notifications: {
        invited: "Marked Invited",
        converted: "Converted to a new Opportunity",
        converted_existing: "Linked to their existing active Opportunity",
        removed: "Removed from waitlist",
        do_not_engage:
          "This person is marked Do Not Engage — they can't be converted.",
        stale: "This entry was already updated — showing the current state.",
      },
      contact_detail: {
        joined: "Joined %{date}",
        preferred: "Preferred timing: %{timing}",
        converted: "Converted %{date}",
        removed: "Removed %{date}",
      },
    },
    notes: {
      name: "Note |||| Notes",
      forcedCaseName: "Note",
      fields: {
        status: "Status",
        date: "Date",
        attachments: "Attachments",
        contact_id: "Contact",
        deal_id: "Deal",
      },
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
        create_for: "Create note for %{name}",
        edit: "Edit note",
        edit_for: "Edit note for %{name}",
      },
      deleted: "Note deleted",
      empty: "No notes yet",
      author_added: "%{name} added a note",
      you_added: "You added a note",
      me: "Me",
      list: {
        error_loading: "Error loading notes",
      },
      note_for_contact: "Note for %{name}",
      stepper: {
        hint: "Go to a contact page and add a note",
      },
      added: "Note added",
      inputs: {
        add_note: "Add a note",
        options_hint: "(attach files, or change details)",
        show_options: "Show options",
      },
      actions: {
        attach_document: "Attach document",
      },
      validation: {
        note_or_attachment_required: "A note or an attachment is required",
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
      action: {
        new: "New user",
      },
    },
    tasks: {
      name: "Task |||| Tasks",
      forcedCaseName: "Task",
      fields: {
        text: "Description",
        due_date: "Due date",
        type: "Type",
        status: "Status",
        contact_id: "Contact",
        due_short: "due",
      },
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
      completed_undoable: "Task completed — %{title}",
      // Lifecycle-Task completion durability fix: this checklist-backed
      // path has no real "undo" (unchecking goes through the SAME
      // authoritative reopen function, not a client-side rollback), so
      // its own toast never claims to be undoable.
      completed: "Task completed — %{title}",
      completed_history: "Completed tasks (%{count})",
      dialog: {
        create: "Create task",
        create_for: "Create task for %{name}",
      },
      sheet: {
        edit: "Edit task",
        edit_for: "Edit task for %{name}",
      },
      empty: "No tasks yet",
      empty_list_hint: "Tasks added to your contacts will appear here.",
      unknown_contact: "Unknown contact",
      filters: {
        later: "Later",
        overdue: "Overdue",
        this_week: "This week",
        today: "Today",
        tomorrow: "Tomorrow",
        with_pending: "With pending tasks",
      },
      updated: "Task updated",
    },
    tags: {
      name: "Tag |||| Tags",
      action: {
        add: "Add tag",
        create: "Create new tag",
      },
      dialog: {
        color: "Color",
        create_title: "Create a new tag",
        edit_title: "Edit tag",
        name_label: "Tag name",
        name_placeholder: "Enter tag name",
      },
    },
  },
  crm: {
    action: {
      reset_password: "Reset Password",
    },
    auth: {
      first_name: "First name",
      last_name: "Last name",
      confirm_password: "Confirm password",
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
      details: "Details",
      last_activity_with_date: "last activity %{date}",
      load_more: "Load more",
      misc: "Misc",
      past: "Past",
      read_more: "Read more",
      retry: "Retry",
      show_less: "Show less",
      copied: "Copied!",
      copy: "Copy",
      loading: "Loading...",
      me: "Me",
      task_count: "%{smart_count} task |||| %{smart_count} tasks",
    },
    changelog: {
      title: "Changelog",
    },
    activity: {
      added_company: "%{name} added company",
      you_added_company: "You added company",
      added_contact: "%{name} added",
      you_added_contact: "You added",
      added_note: "%{name} added a note about",
      you_added_note: "You added a note about",
      added_note_about_deal: "%{name} added a note about deal",
      you_added_note_about_deal: "You added a note about deal",
      added_deal: "%{name} added deal",
      you_added_deal: "You added deal",
      at_company: "at",
      to: "to",
      load_more: "Load more activity",
    },
    dashboard: {
      deals_chart: "Upcoming Opportunity Revenue",
      deals_pipeline: "Opportunities Pipeline",
      latest_activity: "Latest Activity",
      latest_activity_error: "Error loading latest activity",
      latest_notes: "My Latest Notes",
      latest_notes_added_ago: "added %{timeAgo}",
      stepper: {
        install: "Install Atomic CRM",
        progress: "%{step}/3 done",
        whats_next: "What's next?",
      },
      upcoming_tasks: "Upcoming Tasks",
      orientation: "What needs your attention, and how full is your business?",
      tasks_orientation:
        "Things you need to do or remember. Most are created automatically by the CRM.",
      tasks_needs_attention: "Needs Attention",
      tasks_overdue: "Overdue",
      tasks_today: "Today",
      tasks_next_7_days: "Next 7 Days",
      tasks_bucket_empty: "Nothing here.",
      tasks_load_more: "%{count} more",
      completed_today: "Completed Today",
      business_at_a_glance_title: "Business at a Glance",
      business_at_a_glance_orientation:
        "A quick look at client capacity and current programs.",
      capacity_active: "active",
      capacity_openings: "%{count} openings",
      next_opening: "Next opening: %{date}",
      next_openings_in_month: "%{count} openings in %{month}",
      capacity_enrolled: "enrolled",
      seats_remaining: "%{count} seats left",
      people_deciding_count:
        "%{smart_count} person deciding |||| %{smart_count} people deciding",
      people_deciding_title: "People Deciding",
      people_deciding_orientation:
        "Who is currently deciding and may need your attention.",
      people_deciding_empty: "Nobody is currently deciding.",
      follow_up_on: "follow up %{date}",
      art_oracle_title: "Art Oracle",
      needs_onboarding_row: "%{name} paid %{amount} — %{offer}",
      needs_onboarding_progress: "onboarding %{done}/%{total} complete",
      coming_up_title: "Coming Up",
      coming_up_orientation: "Important client and program dates ahead.",
      coming_up_empty: "No major program or client dates coming up.",
      coming_up_today: "Today",
      coming_up_le_completes: "%{names} completes |||| %{names} complete",
      coming_up_le_opening_detail:
        "%{count} Living Example opening |||| %{count} Living Example openings",
      coming_up_cohort_starts: "%{name} starts",
      coming_up_cohort_ends: "%{name} ends",
      coming_up_cohort_applications_open: "%{name} — Applications open",
      coming_up_cohort_applications_close: "%{name} — Applications close",
      coming_up_cohort_enrolled_of_max: "%{enrolled} / %{max} enrolled",
      coming_up_cohort_enrolled: "%{count} enrolled",
      coming_up_cohort_completing: "%{count} completing",
    },
    header: {
      import_data: "Import data",
      // Small polish/cleanup slice: a restrained text wordmark replacing
      // the meditation/labyrinth logo in the header chrome (desktop nav
      // and the mobile Dashboard header) — text only, no icon, no "CRM",
      // no subtitle. The logo asset/config (darkModeLogo/lightModeLogo)
      // is untouched and still used elsewhere (Settings, Login, Signup).
      wordmark: "Leif Ariel",
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
    programs: {
      name: "Programs",
      title: "Programs",
      orientation: "Your current and upcoming ways of working with clients.",
      new_program_action: "New Program",
      new_program_title: "New Program",
      new_program_choose: "How do you work with clients in this program?",
      one_on_one_program: "1:1 Program",
      one_on_one_program_hint:
        "Ongoing individual coaching, like The Living Example.",
      group_program: "Group Program",
      group_program_hint: "A cohort-based program, like Growing Yourself Up.",
      new_program_first_cohort:
        "%{offer} was created. Now set up its first Cohort.",
      one_on_one_section: "1:1 Programs",
      group_section: "Group Programs",
      no_individual_programs: "No 1:1 programs yet.",
      no_group_programs: "No group programs yet.",
      no_active_cohorts: "No active cohorts.",
      current_clients: "Current Clients",
      no_current_clients: "No current clients.",
      upcoming_openings: "Upcoming Openings",
      no_upcoming_openings: "No upcoming openings.",
      opening_count: "%{count} opening |||| %{count} openings",
      opening_completes: "%{name} completes",
      individual_not_found: "This program could not be found.",
      group_not_found: "This program could not be found.",
      cohorts_section: "Cohorts",
      cohort_details: "Cohort Details",
    },
    settings: {
      about: "About",
      companies: {
        sectors: "Sectors",
      },
      dark_mode_logo: "Dark Mode Logo",
      deals: {
        categories: "Categories",
        currency: "Currency",
        pipeline_help:
          "Select which opportunity stages should count as pipeline opportunities.",
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
      preferences: "Preferences",
      title: "Settings",
      app_title: "App Title",
      sections: {
        branding: "Branding",
      },
      validation: {
        duplicate: "Duplicate %{display_name}: %{items}",
        in_use:
          "Cannot remove %{display_name} that are still used by opportunities: %{items}",
        validating: "Validating\u2026",
        entities: {
          categories: "categories",
          stages: "stages",
        },
      },
    },
    theme: {
      dark: "Dark",
      label: "Theme",
      light: "Light",
      system: "System",
    },
    language: "Language",
    navigation: {
      label: "CRM navigation",
      more: "More",
      // Small polish/cleanup slice: the nav destination's own display
      // label — the Opportunity domain model, its resource/table name,
      // and contextual per-record language ("New Opportunity") are
      // unchanged; only this one collection-view label reads differently
      // (Header.tsx desktop tab, MobileNavigation.tsx bottom nav,
      // DealList.tsx's own page heading, so the page you land on matches
      // the tab you clicked).
      pipeline: "Pipeline",
    },
    profile: {
      inbound: {
        description:
          "You can start sending emails to your server's inbound email address, e.g. by adding it to the %{field} field. Atomic CRM will process the emails and add notes to the corresponding contacts.",
        title: "Inbound email",
      },
      mcp: {
        title: "MCP Server",
        description:
          "Use this URL to connect your AI assistant to your CRM data via the Model Context Protocol (MCP).",
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
