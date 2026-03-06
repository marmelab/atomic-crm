import type { Identifier, RaRecord } from "ra-core";

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
  email: string;
  /** @deprecated Only used by FakeRest provider */
  password?: string;
} & Pick<RaRecord, "id">;

export type ContactEmail = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type ContactPhone = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type ContactRole =
  | "operativo"
  | "amministrativo"
  | "fatturazione"
  | "decisionale"
  | "legale"
  | "altro";

export type Client = {
  name: string;
  // Fiscal/billing display name only when it differs from the main client name.
  billing_name?: string;
  client_type:
    | "produzione_tv"
    | "azienda_locale"
    | "privato_wedding"
    | "privato_evento"
    | "web";
  phone?: string;
  email?: string;
  address?: string;
  /** @deprecated Legacy ambiguous fiscal identifier. Use vat_number or fiscal_code. */
  tax_id?: string;
  vat_number?: string;
  fiscal_code?: string;
  billing_address_street?: string;
  billing_address_number?: string;
  billing_postal_code?: string;
  billing_city?: string;
  billing_province?: string;
  billing_country?: string;
  billing_sdi_code?: string;
  billing_pec?: string;
  source?: "instagram" | "facebook" | "passaparola" | "google" | "altro" | null;
  notes?: string;
  tags: Identifier[];
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ClientTask = {
  client_id?: Identifier | null;
  text: string;
  type: string;
  due_date: string;
  all_day: boolean;
  done_date?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ClientNote = {
  client_id: Identifier;
  text: string;
  date: string;
  attachments?: AttachmentNote[];
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type Contact = {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  contact_role?: ContactRole | null;
  is_primary_for_client?: boolean | null;
  client_id?: Identifier | null;
  email_jsonb: ContactEmail[];
  phone_jsonb: ContactPhone[];
  linkedin_url?: string | null;
  background?: string | null;
  tags: Identifier[];
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ProjectContact = {
  project_id: Identifier;
  contact_id: Identifier;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type Project = {
  client_id: Identifier;
  name: string;
  category:
    | "produzione_tv"
    | "spot"
    | "wedding"
    | "evento_privato"
    | "sviluppo_web";
  tv_show?:
    | "bella_tra_i_fornelli"
    | "gustare_sicilia"
    | "vale_il_viaggio"
    | "altro"
    | null;
  status: "in_corso" | "completato" | "in_pausa" | "cancellato";
  start_date?: string;
  end_date?: string;
  all_day: boolean;
  budget?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type Service = {
  project_id?: Identifier | null;
  client_id?: Identifier | null;
  service_date: string;
  service_end?: string;
  all_day: boolean;
  is_taxable: boolean;
  service_type:
    | "riprese"
    | "montaggio"
    | "riprese_montaggio"
    | "fotografia"
    | "sviluppo_web"
    | "altro";
  description?: string;
  fee_shooting: number;
  fee_editing: number;
  fee_other: number;
  discount: number;
  km_distance: number;
  km_rate: number;
  travel_origin?: string | null;
  travel_destination?: string | null;
  trip_mode?: "one_way" | "round_trip" | null;
  location?: string;
  invoice_ref?: string;
  google_event_id?: string | null;
  google_event_link?: string | null;
  notes?: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type Payment = {
  client_id: Identifier;
  project_id?: Identifier | null;
  quote_id?: Identifier | null;
  payment_date: string;
  payment_type:
    | "acconto"
    | "saldo"
    | "parziale"
    | "rimborso_spese"
    | "rimborso";
  amount: number;
  method?: "bonifico" | "contanti" | "paypal" | "altro" | null;
  invoice_ref?: string;
  status: "ricevuto" | "in_attesa" | "scaduto";
  notes?: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type FinancialDocument = {
  client_id: Identifier;
  direction: "inbound" | "outbound";
  xml_document_code?: string | null;
  document_type:
    | "customer_invoice"
    | "supplier_invoice"
    | "customer_credit_note"
    | "supplier_credit_note";
  related_document_number?: string | null;
  document_number: string;
  issue_date: string;
  due_date?: string | null;
  total_amount: number;
  taxable_amount?: number | null;
  tax_amount?: number | null;
  stamp_amount?: number | null;
  currency_code: string;
  source_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type FinancialDocumentSummary = {
  client_id: Identifier;
  client_name: string;
  direction: "inbound" | "outbound";
  xml_document_code?: string | null;
  document_type:
    | "customer_invoice"
    | "supplier_invoice"
    | "customer_credit_note"
    | "supplier_credit_note";
  related_document_number?: string | null;
  document_number: string;
  issue_date: string;
  due_date?: string | null;
  total_amount: number;
  taxable_amount?: number | null;
  tax_amount?: number | null;
  stamp_amount?: number | null;
  settled_amount: number;
  open_amount: number;
  settlement_status: "open" | "partial" | "settled" | "overdue";
  project_allocations_count: number;
  project_names?: string | null;
  currency_code: string;
  source_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type CashMovement = {
  client_id?: Identifier | null;
  project_id?: Identifier | null;
  direction: "inbound" | "outbound";
  movement_date: string;
  amount: number;
  method?: "bonifico" | "contanti" | "paypal" | "altro" | null;
  reference?: string | null;
  source_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type FinancialDocumentProjectAllocation = {
  document_id: Identifier;
  project_id?: Identifier | null;
  allocation_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type FinancialDocumentCashAllocation = {
  document_id: Identifier;
  cash_movement_id: Identifier;
  project_id?: Identifier | null;
  allocation_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type Expense = {
  project_id?: Identifier | null;
  client_id?: Identifier | null;
  source_service_id?: Identifier | null;
  expense_date: string;
  expense_type:
    | "spostamento_km"
    | "pedaggio_autostradale"
    | "vitto_alloggio"
    | "acquisto_materiale"
    | "abbonamento_software"
    | "noleggio"
    | "altro"
    | "credito_ricevuto";
  km_distance?: number;
  km_rate?: number;
  amount?: number;
  markup_percent?: number;
  description?: string;
  invoice_ref?: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type Quote = {
  client_id: Identifier;
  project_id?: Identifier | null;
  service_type: string;
  event_start?: string;
  event_end?: string;
  all_day: boolean;
  description?: string;
  amount: number;
  status: string;
  sent_date?: string;
  response_date?: string;
  rejection_reason?: string;
  notes?: string;
  quote_items?: QuoteItem[];
  is_taxable: boolean;
  index: number;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type QuoteItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type Tag = {
  id: number;
  name: string;
  color: string;
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
  description?: string;
}

export interface NoteStatus extends LabeledValue {
  color: string;
}

/** Tax profile for a single ATECO code under Regime Forfettario.
 *  Links project categories to a specific profitability coefficient. */
export interface FiscalTaxProfile {
  atecoCode: string;
  description: string;
  coefficienteReddititivita: number; // percentage, e.g. 78
  linkedCategories: string[];
}

export interface TaxabilityDefaultsConfig {
  nonTaxableCategories: string[];
  nonTaxableClientIds: string[];
}

/** Complete fiscal configuration stored in Settings.
 *  All fields configurable from UI and persisted to DB via configuration JSONB. */
export interface FiscalConfig {
  taxProfiles: FiscalTaxProfile[];
  aliquotaINPS: number; // 26.07
  tettoFatturato: number; // 85000
  annoInizioAttivita: number; // 2023
  taxabilityDefaults?: TaxabilityDefaultsConfig;
  /** Override manuale dell'aliquota sostitutiva.
   *  Se undefined/null → calcolo automatico: 5% primi 5 anni, 15% dal 6°.
   *  Se valorizzato → usa questo valore (per casistiche particolari). */
  aliquotaOverride?: number;
}

export interface AIConfig {
  historicalAnalysisModel: string;
  invoiceExtractionModel: string;
}

export interface OperationalConfig {
  defaultKmRate: number;
  defaultTravelOrigin?: string;
}

export interface BusinessProfile {
  name: string;
  tagline: string;
  vatNumber: string;
  fiscalCode: string;
  address: string;
  email: string;
  phone: string;
}

// Workflow Automation Types
export type WorkflowTriggerResource =
  | "clients"
  | "contacts"
  | "projects"
  | "quotes"
  | "services"
  | "payments"
  | "expenses"
  | "client_tasks";
export type WorkflowTriggerEvent = "created" | "updated" | "status_changed";
export type WorkflowActionType =
  | "create_task"
  | "create_project"
  | "update_field"
  | "send_email"
  | "send_notification";

export interface WorkflowAction {
  type: WorkflowActionType;
  data: Record<string, unknown>;
}

export type Workflow = {
  name: string;
  description?: string;
  is_active: boolean;
  trigger_resource: WorkflowTriggerResource;
  trigger_event: WorkflowTriggerEvent;
  trigger_conditions: Record<string, unknown>;
  actions: WorkflowAction[];
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type WorkflowExecution = {
  workflow_id: Identifier;
  trigger_resource: string;
  trigger_record_id: string;
  trigger_event: string;
  execution_status: "pending" | "running" | "completed" | "failed";
  execution_result?: Record<string, unknown>;
  error_message?: string;
  executed_at: string;
} & Pick<RaRecord, "id">;
