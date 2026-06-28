import type {
  Company,
  Contact,
  ContactNote,
  DailyResearchActivity,
  Deal,
  DealNote,
  OutreachEvent,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  outreach_events: OutreachEvent[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  daily_research_activities: DailyResearchActivity[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
