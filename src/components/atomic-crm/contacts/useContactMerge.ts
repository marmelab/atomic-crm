import { useState } from "react";
import { useUpdate, useDelete, useDataProvider } from "ra-core";
import type { Identifier } from "ra-core";

import type { Contact } from "../types";

export const useContactMerge = () => {
  const [isMerging, setIsMerging] = useState(false);
  const dataProvider = useDataProvider();
  // use update hooks to refresh cache after updates
  const [updateTask] = useUpdate("tasks", undefined, { returnPromise: true });
  const [updateNote] = useUpdate("contactNotes", undefined, {
    returnPromise: true,
  });
  const [updateDeal] = useUpdate("deals", undefined, { returnPromise: true });
  const [updateContact] = useUpdate("contacts", undefined, {
    returnPromise: true,
  });
  const [deleteContact] = useDelete("contacts", undefined, {
    returnPromise: true,
  });

  const mergeContacts = async (loserId: Identifier, winnerId: Identifier) => {
    setIsMerging(true);

    try {
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

      // 1. Update all tasks from loser to winner
      const { data: loserTasks } = await dataProvider.getManyReference(
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
          updateTask("tasks", {
            id: task.id,
            data: { contact_id: winnerId },
            previousData: task,
          }),
        ) || [];

      // 2. Update all notes from loser to winner
      const { data: loserNotes } = await dataProvider.getManyReference(
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
          updateNote("contactNotes", {
            id: note.id,
            data: { contact_id: winnerId },
            previousData: note,
          }),
        ) || [];

      // 3. Update deals - replace loser ID with winner ID in contact_ids array
      const { data: loserDeals } = await dataProvider.getList("deals", {
        filter: { "contact_ids@cs": `{${loserId}}` },
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "id", order: "ASC" },
      });

      const dealUpdates =
        loserDeals?.map((deal) => {
          const newContactIds = deal.contact_ids
            .filter((id: string) => id !== loserId)
            .concat(winnerId)
            .filter(
              (id: string, index: number, self: string[]) =>
                self.indexOf(id) === index,
            ); // Remove duplicates

          return updateDeal("deals", {
            id: deal.id,
            data: { contact_ids: newContactIds },
            previousData: deal,
          });
        }) || [];

      // 4. Merge contact properties
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

      // Update winner contact with merged data
      const winnerUpdate = updateContact("contacts", {
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
      await deleteContact("contacts", {
        id: loserId,
        previousData: loserContact,
      });

      setIsMerging(false);
      return true;
    } catch (error) {
      setIsMerging(false);
      throw error;
    }
  };

  return { mergeContacts, isMerging };
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
