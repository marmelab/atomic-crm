import { formatRelative } from "date-fns";
import { difference, union } from "lodash";
import {
  type Identifier,
  RecordContextProvider,
  useListContext,
} from "ra-core";
import { type MouseEvent, useCallback, useRef } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

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
    onSelect,
    selectedIds,
  } = useListContext<Contact>();
  const isSmall = useIsMobile();
  const lastSelected = useRef<Identifier | null>(null);

  // Handle shift+click to select a range of rows
  const handleToggleItem = useCallback(
    (id: Identifier, event: MouseEvent) => {
      if (!contacts) return;

      const ids = contacts.map((contact) => contact.id);
      const lastSelectedIndex = lastSelected.current
        ? ids.indexOf(lastSelected.current)
        : -1;

      if (event.shiftKey && lastSelectedIndex !== -1) {
        const index = ids.indexOf(id);
        const idsBetweenSelections = ids.slice(
          Math.min(lastSelectedIndex, index),
          Math.max(lastSelectedIndex, index) + 1,
        );

        const isClickedItemSelected = selectedIds?.includes(id);
        const newSelectedIds = isClickedItemSelected
          ? difference(selectedIds, idsBetweenSelections)
          : union(selectedIds, idsBetweenSelections);

        onSelect?.(newSelectedIds);
      } else {
        onToggleItem(id);
      }

      lastSelected.current = id;
    },
    [contacts, selectedIds, onSelect, onToggleItem],
  );

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
          <div className="flex flex-row items-center py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
            <div
              className="px-4 py-3 flex items-center cursor-pointer"
              onClick={(e) => handleToggleItem(contact.id, e)}
            >
              <Checkbox checked={selectedIds.includes(contact.id)} />
            </div>
            <Link
              to={`/contacts/${contact.id}/show`}
              onClick={handleLinkClick}
              className="flex-1 flex flex-row gap-4 items-center"
            >
              <Avatar />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {`${contact.first_name} ${contact.last_name ?? ""}`}
                </div>
                {contact.title ||
                contact.company_id != null ||
                contact.nb_tasks ? (
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
                ) : null}
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
          </div>
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
