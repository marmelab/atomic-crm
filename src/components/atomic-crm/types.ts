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
  // Stripe test-mode integration slice: one Stripe Customer per Contact,
  // reused across every Deal/Checkout for them. Never raw card/bank data.
  stripe_customer_id?: string | null;
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
  // Scholarship Pricing + Capacity slice: the locked, admin-editable
  // scholarship total for this Offer (mirrors current_price — live,
  // never itself historically authoritative for an already-sold
  // Opportunity). Null means this Offer has no scholarship pricing
  // configured.
  scholarship_price?: number | null;
  // Only meaningful for individual offers; group offers manage capacity
  // per-Cohort instead.
  max_active_clients?: number | null;
  is_active: boolean;
  // Acuity/Sales Call Lifecycle slice: only meaningful for an individual
  // Offer (e.g. The Living Example) — a group Offer maps per-Cohort
  // instead (see Cohort.acuity_appointment_type_id).
  acuity_appointment_type_id?: string | null;
  // Client + Session Operations slice: a SEPARATE mapping identifying this
  // Offer's PAID CLIENT SESSION appointment type (e.g. The Living
  // Example's real "Zoom 1:1", 90522599) — never the same value as
  // acuity_appointment_type_id above, and resolved by a completely
  // separate function (sessions/clientSessionAcuityMapping.ts) so a paid
  // session can never enter sales_call matching or vice versa.
  client_session_acuity_appointment_type_id?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// A queryable, structured payment plan for an Offer. "Financial Need"-style
// options are authorized case-by-case (is_public: false), not offered to
// every prospect by default.
// Scholarship Pricing + Capacity slice: which Deal pricing mode this option
// prices for — a standard-priced option must never become selectable for a
// scholarship Deal, and vice versa (enforced at both the query layer and
// the DB layer — see handle_deal_saved()'s cross-validation).
export type PricingMode = "standard" | "scholarship";

