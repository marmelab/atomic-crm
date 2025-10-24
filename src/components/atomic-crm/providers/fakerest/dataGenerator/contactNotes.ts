import { datatype, lorem, random } from "faker/locale/en_US";
import { defaultNoteStatuses } from "@/components/atomic-crm/root/defaultConfiguration";
import type { ContactNote } from "@/components/atomic-crm/types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";
import { randomDate } from "@/components/atomic-crm/providers/fakerest/dataGenerator/utils";

export const generateContactNotes = (db: Db): ContactNote[] => {
  return Array.from(Array(1200).keys()).map((id) => {
    const contact = random.arrayElement(db.contacts);
    const date = randomDate(new Date(contact.first_seen));
    contact.last_seen =
      date > new Date(contact.last_seen)
        ? date.toISOString()
        : contact.last_seen;
    return {
      id,
      contact_id: contact.id,
      text: lorem.paragraphs(datatype.number({ min: 1, max: 4 })),
      date: date.toISOString(),
      sales_id: contact.sales_id,
      status: random.arrayElement(defaultNoteStatuses).value,
    };
  });
};
