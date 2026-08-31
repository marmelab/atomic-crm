import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultTaskTypes } from "../../../root/defaultConfiguration";
import type { Task, TaskStatus } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

// "review_application" now carries real system meaning — the domain action
// in applications/reviewApplicationTask.ts matches/completes a Contact's
// pending review task by contact_id + this type alone (Task has no
// Application FK). A randomly-generated task of this same type on the same
// contact as a real pending Application would collide with that lookup and
// get auto-completed instead of the real one (observed live: Native
// Applications slice, §8). Excluded from the random pool so this type is
// only ever created deterministically, by ensureReviewApplicationTask.
const randomTaskTypes = defaultTaskTypes.filter(
  (type) => type.value !== "review_application",
);

export const generateTasks = (db: Db) => {
  const tasks = Array.from(Array(400).keys()).map<Task>((id) => {
    const contact = random.arrayElement(db.contacts);
    contact.nb_tasks = (contact.nb_tasks ?? 0) + 1;
    return {
      id,
      contact_id: contact.id,
      type: random.arrayElement(randomTaskTypes).value,
      text: lorem.sentence(),
      due_date: randomDate(
        datatype.boolean() ? new Date() : new Date(contact.first_seen),
        new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      done_date: undefined,
      status: "pending" as TaskStatus,
      sales_id: 0,
    };
  });

  // A handful of deterministic status fixtures so the demo shows every
  // state (the random generator above only ever produces Pending) without
  // adding separate named fixtures for it.
  if (tasks[0]) {
    tasks[0].status = "completed";
    tasks[0].done_date = randomDate(new Date(tasks[0].due_date)).toISOString();
  }
  if (tasks[1]) {
    tasks[1].status = "waiting";
  }
  if (tasks[2]) {
    tasks[2].status = "cancelled";
  }

  return tasks;
};
