import { datatype, lorem, random } from "faker/locale/en_US";
import { defaultTaskTypes } from "@/components/atomic-crm/root/defaultConfiguration";
import type { Task } from "@/components/atomic-crm/types";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";
import { randomDate } from "@/components/atomic-crm/providers/fakerest/dataGenerator/utils";

type TaskType = (typeof defaultTaskTypes)[number];

export const type: TaskType[] = [
  "Email",
  "Email",
  "Email",
  "Email",
  "Email",
  "Email",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Call",
  "Demo",
  "Lunch",
  "Meeting",
  "Follow-up",
  "Follow-up",
  "Thank you",
  "Ship",
  "None",
];

export const generateTasks = (db: Db) => {
  return Array.from(Array(400).keys()).map<Task>((id) => {
    const contact = random.arrayElement(db.contacts);
    contact.nb_tasks++;
    return {
      id,
      contact_id: contact.id,
      type: random.arrayElement(defaultTaskTypes),
      text: lorem.sentence(),
      due_date: randomDate(
        datatype.boolean() ? new Date() : new Date(contact.first_seen),
        new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      done_date: undefined,
      sales_id: 0,
    };
  });
};
