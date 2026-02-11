import { formatRelative } from "date-fns";
import { difference, union } from "lodash";
import {
  type Identifier,
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
  useTimeout,
} from "ra-core";
import { type MouseEvent, useCallback, useRef } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

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

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContent
            contact={contact}
            handleToggleItem={handleToggleItem}
          />
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

const ContactItemContent = ({
  contact,
  handleToggleItem,
}: {
  contact: Contact;
  handleToggleItem: (id: Identifier, event: MouseEvent) => void;
}) => {
  const { selectedIds } = useListContext<Contact>();
  const now = Date.now();

  return (
    <div className="flex flex-row items-center pl-2 pr-4 py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
      <div
        className="px-4 py-3 flex items-center cursor-pointer"
        onClick={(e) => handleToggleItem(contact.id, e)}
      >
        <Checkbox
          className="cursor-pointer"
          checked={selectedIds.includes(contact.id)}
        />
      </div>
      <Link
        to={`/contacts/${contact.id}/show`}
        className="flex-1 flex flex-row gap-4 items-center"
      >
        <Avatar />
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {`${contact.first_name} ${contact.last_name ?? ""}`}
          </div>
          {contact.title || contact.company_id != null || contact.nb_tasks ? (
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
                ? ` - ${contact.nb_tasks} task${contact.nb_tasks > 1 ? "s" : ""}`
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
              {"last activity "}
              {formatRelative(contact.last_seen, now)}{" "}
              <Status status={contact.status} />
            </div>
          </div>
        )}
      </Link>
    </div>
  );
};

export const ContactListContentMobile = () => {
  const {
    data: contacts,
    error,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <>
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="flex flex-row items-center py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex flex-row gap-4 items-center mr-4">
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton className="w-32 h-5 mb-2" />
              <Skeleton className="w-48 h-4" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          Error loading contacts
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContentMobile contact={contact} />
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

const ContactItemContentMobile = ({ contact }: { contact: Contact }) => (
  <Link
    to={`/contacts/${contact.id}/show`}
    className="flex flex-row gap-4 items-center py-2 hover:bg-muted transition-colors"
  >
    <Avatar />
    <div className="flex flex-col grow justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <div className="font-medium">
            <RecordRepresentation />
          </div>
          <Status status={contact.status} />
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <span>
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
            </span>
            {contact.nb_tasks ? (
              <span>
                {contact.nb_tasks} task{contact.nb_tasks > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  </Link>
);
