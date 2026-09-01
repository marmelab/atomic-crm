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
  sales_id?: Identifier;
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

// Independent of `status` (Cold/Warm/Hot/In Contract, a note-driven
// temperature label). 'do_not_engage' is a durable future-sales gate set
// by Application review (Native Applications slice, §7) — the anchor a
// future Kit suppression sync would read from.
export type ContactSalesEligibility = "normal" | "do_not_engage";

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
  sales_eligibility: ContactSalesEligibility;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
  // contacts_summary's computed relationship columns (Contacts UX cleanup
  // pass) — derived from real Deal/Application/Enrollment/Waitlist rows,
  // never persisted/mutated data. Optional: only present when read through
  // the "contacts" resource (which both providers route to
  // contacts_summary), not on a bare contacts-table row.
  offer_ids?: Identifier[];
  is_current_client?: boolean;
  is_past_client?: boolean;
  has_applied?: boolean;
  is_on_waitlist?: boolean;
  has_nurture_deal?: boolean;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type OfferType = "individual" | "group";

// A persistent product/program definition (e.g. The Living Example,
// Growing Yourself Up). Few rows, changes rarely.
export type Offer = {
  name: string;
  type: OfferType;
  duration: string;
  current_price: number;
  // Only meaningful for individual offers; group offers manage capacity
  // per-Cohort instead.
  max_active_clients?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// A queryable, structured payment plan for an Offer. "Financial Need"-style
// options are authorized case-by-case (is_public: false), not offered to
// every prospect by default.
export type OfferPaymentOption = {
  offer_id: Identifier;
  name: string;
  total: number;
  installments: number;
  installment_amount: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type CohortStatus =
  | "draft"
  | "applications_open"
  | "applications_closed"
  | "active"
  | "completed";

// A single round of a GROUP offer (e.g. a GYU cohort). Individual offers
// never use Cohorts.
export type Cohort = {
  offer_id: Identifier;
  name: string;
  status: CohortStatus;
  applications_open_at?: string | null;
  applications_close_at?: string | null;
  program_start_at?: string | null;
  program_end_at?: string | null;
  minimum_capacity?: number | null;
  target_capacity?: number | null;
  maximum_capacity?: number | null;
  // Future integration identifiers, not wired up yet.
  slack_channel_id?: string | null;
  calendar_id?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// Distinct review outcomes (Native Applications slice, §1) — never
// collapsed into a generic Approve/Reject. "approved" means "qualified
// enough for a sales call", not "Leif wants to work with them"; that call
// is still made later, independent of the Opportunity's owner_decision.
export type ApplicationStatus =
  | "pending"
  | "approved"
  | "needs_higher_care"
  | "not_fit"
  | "do_not_engage";

// A submitted program/coaching application. Approval means "qualified
// enough for a sales call" — it is intentionally independent from the
// Opportunity's owner_decision (whether the owner wants to work with them).
export type Application = {
  opportunity_id: Identifier;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  raw_answers: Record<string, unknown>;
  summary?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type EnrollmentStatus =
  | "onboarding"
  | "active"
  | "offboarding"
  | "completed";

// The commercial/client lifecycle after a successful sale. At most one per
// Opportunity.
export type Enrollment = {
  opportunity_id: Identifier;
  status: EnrollmentStatus;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type WaitlistEntryStatus =
  | "waiting"
  | "invited"
  | "converted"
  | "removed";

// A person waiting for space/timing in a program, independent of the
// active sales pipeline (Waitlists slice, §1/§2) — see
// supabase/schemas/01_tables.sql for the full product-model rationale.
// cohort_id null means an Offer-level entry ("wants GYU generally" /
// "wants 1:1 when an opening opens up"); set, it means a specific Cohort.
export type WaitlistEntry = {
  contact_id: Identifier;
  offer_id: Identifier;
  cohort_id?: Identifier | null;
  status: WaitlistEntryStatus;
  joined_at: string;
  desired_timing?: string | null;
  notes?: string | null;
  // Leif's manual ordering signal, not a strict FIFO queue (§14).
  priority?: number | null;
  source?: OpportunitySource | null;
  invited_at?: string | null;
  converted_at?: string | null;
  // The Opportunity this entry became, once converted (§12).
  converted_opportunity_id?: Identifier | null;
  removed_at?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type OpportunityOutcome =
  | "nurture"
  | "needs_higher_care"
  | "not_fit"
  | "lost";

export type OpportunityOwnerDecision =
  | "would_work_with"
  | "workshops_only"
  | "do_not_engage";

// Only meaningful when owner_decision = "would_work_with".
export type OpportunityProspectDecision = "yes" | "thinking" | "no";

export type OpportunitySource =
  | "instagram"
  | "referral"
  | "podcast"
  | "workshop"
  | "substack"
  | "google"
  | "other";

export type OpportunityEntryPath =
  | "instagram_conversation"
  | "sales_page"
  // The native public application form (Native Application Intake slice,
  // §9) — distinct from 'sales_page' (an outbound sales-page visit).
  | "application_form"
  | "other";

// The `deals` table/resource now models a Leif Opportunity: a specific
// possible purchase belonging to exactly one Contact. Kept as "Deal" in code
// (table name, resource key, file names) to keep this proof slice's diff
// contained; user-facing copy says "Opportunity" throughout.
export type Deal = {
  name: string;
  company_id?: Identifier | null;
  contact_id: Identifier;
  // Deal-specific, agency-style categorization; unused by Leif's Opportunity
  // forms but left on the type/table so existing rows and the settings
  // category manager don't break.
  category?: string | null;
  offer_id: Identifier;
  // Only set for a group Offer, and only to a Cohort belonging to that same
  // Offer (enforced server-side, see handle_deal_saved()).
  cohort_id?: Identifier | null;
  stage: string;
  outcome?: OpportunityOutcome | null;
  owner_decision?: OpportunityOwnerDecision | null;
  prospect_decision?: OpportunityProspectDecision | null;
  follow_up_date?: string | null;
  // Next scheduled sales call, if any — one ingredient of the future
  // "Next Up" surface, alongside follow_up_date and Enrollment/Cohort dates.
  sales_call_at?: string | null;
  source?: OpportunitySource | null;
  entry_path?: OpportunityEntryPath | null;
  description?: string | null;
  amount: number;
  // Commercial snapshot captured at save time, so a later change to the
  // Offer/payment option never rewrites historical sales context.
  offer_name_snapshot?: string | null;
  offer_price_snapshot?: number | null;
  selected_payment_option_id?: Identifier | null;
  selected_payment_total?: number | null;
  selected_installment_count?: number | null;
  selected_installment_amount?: number | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  // Not collected in the create/edit UI (Programs + Opportunity UX slice,
  // §4) — kept nullable for compatibility with existing rows and any future
  // "Next Up" surface built on real events, not a fabricated date.
  expected_closing_date?: string | null;
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

export type TaskStatus = "pending" | "waiting" | "completed" | "cancelled";

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  // Kept in sync with done_date (see dataProvider's "tasks" lifecycle hook):
  // completing/uncompleting via the checkbox toggles both. "waiting" and
  // "cancelled" are set explicitly via the task form. Tasks are reminders,
  // never sales-status controls — this field never mutates, and is never
  // mutated by, Opportunity/Application/Enrollment state.
  status?: TaskStatus;
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
  // Opportunities are no longer required to have a company (they now belong
  // to exactly one Contact); keep this optional to match Deal.company_id.
  company_id?: Identifier | null;
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
