import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useUpdate, type Identifier } from "ra-core";
import { useCallback } from "react";

import type { Contact } from "../types";

/**
 * Returns a callback to run once a task or a note was created for a contact.
 *
 * It first refreshes the cached contact: its counters (nb_tasks, nb_notes) come
 * from the summary views and changed with the insert, so they depend on the
 * create, not on the update below. Then it touches last_seen as a best effort —
 * the record the user asked for already exists, so a failure here is logged and
 * never surfaced.
 */
export const useTouchContactLastSeen = () => {
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const queryClient = useQueryClient();

  return useCallback(
    async (contactId?: Identifier, data?: Partial<Contact>) => {
      if (contactId == null) return;

      queryClient.invalidateQueries({ queryKey: ["contacts", "getOne"] });

      try {
        const { data: contact } = await dataProvider.getOne<Contact>(
          "contacts",
          { id: contactId },
        );
        if (!contact) return;
        await update(
          "contacts",
          {
            id: contactId,
            data: { last_seen: new Date().toISOString(), ...data },
            previousData: contact,
          },
          { returnPromise: true },
        );
      } catch (error) {
        console.error("Could not update the contact last_seen date", error);
      }
    },
    [dataProvider, queryClient, update],
  );
};
