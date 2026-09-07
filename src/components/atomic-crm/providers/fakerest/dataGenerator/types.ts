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
  EnrollmentOnboardingItem,
  ExpectedSessionWindow,
  Offer,
  OfferPaymentOption,
  OnboardingRequirementTemplate,
  Sale,
  SalesCall,
  SalesCallEvent,
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
