import type {
  Company,
  ComplianceFiling,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Invoice,
  Sale,
  Tag,
  Task,
  TimeEntry,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  compliance_filings: ComplianceFiling[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  invoices: Invoice[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  time_entries: TimeEntry[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
