import { generateCompanies } from "@/components/atomic-crm/providers/fakerest/dataGenerator/companies";
import { generateContactNotes } from "@/components/atomic-crm/providers/fakerest/dataGenerator/contactNotes";
import { generateContacts } from "@/components/atomic-crm/providers/fakerest/dataGenerator/contacts";
import { generateDealNotes } from "@/components/atomic-crm/providers/fakerest/dataGenerator/dealNotes";
import { generateDeals } from "@/components/atomic-crm/providers/fakerest/dataGenerator/deals";
import { finalize } from "@/components/atomic-crm/providers/fakerest/dataGenerator/finalize";
import { generateSales } from "@/components/atomic-crm/providers/fakerest/dataGenerator/sales";
import { generateTags } from "@/components/atomic-crm/providers/fakerest/dataGenerator/tags";
import { generateTasks } from "@/components/atomic-crm/providers/fakerest/dataGenerator/tasks";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contactNotes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.dealNotes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  finalize(db);

  return db;
};
