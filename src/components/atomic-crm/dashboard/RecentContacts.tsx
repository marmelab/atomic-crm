import { History } from "lucide-react";
import { useGetMany, useTranslate } from "ra-core";

import { useRecentContacts } from "../contacts/useRecentContacts";
import type { Contact } from "../types";
import { DashboardContactList } from "./DashboardContactList";

export const RecentContacts = () => {
  const translate = useTranslate();
  const ids = useRecentContacts();
  const { data, isPending } = useGetMany<Contact>(
    "contacts",
    { ids },
    { enabled: ids.length > 0 },
  );

  const contacts = ids
    .map((id) => data?.find((contact) => contact.id === id))
    .filter((contact) => contact != null);

  if (!ids.length || (!isPending && !contacts.length)) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-4 md:mb-2">
        <div className="mr-3 flex">
          <History className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.recent_contacts")}
        </h2>
      </div>
      <DashboardContactList
        data={contacts}
        total={contacts.length}
        isPending={isPending}
      />
    </div>
  );
};
