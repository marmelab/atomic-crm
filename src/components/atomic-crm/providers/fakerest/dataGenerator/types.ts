import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  IntakeLead,
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
  intake_leads: IntakeLead[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  trade_types: Array<{ id: string; name: string }>;
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
