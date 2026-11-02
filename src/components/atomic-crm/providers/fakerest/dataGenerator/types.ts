import type {
  Brochure,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  ImportBatch,
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
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  import_batches: ImportBatch[];
  brochures: Brochure[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