export type OfferPaymentOption = {
  offer_id: Identifier;
  name: string;
  total: number;
  installments: number;
  installment_amount: number;
  is_public: boolean;
  // Optional in TS (not just "may be omitted" — it has a real, universal
  // safe default of "standard" applied by both the Postgres column
  // default and its FakeRest mirror), unlike every other Deal field that
  // must be explicit. Read via `pricing_mode ?? "standard"` wherever the
  // distinction matters.
  pricing_mode?: PricingMode;
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
  // Acuity/Sales Call Lifecycle slice: the Acuity appointment type whose
  // bookings belong to this Cohort's sales calls (a GYU cohort typically
  // gets its own appointment type/calendar per round). Stable-ID mapping,
  // never a display-name match — see sales-calls/offerCohortAcuityMapping.ts.
  acuity_appointment_type_id?: string | null;
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

// Contracts + Onboarding slice: the offer-specific requirement catalog —
// few rows, changes rarely, managed via migration (no admin UI in v1, same
// posture as OfferPaymentOption). Never read by the UI directly; only the
// Won-transition seeding logic (handle_deal_won() / its FakeRest mirror)
// reads this, to snapshot label/task_text_template/is_required onto each
// new Enrollment's own enrollment_onboarding_items rows.
export type OnboardingRequirementTemplate = {
  offer_id: Identifier;
  key: string;
  label: string;
  task_text_template: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// 'sent' is only ever used by the 'contract' item (not_sent -> sent ->
// done, UI-relabeled "Signed" for that one row) — every other item goes
// straight pending -> done. See enrollment_onboarding_items' own schema
// comment for why this is one shared enum rather than a per-requirement
// column.
export type EnrollmentOnboardingItemStatus = "pending" | "sent" | "done";

// One row per (Enrollment x applicable requirement) — Contracts +
// Onboarding slice. label/is_required are snapshotted at creation time
// from onboarding_requirement_templates (never a live reference), so a
// later template edit never rewrites an already-created Enrollment's own
// checklist history.
export type EnrollmentOnboardingItem = {
  enrollment_id: Identifier;
  requirement_key: string;
  label: string;
  // Snapshotted alongside label — only ever read again by
  // reopenOnboardingItem.ts, when it needs to recreate a Task from
  // scratch (the original was cancelled, not merely completed).
  task_text_template: string;
  is_required: boolean;
  sort_order: number;
  status: EnrollmentOnboardingItemStatus;
  completed_at?: string | null;
  external_ref?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// Client Offboarding slice: the offboarding mirror of
// OnboardingRequirementTemplate above — same posture (no admin UI,
// managed via migration), same snapshot-at-transition philosophy. Read
// only by handle_enrollment_offboarding_started() / its FakeRest mirror,
// which snapshots label/task_text_template/is_required onto each
// Enrollment's own enrollment_offboarding_items rows the moment
// offboarding genuinely begins.
export type OffboardingRequirementTemplate = {
  offer_id: Identifier;
  key: string;
  label: string;
  task_text_template: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// Simpler than EnrollmentOnboardingItemStatus's own pending/sent/done —
// no offboarding requirement in this slice has a meaningful intermediate
// state.
export type EnrollmentOffboardingItemStatus = "pending" | "done";

// One row per (Enrollment x applicable offboarding requirement) — Client
// Offboarding slice. label/task_text_template/is_required are
// snapshotted at creation time from offboarding_requirement_templates
// (never a live reference), so a later template edit never rewrites an
// Enrollment whose offboarding has already started.
export type EnrollmentOffboardingItem = {
  enrollment_id: Identifier;
  requirement_key: string;
  label: string;
  task_text_template: string;
  is_required: boolean;
  sort_order: number;
  status: EnrollmentOffboardingItemStatus;
  completed_at?: string | null;
  external_ref?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

// Client Offboarding slice: the smallest append-only audit trail for
// Enrollment lifecycle transitions — answers "when did offboarding
// begin"/"when did this Enrollment become completed" without a
// generalized event-sourcing system. Mirrors DealStageEvent's own shape.
export type EnrollmentStatusEvent = {
  enrollment_id: Identifier;
  status: EnrollmentStatus;
  entered_at: string;
  created_at: string;
} & Pick<RaRecord, "id">;

// Scholarship Pricing + Capacity slice: the single authoritative
// representation of scholarship-slot ownership for an Offer — one row per
// Offer (created lazily on first grant). `holder_deal_id` set means an
// outstanding scholarship offer (Deal granted, not yet Won); `holder_
// enrollment_id` set instead means a current scholarship Enrollment
// (onboarding/active/offboarding); both null means free; both set is
// impossible. Never written directly by the UI — only by the Postgres
// triggers (handle_deal_saved()/handle_deal_won()/handle_enrollment_
// scholarship_slot_transition()) and their FakeRest mirror
// (scholarshipSlotValidation.ts).
export type ScholarshipSlot = {
  offer_id: Identifier;
  holder_deal_id?: Identifier | null;
  holder_enrollment_id?: Identifier | null;
  reserved_at?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ScholarshipSlotEventType =
  | "scholarship_granted"
  | "scholarship_released"
  | "deal_converted_to_enrollment"
  | "enrollment_completed_slot_released"
  | "slot_reclaimed_after_backward_lifecycle_correction";

// Append-only audit history of every scholarship_slots transition —
// mirrors DealStageEvent/EnrollmentStatusEvent's own "current-state table +
// companion event log" convention. Never read to determine capacity, only
// to answer "who held this Offer's scholarship slot, and when."
export type ScholarshipSlotEvent = {
  offer_id: Identifier;
  deal_id?: Identifier | null;
  enrollment_id?: Identifier | null;
  event_type: ScholarshipSlotEventType;
  occurred_at: string;
  created_at: string;
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

// "workshops_only" (Acuity/Sales Call Lifecycle slice) is a genuine exit
// from the LE/GYU sales pipeline but explicitly NOT a lost sale — the
// owner would work with this person, just not in this program. Kept
// distinct from "lost" so later analytics never conflates the two (see
// deals.owner_decision = "workshops_only", set together with this).
// Acuity/Sales Call Lifecycle slice: the durable current-state record for a
// sales call/appointment, one row per LOGICAL appointment — a reschedule
// updates this row (never creates a second one), so it can never look like
// two independent calls in later conversion analytics. `opportunity_id` is
// nullable: a booking that can't be safely matched to exactly one active
// Opportunity is preserved with opportunity_id = null (see sales-calls/
// matchAcuityBooking.ts) rather than guessed, and surfaced via a "Resolve
// Sales Call" task (sales-calls/resolveSalesCallTask.ts) rather than
// silently buried. `contact_id` is always resolved (normalized-email
// match-or-create, same principle as Native Application Intake).
//
// Individual lifecycle facts (booked/rescheduled/cancelled/attendance
// recorded, with occurred_at and whatever old/new values are relevant) are
// preserved separately in SalesCallEvent — this row is only ever the
// current/summary state, never the history itself.
export type SalesCallStatus = "booked" | "cancelled";
export type SalesCallAttendance = "attended" | "no_show";
export type SalesCallSource = "acuity" | "manual";

export type SalesCall = {
  opportunity_id?: Identifier | null;
  contact_id: Identifier;
  status: SalesCallStatus;
  // Set once at creation, never updated — the very first time this was
  // scheduled, independent of any later reschedule.
  original_scheduled_at: string;
  // The current/latest scheduled time. Mirrored onto the owning
  // Opportunity's `sales_call_at` (a denormalized convenience field) by
  // the sales_calls "afterSave" sync — see providers/fakerest/
  // dataProvider.ts and, for production, the sync_deal_sales_call_at()
  // trigger.
  scheduled_at: string;
  reschedule_count: number;
  last_rescheduled_at?: string | null;
  cancelled_at?: string | null;
  // Always a human/CRM action (Complete Sales Call), never inferred from
  // Acuity — an appointment's time having passed does not prove attendance
  // (Acuity's own no-show flag requires an admin to set it there too).
  attendance?: SalesCallAttendance | null;
  attendance_recorded_at?: string | null;
  source: SalesCallSource;
  acuity_appointment_id?: string | null;
  acuity_appointment_type_id?: string | null;
  // Unmatched Sales Call Resolution slice: distinct from opportunity_id —
  // "deliberately not a sales situation" is a different durable state than
  // "not yet resolved", never overloaded onto the same null. Set together;
  // opportunity_id stays null forever once dismissed_at is set.
  dismissed_at?: string | null;
  dismissal_reason?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type SalesCallEventKind =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "attendance_recorded"
  // Unmatched Sales Call Resolution slice.
  | "opportunity_attached"
  | "dismissed";

// The append-only lifecycle history a SalesCall's current-state row can't
// hold on its own (Acuity/Sales Call Lifecycle slice, per Leif's own
// decision: durable individual events, not just a reschedule_count +
// last_rescheduled_at summary). Deliberately NOT a generalized event-
// sourcing log — SalesCall stays the easy current-state record this app
// reads from everywhere; this table exists only so multiple reschedules
// don't collapse into a single count.
export type SalesCallEvent = {
  sales_call_id: Identifier;
  kind: SalesCallEventKind;
  occurred_at: string;
  // Only set for kind = "rescheduled".
  previous_scheduled_at?: string | null;
  new_scheduled_at?: string | null;
  // Only set for kind = "attendance_recorded".
  attendance?: SalesCallAttendance | null;
  // Only set for kind = "dismissed".
  dismissal_reason?: string | null;
  created_at: string;
} & Pick<RaRecord, "id">;

export type ClientSessionStatus = "booked" | "cancelled";
export type ClientSessionSource = "acuity" | "manual";

// Client + Session Operations slice: one row per real paid-client
// appointment (e.g. The Living Example's recurring 1:1 sessions) — the
// session ledger foundation. A deliberately separate concept from
// SalesCall (a different business event — delivering already-bought
// service, not deciding whether to buy), never sharing matching/lifecycle
// logic with it.
//
// Cadence correction (human acceptance found the original "Mark
// Completed" model wrong for how Leif actually runs the offer): a booked
// session is assumed attended BY DEFAULT — Acuity can't prove attendance
// either way, so a manual completion click added friction without adding
// certainty. 'completed' status/completed_at are retired; no_show_at is
// the only exception a human ever records (see markClientSessionNoShow.ts
// / reverseClientSessionNoShow.ts).
export type ClientSession = {
  contact_id: Identifier;
  // Nullable: zero or 2+ legitimately-matching active Enrollments must
  // never be guessed at — see sessions/matchClientSessionEnrollment.ts.
  // The appointment is preserved as a real fact either way.
  enrollment_id?: Identifier | null;
  // Always resolved from the Acuity appointment-type mapping at booking
  // time — never derived through a possibly-null enrollment_id.
  offer_id: Identifier;
  status: ClientSessionStatus;
  scheduled_at: string;
  reschedule_count: number;
  last_rescheduled_at?: string | null;
  cancelled_at?: string | null;
  // Explicit, reversible exception: a booked session that did NOT happen.
  // Distinct from cancelled_at (the appointment was called off ahead of
  // time) — a no-show is a booking that stood but wasn't kept.
  no_show_at?: string | null;
  source: ClientSessionSource;
  acuity_appointment_id?: string | null;
  acuity_appointment_type_id?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ClientSessionEventKind =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "no_show"
  | "no_show_reversed";

// Append-only lifecycle history, same rationale as SalesCallEvent —
// multiple reschedules/a no-show followed by a correction must never
// collapse into a single summary field.
export type ClientSessionEvent = {
  client_session_id: Identifier;
  kind: ClientSessionEventKind;
  occurred_at: string;
  // Only set for kind = "rescheduled".
  previous_scheduled_at?: string | null;
  new_scheduled_at?: string | null;
  created_at: string;
} & Pick<RaRecord, "id">;

// Client + Session Operations cadence correction: one row per real Google
// Calendar event ingested from Leif's "Year Planning" calendar whose
// title marks it as an open-for-1:1s window (see
// sync_year_planning_calendar's own matching comment for the real
// observed title variance — "1:1s", "1:1 week", "1:1", "1:1s add"). The
// CRM never writes back to the calendar — this is read-only ingestion,
// the authoritative source for "which weeks was Leif actually open" in
// place of an assumed 3-arbitrary-weeks-per-month.
export type ExpectedSessionWindow = {
  offer_id: Identifier;
  external_calendar_id: string;
  external_event_id: string;
  raw_title: string;
  // Date-only (Google's own all-day-event semantics) — window_end is
  // EXCLUSIVE, never reinterpreted as inclusive.
  window_start: string;
  window_end: string;
  // Soft-delete: this event disappeared from a later sync pass.
  deleted_at?: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ClientSessionCadenceClassification =
  | "known_skip"
  | "rescheduled"
  | "missed_ghosted";

// Service Period model correction: the durable, per-Enrollment
// ASSIGNMENT of a shared ExpectedSessionWindow into that Enrollment's own
// sequential 12-slot cadence (Service Period = ceil(ordinal / 3), never
// stored — pure derived arithmetic). Assigned append-only by
// sync_year_planning_calendar's own assignment pass, in the
// chronological order qualifying windows are discovered — never
// reassigned/renumbered once created. Snapshots window_start/window_end/
// raw_title at assignment time (same "historical integrity from a
// snapshot" convention as Deal.offer_name_snapshot) so an already-
// assigned slot's own dates and Service Period membership are frozen
// against a LATER edit to the source calendar event — see this slice's
// own report for the historical-stability reasoning. source_window_id is
// kept for traceability only, never re-read for display or fulfillment-
// matching once assigned.
export type EnrollmentExpectedSession = {
  enrollment_id: Identifier;
  source_window_id: Identifier;
  ordinal: number;
  window_start: string;
  window_end: string;
  raw_title: string;
  created_at: string;
} & Pick<RaRecord, "id">;

// Client + Session Operations cadence correction: the resolvable
// exception row — mirrors SalesCall's own "the record IS the alert"
// shape. One row per (active Enrollment, assigned session slot) pair —
// created either by the calendar sync's own detection pass (a closed
// slot with no fulfilling session) or synchronously the moment a
// fulfilling session is marked No-show. classification/resolved_at both
// null means still unresolved and surfaced via its own linked Task on
// the Dashboard's existing Needs Attention section (see
// Task.cadence_issue_id).
//
// State-machine correction: this is the CURRENT state, always mutable —
// resolved_at set with classification null means "resolved because
// fulfillment was restored" (an auto-resolve), distinct from a real
// human classification; a human classification can be changed or
// reopened/cleared. See ClientSessionCadenceIssueEvent for the durable
// history of every transition.
export type ClientSessionCadenceIssue = {
  enrollment_id: Identifier;
  enrollment_expected_session_id: Identifier;
  classification?: ClientSessionCadenceClassification | null;
  note?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type ClientSessionCadenceIssueEventKind =
  | "created"
  | "resolved"
  | "reclassified"
  | "reopened";

// Append-only history for ClientSessionCadenceIssue above — same
// rationale as ClientSessionEvent/SalesCallEvent: a classification
// changed (or reopened) more than once must never collapse into a
// single summary field.
export type ClientSessionCadenceIssueEvent = {
  cadence_issue_id: Identifier;
  kind: ClientSessionCadenceIssueEventKind;
  // The classification AS OF this event (kind = "resolved" or
  // "reclassified") — null for "created"/"reopened".
  classification?: ClientSessionCadenceClassification | null;
  note?: string | null;
  occurred_at: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type OpportunityOutcome =
  | "nurture"
  | "needs_higher_care"
  | "not_fit"
  | "lost"
  | "workshops_only";

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
  // Scholarship Pricing + Capacity slice: an explicit pricing mode Leif
  // grants via Deal edit (never at creation, never client-derivable).
  // Frozen immutable the instant this Deal reaches Won. Granting/releasing
  // atomically claims/frees this Offer's single scholarship_slots row —
  // never a UI-only capacity check (see grantScholarshipPricing.ts /
  // releaseScholarshipReservation.ts).
  // Optional in TS (not just "may be omitted" — it has a real, universal
  // safe default of "standard" applied by both the Postgres column
  // default and its FakeRest mirror), unlike every other Deal field that
  // must be explicit. Read via `pricing_mode ?? "standard"` wherever the
  // distinction matters.
  pricing_mode?: PricingMode;
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
  // Payment domain foundation slice: the opaque public token the
  // personalized Offer Page resolves by — never the Deal's own sequential
  // id. Generated once, when the Deal first reaches Committed.
  offer_page_token?: string | null;
  // First time the Offer Page was actually opened with a valid token, if
  // ever. Never touched again after the first open.
  offer_page_opened_at?: string | null;
  // Stripe test-mode integration slice: minimal identifiers to observe and
  // safely re-enter the payment/schedule-adoption sequence. See
  // supabase/schemas/01_tables.sql's own comment for the exact rationale —
  // never raw card/bank data, and the schedule's own configuration state
  // is deliberately not persisted here (derived live from Stripe instead).
  stripe_checkout_session_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_schedule_id?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  // Not collected in the create/edit UI (Programs + Opportunity UX slice,
  // §4) — kept nullable for compatibility with existing rows and any future
  // "Next Up" surface built on real events, not a fabricated date.
  expected_closing_date?: string | null;
  sales_id: Identifier;
  index: number;
  // Kanban queue-ordering slice: when this Opportunity entered its CURRENT
  // stage — set exactly once per genuine stage change (see
  // set_deal_stage_entered_at() / providers/fakerest/dataProvider.ts's
  // "deals" hooks), never by an unrelated field edit, a note, or metadata
  // change. Kanban columns sort on this, oldest first. Full transition
  // history (including earlier stages) lives separately in
  // DealStageEvent — the same current-state/history split as SalesCall/
  // SalesCallEvent above.
  stage_entered_at: string;
} & Pick<RaRecord, "id">;

// Append-only history of every genuine stage transition an Opportunity has
// made (Kanban queue-ordering slice) — mirrors SalesCallEvent's role for
// Deal.stage_entered_at. Deliberately narrow: preserves stage transitions
// only, not a general audit log of every field change.
export type DealStageEvent = {
  opportunity_id: Identifier;
  stage: string;
  entered_at: string;
  created_at: string;
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
  // mutated by, Opportunity/Application state. ONE deliberate exception
  // (Contracts + Onboarding slice): completing/reopening a Task linked to
  // onboarding_item_id below IS mirrored onto that one Enrollment
  // checklist item — see sync_onboarding_item_from_task() — cancelling
  // never is (the checklist stays the durable source of truth).
  status?: TaskStatus;
  sales_id?: Identifier;
  // Contracts + Onboarding slice: Task points AT its business context —
  // nullable, only ever set for auto-created onboarding_item Tasks (every
  // other type still resolves via the existing contact_id heuristic in
  // useTaskActionDestination.ts). onboarding_item_id is only ever set
  // together with a matching enrollment_id (see
  // set_task_enrollment_id_consistency()).
  enrollment_id?: Identifier | null;
  onboarding_item_id?: Identifier | null;
  // Client Offboarding slice: the offboarding mirror of
  // onboarding_item_id above — same "points AT its context" pattern,
  // never set together with onboarding_item_id on the same Task.
  offboarding_item_id?: Identifier | null;
  // Unmatched Sales Call Resolution slice: only ever set for
  // resolve_sales_call Tasks — a returning Contact can have more than one
  // unresolved booking at once, so contact_id alone can't disambiguate
  // which one this Task is about.
  sales_call_id?: Identifier | null;
  // Client + Session Operations cadence correction: only ever set for
  // resolve_client_session_cadence Tasks — an active Enrollment can have
  // more than one unresolved cadence week at once.
  cadence_issue_id?: Identifier | null;
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
