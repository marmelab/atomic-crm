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
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier | null;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
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
  tags: Identifier[];
  gender: string;
  sales_id?: Identifier | null;
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

// --- Band CRM Types ---

/**
 * Venue - Physical performance location
 * Separate from Company (which is the hiring entity)
 */
export type Venue = {
  name: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  capacity?: number;
  stage_size?: string;
  parking_info?: string;
  load_in_notes?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

/**
 * Gig - Extends Deal with band-specific fields
 * Includes venue reference and performance details
 */
export type Gig = Deal & {
  venue_id?: Identifier;
  // Joined from deals_summary view
  venue_name?: string;
  venue_city?: string;
  venue_address?: string;
  // Gig-specific fields
  performance_date?: string;
  start_time?: string;
  end_time?: string;
  set_count?: number;
  fee?: number;
  deposit?: number;
  deposit_paid?: boolean;
  travel_expenses?: number;
  quote_sent_at?: string;
  invoice_sent_at?: string;
};

/**
 * GigMember - Band member assigned to a specific gig
 */
export type GigMember = {
  gig_id: Identifier;
  sales_id: Identifier;
  role?: string;
  confirmed: boolean;
  created_at?: string;
  // Joined fields
  sales_name?: string;
  sales_email?: string;
} & Pick<RaRecord, "id">;

/**
 * Song - Entry in the band's songbook
 */
export type Song = {
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  duration?: number; // seconds
  genre?: string;
  notes?: string;
  lyrics_url?: string;
  chart_url?: string;
  tags?: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

/**
 * SetListTemplate - Reusable set list template
 */
export type SetListTemplate = {
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

/**
 * SetList - Set list for a specific gig or template
 */
export type SetList = {
  gig_id?: Identifier;
  template_id?: Identifier;
  name: string;
  position: number;
  created_at?: string;
  songs?: SetListSong[]; // Hydrated
} & Pick<RaRecord, "id">;

/**
 * SetListSong - Individual song in a set list
 */
export type SetListSong = {
  set_list_id: Identifier;
  song_id: Identifier;
  position: number;
  notes?: string;
  created_at?: string;
  // Joined from song
  title?: string;
  artist?: string;
  key?: string;
  duration?: number;
} & Pick<RaRecord, "id">;

/**
 * QuoteTemplate - Reusable quote template with Handlebars variables
 */
export type QuoteTemplate = {
  name: string;
  body_html: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

/**
 * GigQuote - Generated quote for a specific gig
 */
export type GigQuote = {
  gig_id: Identifier;
  template_id?: Identifier;
  rendered_html: string;
  sent_at?: string;
  accepted_at?: string;
  version: number;
  created_at?: string;
} & Pick<RaRecord, "id">;
