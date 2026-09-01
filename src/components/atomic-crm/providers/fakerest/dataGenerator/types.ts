import type {
  Application,
  Cohort,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Enrollment,
  Offer,
  OfferPaymentOption,
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
  applications: Application[];
  enrollments: Enrollment[];
  waitlist_entries: WaitlistEntry[];
  sales_calls: SalesCall[];
  sales_call_events: SalesCallEvent[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
