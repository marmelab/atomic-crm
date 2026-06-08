import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  email?: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: (string | { url: string; title: string; source: string })[];
  nb_contacts?: number;
  nb_deals?: number;
  // Swedish CRM fields
  org_number?: string;
  google_business_url?: string;
  has_website?: boolean;
  website_quality?: "none" | "poor" | "ok" | "good";
  source?:
    | "google_maps"
    | "import"
    | "hitta"
    | "allabolag"
    | "eniro"
    | "manual"
    | "referral"
    | "field";
  lead_status?:
    | "new"
    | "contacted"
    | "no_response"
    | "info_sent"
    | "send_info"
    | "interested"
    | "meeting_booked"
    | "proposal_sent"
    | "closed_won"
    | "closed_lost"
    | "not_interested"
    | "bad_fit";
  next_followup_date?: string;
  assigned_to?: string;
  tags?: string[];
  industry?: string;
  employees_estimate?: number;
  // Enrichment fields
  lead_score?: number;
  enrichment_data?: Record<string, unknown>;
  enriched_at?: string;
  segment?: "hot_lead" | "warm_lead" | "cold_lead" | "nurture" | "disqualified";
  facebook_url?: string;
  instagram_url?: string;
  has_facebook?: boolean;
  has_instagram?: boolean;
  website_score?: number;
  // Operational fields
  owner_sales_id?: Identifier;
  last_touch_at?: string;
  last_touch_type?: "call" | "email" | "meeting" | "note" | "quote";
  next_action_at?: string;
  next_action_type?:
    | "call"
    | "email"
    | "meeting"
    | "follow_up"
    | "send_quote"
    | "other";
  next_action_note?: string;
  pipeline_state?:
    | "new"
    | "qualified"
    | "contact_attempted"
    | "contacted"
    | "meeting_booked"
    | "proposal_pending"
    | "negotiation"
    | "won"
    | "lost"
    | "nurture";
  priority_score?: number;
  data_quality_status?:
    | "complete"
    | "missing_contact"
    | "possible_duplicate"
    | "missing_owner"
    | "missing_next_step";
  import_source_id?: Identifier | null;
  import_run_id?: Identifier | null;
  source_row_number?: number | null;
  processing_order?: number | null;
  prospecting_status?:
    | "imported"
    | "enriching"
    | "call_ready"
    | "needs_review"
    | "completed"
    | "disqualified";
} & Pick<RaRecord, "id">;

export type ImportFilterConfig = {
  min_revenue_kkr?: number | null;
  exclude_holding?: boolean;
  exclude_name_keywords?: string[];
  exclude_org_forms?: string[];
  min_employees?: number | null;
  max_employees?: number | null;
  include_verksamhet_keywords?: string[];
  exclude_verksamhet_keywords?: string[];
  pre_qualify_website?: boolean;
};

