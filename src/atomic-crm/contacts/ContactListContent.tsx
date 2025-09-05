import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatRelative } from "date-fns";
import { RecordContextProvider, useListContext } from "ra-core";
import { Link } from "react-router";

import { ReferenceField, TextField } from "@/components/admin";
import { Skeleton } from "@/components/ui/skeleton";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Status } from "../misc/Status";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { TagsList } from "./TagsList";

export const ContactListContent = () => {
  const {
    data: contacts,
    error,
    isPending,
    onToggleItem,
    selectedIds,
  } = useListContext<Contact>();
  const isSmall = useIsMobile();

  // StopPropagation does not work for some reason on Checkbox, this handler is a workaround
  const handleLinkClick = useCallback(function handleLinkClick(
    e: MouseEvent<HTMLAnchorElement>,
  ) {
    if (e.target instanceof HTMLButtonElement) {
      e.preventDefault();
    }
  }, []);

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }
  const now = Date.now();

  return (
    <div className="divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <Link
            to={`/contacts/${contact.id}/show`}
            className="flex flex-row gap-4 items-center px-4 py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
            onClick={handleLinkClick}
          >
            <Checkbox
              className="cursor-pointer"
              checked={selectedIds.includes(contact.id)}
              onCheckedChange={() => onToggleItem(contact.id)}
            />
            <Avatar />
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                {`${contact.first_name} ${contact.last_name ?? ""}`}
              </div>
              <div className="text-sm text-muted-foreground">
                {contact.title}
                {contact.title && contact.company_id != null && " at "}
                {contact.company_id != null && (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                )}
                {contact.nb_tasks
                  ? ` - ${contact.nb_tasks} task${
                      contact.nb_tasks > 1 ? "s" : ""
                    }`
                  : ""}
                &nbsp;&nbsp;
                <TagsList />
              </div>
            </div>
            {contact.last_seen && (
              <div className="text-right ml-4">
                <div
                  className="text-sm text-muted-foreground"
                  title={contact.last_seen}
                >
                  {!isSmall && "last activity "}
                  {formatRelative(contact.last_seen, now)}{" "}
                  <Status status={contact.status} />
                </div>
              </div>
            )}
          </Link>
        </RecordContextProvider>
      ))}

      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No contacts found</div>
        </div>
      )}
    </div>
  );
};
