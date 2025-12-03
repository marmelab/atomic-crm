import type { Identifier, DataProvider } from "ra-core";

import type { Contact, Task, Deal, ContactNote } from "../../types";

/**
 * Merge one contact (loser) into another contact (winner).
 *
 * This function copies properties from the loser to the winner contact,
 * transfers all associated data (tasks, notes, deals) from the loser to the winner,
 * and deletes the loser contact.
 */
export const mergeContacts = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
) => {
  // Fetch both contacts using dataProvider to get fresh data
  const { data: winnerContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: winnerId },
  );
  const { data: loserContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: loserId },
  );

  if (!winnerContact || !loserContact) {
    throw new Error("Could not fetch contacts");
  }

  // 1. Reassign all tasks from loser to winner
  const { data: loserTasks } = await dataProvider.getManyReference<Task>(
    "tasks",
    {
      target: "contact_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  const taskUpdates =
    loserTasks?.map((task) =>
      dataProvider.update("tasks", {
        id: task.id,
        data: { contact_id: winnerId },
        previousData: task,
      }),
    ) || [];

  // 2. Reassign all notes from loser to winner
  const { data: loserNotes } = await dataProvider.getManyReference<ContactNote>(
    "contactNotes",
    {
      target: "contact_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  const noteUpdates =
    loserNotes?.map((note) =>
      dataProvider.update<ContactNote>("contactNotes", {
        id: note.id,
        data: { contact_id: winnerId },
        previousData: note,
      }),
    ) || [];

  // 3. Change contact in deals - replace loser ID with winner ID in contact_ids array
  const { data: loserDeals } = await dataProvider.getList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${loserId}}` },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });

  const dealUpdates =
    loserDeals?.map((deal) => {
      const newContactIds = deal.contact_ids
        .filter((id) => id !== loserId)
        .concat(winnerId)
        .filter(
          (id: Identifier, index: number, self: Identifier[]) =>
            self.indexOf(id) === index,
        ); // Remove duplicates

      return dataProvider.update<Deal>("deals", {
        id: deal.id,
        data: { contact_ids: newContactIds },
        previousData: deal,
      });
    }) || [];

  // 4. Update winner contact with loser data
  const mergedEmails = mergeObjectArraysUnique(
    winnerContact.email_jsonb || [],
    loserContact.email_jsonb || [],
    (email) => email.email,
  );

  const mergedPhones = mergeObjectArraysUnique(
    winnerContact.phone_jsonb || [],
    loserContact.phone_jsonb || [],
    (phone) => phone.number,
  );

  const winnerUpdate = dataProvider.update<Contact>("contacts", {
    id: winnerId,
    data: {
      avatar:
        winnerContact.avatar && winnerContact.avatar.src
          ? winnerContact.avatar
          : loserContact.avatar,
      gender: winnerContact.gender ?? loserContact.gender,
      first_name: winnerContact.first_name ?? loserContact.first_name,
      last_name: winnerContact.last_name ?? loserContact.last_name,
      title: winnerContact.title ?? loserContact.title,
      company_id: winnerContact.company_id ?? loserContact.company_id,
      email_jsonb: mergedEmails,
      phone_jsonb: mergedPhones,
      linkedin_url: winnerContact.linkedin_url || loserContact.linkedin_url,
      background: winnerContact.background ?? loserContact.background,
      has_newsletter:
        winnerContact.has_newsletter ?? loserContact.has_newsletter,
      first_seen: winnerContact.first_seen ?? loserContact.first_seen,
      last_seen:
        winnerContact.last_seen > loserContact.last_seen
          ? winnerContact.last_seen
          : loserContact.last_seen,
      sales_id: winnerContact.sales_id ?? loserContact.sales_id,
      tags: mergeArraysUnique(
        winnerContact.tags || [],
        loserContact.tags || [],
      ),
    },
    previousData: winnerContact,
  });

  // Execute all updates
  await Promise.all([
    ...taskUpdates,
    ...noteUpdates,
    ...dealUpdates,
    winnerUpdate,
  ]);

  // 5. Delete the loser contact
  await dataProvider.delete<Contact>("contacts", {
    id: loserId,
    previousData: loserContact,
  });
};

// Helper functions to merge arrays and remove duplicates

// For primitive arrays like tags
const mergeArraysUnique = <T>(arr1: T[], arr2: T[]): T[] => [
  ...new Set([...arr1, ...arr2]),
];

// For object arrays like emails and phones
function mergeObjectArraysUnique<T>(
  arr1: T[],
  arr2: T[],
  getKey: (item: T) => string,
): T[] {
  const map = new Map<string, T>();

  arr1.forEach((item) => {
    const key = getKey(item);
    if (key) map.set(key, item);
  });

  arr2.forEach((item) => {
    const key = getKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}