export type LeadImportSource = {
  name: string;
  source_type: "google_sheet_csv";
  sheet_url: string;
  sheet_gid?: string | null;
  is_active: boolean;
  batch_size_default: number;
  last_imported_row: number;
  last_successful_run_at?: string | null;
  last_run_status: "idle" | "running" | "success" | "partial" | "failed";
  last_run_message?: string | null;
  filter_config?: ImportFilterConfig;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type LeadImportRun = {
  source_id: Identifier;
  triggered_by: "manual" | "scheduled";
  requested_batch_size: number;
  actual_batch_size: number;
  started_at: string;
  finished_at?: string | null;
  rows_scanned: number;
  rows_inserted: number;
  rows_skipped_duplicates: number;
  rows_skipped_filtered: number;
  rows_failed: number;
  sheet_writeback_status: "not_attempted" | "success" | "partial" | "failed";
  sheet_rows_marked: number;
  sheet_rows_failed: number;
  sheet_writeback_error?: string | null;
  status: "running" | "success" | "partial" | "failed";
  error_summary?: string | null;
  imported_company_ids?: number[];
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name?: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: Identifier[];
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  contact_ids: Identifier[];
  category: string;
  stage: string;
  description: string;
  amount: number;
  recurring_amount?: number | null;
  recurring_interval?: "monthly" | "quarterly" | "yearly" | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  sales_id: Identifier;
  index: number;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type CalendarEventAttendee = {
  name?: string;
  email: string;
};

export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export type CalendarEventSource = "crm" | "calcom" | "google";

export type CalendarMeetingProvider = "google_meet";

export type CalendarEvent = {
  id: Identifier;
  title: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  time_zone?: string;
  contact_id?: Identifier | null;
  company_id?: Identifier | null;
  sales_id?: Identifier | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  google_event_id?: string | null;
  calcom_event_id?: string | null;
  meeting_provider: CalendarMeetingProvider;
  meet_link?: string | null;
  attendees?: CalendarEventAttendee[];
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type CallLog = {
  company_id: Identifier;
  contact_id?: Identifier | null;
  user_id?: string;
  call_outcome:
    | "none"
    // 7 Relationsstatus outcomes
    | "hot_lead"
    | "active_customer"
    | "under_negotiation"
    | "follow_up"
    | "never_contacted"
    | "contacted_no_response"
    | "not_interested"
    // Legacy outcomes (historical data)
    | "no_answer"
    | "busy"
    | "wrong_number"
    | "spoke_gatekeeper"
    | "spoke_decision_maker"
    | "interested"
    | "meeting_booked"
    | "send_info"
    | "callback_requested";
  notes?: string;
  call_duration_seconds?: number;
  followup_date?: string;
  followup_note?: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type QuoteStatus =
  | "draft"
  | "generated"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired";

export type QuoteHighlightCard = {
  icon: string;
  title: string;
  text: string;
};

export type QuoteProblemCard = {
  number: string;
  title: string;
  text: string;
};

export type QuoteUpgradePackage = {
  title: string;
  description: string;
  price: string;
  includes: string[];
  benefits: string[];
} | null;

export type QuoteProcessStep = {
  number: string;
  title: string;
  text: string;
};

export type QuoteSupportCard = {
  icon: string;
  title: string;
  text: string;
};

export type QuoteTechItem = {
  icon: string;
  title: string;
  text: string;
};

export type QuoteFounderCard = {
  initials: string;
  name: string;
  role: string;
  description: string;
};

export type QuoteAboutFact = {
  value: string;
  label: string;
};

export type QuoteGeneratedSections = {
  summary_pitch: string;
  highlight_cards: QuoteHighlightCard[];
  design_demo_description?: string | null;
  proposal_body: string;
  problem_cards?: QuoteProblemCard[];
  problem_section_title?: string;
  package_includes?: string[];
  package_section_title?: string;
  package_section_text?: string;
  upgrade_package?: QuoteUpgradePackage;
  process_steps?: QuoteProcessStep[];
  process_section_title?: string;
  process_section_text?: string;
  support_cards?: QuoteSupportCard[];
  support_section_title?: string;
  tech_items?: QuoteTechItem[];
  tech_section_title?: string;
  founders?: QuoteFounderCard[];
  about_section_title?: string;
  about_section_text?: string;
  reference_section_title?: string;
  reference_section_text?: string;
  reference_projects?: Array<{
    title: string;
    description: string;
    type: string;
  }>;
  price_summary_bullets?: string[];
  recurring_amount?: number | null;
  recurring_interval?: "monthly" | "quarterly" | "yearly" | null;
  // Kat. B — copy keys that were hardcoded literals in premiumSections.ts
  upgrade_benefits_title?: string;
  reference_cta_label?: string;
  about_facts?: QuoteAboutFact[];
  price_summary_title?: string;
  terms_section_title?: string;
};

export type QuoteReferenceImage = {
  title: string;
  url: string;
  link: string;
  type: string;
  description: string;
};

export type Quote = {
  title: string;
  quote_number?: string;
  template_type?: string;
  company_id: Identifier;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  sales_id?: Identifier;
  status: QuoteStatus;
  generated_text?: string;
  custom_text?: string;
  generated_sections?: QuoteGeneratedSections | null;
  accent_color?: string;
  reference_images?: QuoteReferenceImage[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  discount_percent: number;
  total_amount: number;
  currency: string;
  payment_terms?: string;
  delivery_terms?: string;
  customer_reference?: string;
  terms_and_conditions?: string;
  notes_internal?: string;
  valid_until?: string;
  docuseal_submission_id?: string;
  docuseal_document_url?: string;
  pdf_url?: string;
  approval_token?: string;
  signed_at?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type QuoteLineItem = {
  quote_id: Identifier;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
  total: number;
  sort_order: number;
  created_at: string;
} & Pick<RaRecord, "id">;

export type SalesEntry = {
  amount: number;
  period_type: "day" | "week" | "month";
  period_date: string;
  description?: string;
  sales_id: Identifier;
  deal_id?: Identifier | null;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export type MeetingTranscription = {
  id: Identifier;
  calendar_event_id: Identifier | null;
  contact_id: Identifier | null;
  company_id: Identifier | null;
  transcription_text: string;
  transcription_source: "manual" | "fireflies" | "whisper" | "google_meet";
  analysis: {
    summary: string;
    customer_needs: string[];
    objections: string[];
    action_items: Array<{
      text: string;
      assignee: string;
      due_days: number;
    }>;
    quote_context: {
      services_discussed: string[];
      budget_mentioned: string | null;
      timeline: string | null;
      decision_makers: string[];
      next_steps: string;
    };
    sentiment: "positive" | "neutral" | "negative";
    deal_probability: number;
  } | null;
  analyzed_at: string | null;
  fireflies_meeting_id: string | null;
  fireflies_data: {
    title: string;
    date: string;
    duration: number;
    transcript_url: string;
    audio_url: string;
    meeting_attendees: Array<{ displayName: string; email: string }>;
    summary: {
      keywords: string[];
      action_items: string[];
      overview: string;
      short_summary: string;
      topics_discussed: string[];
    };
    sentiments: {
      positive_pct: number;
      neutral_pct: number;
      negative_pct: number;
    };
  } | null;
  created_at: string;
  updated_at: string;
};

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// Feedback inbox ("chatt-widget") — delad teaminkorg för feedback om CRM:t självt.
export type FeedbackCategory = "works" | "bug" | "request";
export type FeedbackStatus = "open" | "done";

export type FeedbackItem = {
  text: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  page_context?: string | null;
  sales_id: Identifier;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;
