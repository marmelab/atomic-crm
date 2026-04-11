import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  IntakeLead,
  OutreachStep,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  contact_tags: Array<{ id: string; contact_id: number; tag_id: number }>;
  deals: Deal[];
  deal_contacts: Array<{ id: string; deal_id: number; contact_id: number }>;
  deal_notes: DealNote[];
  intake_leads: IntakeLead[];
  outreach_steps: OutreachStep[];
  lead_sources: Array<{ id: string; name: string }>;
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  trade_types: Array<{ id: string; name: string }>;
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
