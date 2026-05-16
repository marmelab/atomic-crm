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
  default_hourly_rate_szl?: number | null;
} & Pick<RaRecord, "id">;

export type EswatiniEntityType =
  | "PTY_LTD"
  | "PUBLIC_CO"
  | "SOLE_PROP"
  | "PARTNERSHIP"
  | "TRUST"
  | "NGO"
  | "OTHER";

export type VatFilingFrequency = "MONTHLY" | "BIMONTHLY" | "QUARTERLY";

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
  // Eswatini compliance fields
  tin?: string | null;
  registration_number?: string | null;
  entity_type?: EswatiniEntityType | null;
  vat_registered: boolean;
  vat_filing_frequency?: VatFilingFrequency | null;
  paye_registered: boolean;
  sdl_registered: boolean;
  provisional_tax_registered: boolean;
  employees_count: number;
  financial_year_end_month: number;
  trading_license_number?: string | null;
  trading_license_expiry?: string | null;
  tax_clearance_certificate_expiry?: string | null;
} & Pick<RaRecord, "id">;

export type FilingType =
  | "VAT_RETURN"
  | "PAYE_RETURN"
  | "PROV_TAX_FIRST"
  | "PROV_TAX_SECOND"
  | "PROV_TAX_TOPUP"
  | "INCOME_TAX_COMPANY"
  | "INCOME_TAX_INDIVIDUAL"
  | "WORKMENS_COMP"
  | "TRADING_LICENSE_RENEWAL"
  | "TAX_CLEARANCE_RENEWAL"
  | "WHT_NON_RESIDENT"
  | "AFS"
  | "INDEPENDENT_REVIEW"
  | "GRADED_TAX";

export type FilingStatus = "UPCOMING" | "IN_PROGRESS" | "SUBMITTED" | "OVERDUE";

export type ComplianceFiling = {
  company_id: Identifier;
  filing_type: FilingType;
  period_covered: string;
  due_date: string;
  submitted_date?: string | null;
  status: FilingStatus;
  assigned_to?: Identifier | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ServiceLine =
  | "TAX"
  | "AFS"
  | "PAYROLL"
  | "BOOKKEEPING"
  | "ADVISORY"
  | "COMPLIANCE"
  | "OTHER";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED";

export type TimeEntry = {
  company_id: Identifier;
  contact_id?: Identifier | null;
  entry_date: string;
  hours: number;
  billable: boolean;
  hourly_rate_szl: number;
  service_line: ServiceLine;
  description: string;
  linked_filing_id?: Identifier | null;
  invoice_id?: Identifier | null;
  created_at: string;
} & Pick<RaRecord, "id">;

export type Invoice = {
  invoice_number: string;
  company_id: Identifier;
  period_start: string;
  period_end: string;
  subtotal_szl: number;
  vat_szl: number;
  total_szl: number;
  status: InvoiceStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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
  // Eswatini identifier fields
  tin?: string | null;
  national_id_number?: string | null;
  role_at_company?: string | null;
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
  priority?: "high" | "medium" | "low";
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
