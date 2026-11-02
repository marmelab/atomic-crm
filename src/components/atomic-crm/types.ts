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
  secondary_emails?: string[];
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  role?: SalesRole;
  disabled: boolean;
};

/** admin: everything; manager: all leads + team tools; bde: own leads only. */
export type SalesRole = "admin" | "manager" | "bde";

export type LeadStage =
  | "new"
  | "queued"
  | "in_progress"
  | "interested"
  | "recycled"
  | "not_interested";

export type CallOutcome =
  "interested" | "callback" | "no_answer" | "not_interested";

export type ImportBatch = {
  created_at: string;
  created_by?: Identifier | null;
  file_name?: string | null;
  total_rows: number;
  created_count: number;
  duplicate_count: number;
  invalid_count: number;
} & Pick<RaRecord, "id">;

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  role?: SalesRole;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  secondary_emails?: string[];

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
  lead_date?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  pitch_point?: string | null;
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
  nb_tasks?: number;
  company_name?: string;
  whatsapp_number?: string | null;
  is_primary?: boolean;
  /** Lead lifecycle; null when the contact is not a calling lead. */
  lead_stage?: LeadStage | null;
  retry_count?: number;
  last_attempt_at?: string | null;
  next_attempt_at?: string | null;
  last_outcome?: CallOutcome | null;
  recycled_at?: string | null;
  recycle_reason?: string | null;
  assigned_to?: Identifier | null;
  assigned_at?: string | null;
  import_batch_id?: Identifier | null;
  phone_e164?: string | null;
  do_not_contact?: boolean;
  company_sector?: string | null;
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
  categories: string[];
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

export type BrochureStatus = "pending" | "approved" | "not_approved";

export type Brochure = {
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  title?: string | null;
  brochure_url?: string | null;
  status: BrochureStatus;
  created_at: string;
  updated_at: string;
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
  created_at?: string;
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

export type SearchResourceName =
  "companies" | "contacts" | "deals" | "tasks" | "contact_notes" | "deal_notes";

export type SearchResult = {
  resource: SearchResourceName;
  record_id: Identifier;
  title: string | null;
  subtitle: string | null;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  date: string | null;
  /** The searched fields, to show and highlight where the query matched. */
  content: string | null;
};
