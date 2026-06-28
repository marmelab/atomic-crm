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
  role: UserRole;
  disabled: boolean;
};

export type UserRole = "admin" | "sales_manager" | "lead_researcher" | "viewer";

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  role: UserRole;
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
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
  assigned_to_user_id?: Identifier | null;
  created_by_user_id?: Identifier | null;
  last_updated_by_user_id?: Identifier | null;
  research_status?: ResearchStatus;
  icp_score?: number | null;
  trigger_reason?: string | null;
  ready_for_review?: boolean;
  approved_for_instantly?: boolean;
  reviewed_by_user_id?: Identifier | null;
  review_notes?: string | null;
} & Pick<RaRecord, "id">;

export type ResearchStatus =
  | "new"
  | "researching"
  | "enriched"
  | "verified"
  | "ready_for_review"
  | "approved_for_instantly"
  | "needs_fixing"
  | "rejected"
  | "in_campaign"
  | "replied"
  | "bad_fit";

export type EmailVerificationStatus =
  | "Valid"
  | "Invalid"
  | "Catch-all"
  | "Unknown";

// Result of a MyEmailVerifier check, persisted alongside each email in
// `email_jsonb` (schemaless JSONB — no DB migration needed).
export type EmailVerification = {
  status: EmailVerificationStatus;
  diagnosis?: string;
  roleBased?: boolean;
  disposable?: boolean;
  freeDomain?: boolean;
  checkedAt: string; // ISO timestamp
};

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
  verification?: EmailVerification;
};

// One entry per email returned by the `verifyEmails` data-provider method.
export type EmailVerificationResult = {
  email: string;
  verification: EmailVerification | null;
  error?: string;
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

// Furthest-along outreach state for a contact (denormalized for quick display).
export type OutreachStatus =
  | "not_contacted"
  | "queued"
  | "emailed"
  | "opened"
  | "replied"
  | "interested"
  | "meeting_booked"
  | "closed"
  | "bounced"
  | "unsubscribed"
  | "not_interested"
  | "wrong_person";

// A single timestamped outreach event (one row per Instantly webhook / push).
export type OutreachEventType =
  | "queued"
  | "emailed"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "interested"
  | "not_interested"
  | "neutral"
  | "meeting_booked"
  | "closed"
  | "unsubscribed"
  | "wrong_person";

export type OutreachEvent = {
  contact_id: Identifier;
  type: OutreachEventType;
  campaign?: string | null;
  summary?: string | null;
  occurred_at: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
} & Pick<RaRecord, "id">;

// A campaign returned by the Instantly API (CRM → Instantly push target).
export type InstantlyCampaign = {
  id: string;
  name: string;
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: number[];
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  outreach_status?: OutreachStatus;
  last_emailed_at?: string | null;
  last_outreach_at?: string | null;
  instantly_campaign?: string | null;
  nb_tasks?: number;
  company_name?: string;
  company_website?: string | null;
  company_linkedin_url?: string | null;
  company_size?: number | null;
  assigned_to_user_id?: Identifier | null;
  created_by_user_id?: Identifier | null;
  last_updated_by_user_id?: Identifier | null;
  research_status?: ResearchStatus;
  icp_score?: number | null;
  trigger_reason?: string | null;
  email_verified?: boolean;
  ready_for_review?: boolean;
  approved_for_instantly?: boolean;
  reviewed_by_user_id?: Identifier | null;
  review_notes?: string | null;
} & Pick<RaRecord, "id">;

export type DailyResearchActivity = {
  user_id: Identifier;
  date: string;
  companies_added: number;
  contacts_found: number;
  emails_verified: number;
  crm_records_updated: number;
  ready_for_instantly: number;
  bad_fits_removed: number;
  blockers?: string | null;
  tomorrow_plan?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type AiCommandStatus =
  | "pending"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "rejected"
  | "expired";

export type AiSourceType =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "manual"
  | "system";

export type AiCommand = {
  idempotency_key?: string | null;
  command_hash?: string | null;
  source_ai: AiSourceType;
  command_type: "create_luke_task";
  target_entity_type?: string | null;
  target_entity_id?: Identifier | null;
  payload: Record<string, unknown>;
  status: AiCommandStatus;
  requires_approval: boolean;
  approved_by_user_id?: Identifier | null;
  approved_at?: string | null;
  executed_at?: string | null;
  execution_result?: Record<string, unknown> | null;
  error_message?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type AiCommandCreateInput = {
  source_ai: AiSourceType;
  command_type: "create_luke_task";
  target_entity_type?: string | null;
  target_entity_id?: Identifier | null;
  idempotency_key?: string | null;
  payload: Record<string, unknown>;
};

export type AiAuditEvent = {
  command_id?: Identifier | null;
  source_ai?: AiSourceType | null;
  action: string;
  entity_type?: string | null;
  entity_id?: Identifier | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
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
  title?: string | null;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
  priority?: "low" | "medium" | "high" | "urgent";
  source?: "manual" | "ai_command" | "instantly_webhook" | "system";
  source_command_id?: Identifier | null;
  linked_entity_type?: string | null;
  linked_entity_id?: Identifier | null;
  success_definition?: string | null;
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
