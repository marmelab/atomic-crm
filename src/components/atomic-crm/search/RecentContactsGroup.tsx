import { useGetMany, useTranslate } from "ra-core";
import type { ReactNode } from "react";

import { CommandGroup, CommandItem } from "@/components/ui/command";

import { Avatar } from "../contacts/Avatar";
import { useRecentContacts } from "../contacts/useRecentContacts";
import type { Contact } from "../types";

/**
 * The contacts viewed on this device lately, offered before the user types a
 * query, so the one looked up before a meeting is one tap away afterwards.
 * Renders `fallback` when there is none.
 */
export const RecentContactsGroup = ({
  onSelect,
  fallback,
}: {
  onSelect: (url: string) => void;
  fallback: ReactNode;
}) => {
  const translate = useTranslate();
  const ids = useRecentContacts();
  const { data, isPending } = useGetMany<Contact>(
    "contacts",
    { ids },
    { enabled: ids.length > 0 },
  );

  // getMany does not keep the order of ids, which is the order of views
  const contacts = ids
    .map((id) => data?.find((contact) => contact.id === id))
    .filter((contact) => contact != null);

  if (!ids.length || (!isPending && !contacts.length)) return fallback;

  return (
    <CommandGroup
      heading={translate("crm.search.recent_contacts")}
      className="[&_[cmdk-group-heading]]:text-sm"
    >
      {contacts.map((contact) => (
        <CommandItem
          key={contact.id}
          value={`recent_contacts.${contact.id}`}
          onSelect={() => onSelect(`/contacts/${contact.id}/show`)}
          className="text-base"
        >
          <Avatar record={contact} width={25} height={25} />
          <span className="truncate">
            {contact.first_name} {contact.last_name}
          </span>
          {contact.company_name ? (
            <span className="ml-auto shrink-0 text-sm text-muted-foreground">
              {contact.company_name}
            </span>
          ) : null}
        </CommandItem>
      ))}
    </CommandGroup>
  );
};
