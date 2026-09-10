import type {
  Application,
  ClientSession,
  ClientSessionCadenceIssue,
  ClientSessionCadenceIssueEvent,
  ClientSessionEvent,
  Cohort,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  DealStageEvent,
  Enrollment,
  EnrollmentExpectedSession,
  EnrollmentOffboardingItem,
  EnrollmentOnboardingItem,
  EnrollmentStatusEvent,
  ExpectedSessionWindow,
  Offer,
  OfferPaymentOption,
  OffboardingRequirementTemplate,
  OnboardingRequirementTemplate,
  Sale,
  SalesCall,
  SalesCallEvent,
  ScholarshipSlot,
  ScholarshipSlotEvent,
  Tag,
  Task,
  WaitlistEntry,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  offers: Offer[];
  offer_payment_options: OfferPaymentOption[];
  cohorts: Cohort[];
  deals: Deal[];
  deal_notes: DealNote[];
  deal_stage_events: DealStageEvent[];
  applications: Application[];
  enrollments: Enrollment[];
  onboarding_requirement_templates: OnboardingRequirementTemplate[];
  enrollment_onboarding_items: EnrollmentOnboardingItem[];
  offboarding_requirement_templates: OffboardingRequirementTemplate[];
  enrollment_offboarding_items: EnrollmentOffboardingItem[];
  enrollment_status_events: EnrollmentStatusEvent[];
  scholarship_slots: ScholarshipSlot[];
  scholarship_slot_events: ScholarshipSlotEvent[];
  waitlist_entries: WaitlistEntry[];
  sales_calls: SalesCall[];
  sales_call_events: SalesCallEvent[];
  client_sessions: ClientSession[];
  client_session_events: ClientSessionEvent[];
  expected_session_windows: ExpectedSessionWindow[];
  enrollment_expected_sessions: EnrollmentExpectedSession[];
  client_session_cadence_issues: ClientSessionCadenceIssue[];
  client_session_cadence_issue_events: ClientSessionCadenceIssueEvent[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
