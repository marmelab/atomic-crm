import type { Contact } from "@/components/atomic-crm/types";
import { ContactCreate } from "@/components/atomic-crm/contacts/ContactCreate";
import { ContactEdit } from "@/components/atomic-crm/contacts/ContactEdit";
import { ContactList } from "@/components/atomic-crm/contacts/ContactList";
import { ContactShow } from "@/components/atomic-crm/contacts/ContactShow";

export default {
  list: ContactList,
  show: ContactShow,
  edit: ContactEdit,
  create: ContactCreate,
  recordRepresentation: (record: Contact) =>
    record?.first_name + " " + record?.last_name,
};
