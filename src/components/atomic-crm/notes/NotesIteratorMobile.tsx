import type { Identifier } from "ra-core";
import { useListContext, WithRecord } from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";

import { RelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { SaleName } from "../sales/SaleName";
import type { ContactNote } from "../types";

export const NotesIteratorMobile = ({
  contactId,
  showStatus,
}: {
  contactId: Identifier;
  showStatus?: boolean;
}) => {
  const { data, error, isPending } = useListContext();
  if (isPending || error) return null;

  return (
    <div className="divide-y">
      {data?.map((note) => (
        <NoteMobile
          key={note.id}
          note={note}
          contactId={contactId}
          showStatus={showStatus}
        />
      ))}
    </div>
  );
};

export const NoteMobile = ({
  note,
  contactId,
  showStatus,
}: {
  note: ContactNote;
  contactId: Identifier;
  showStatus?: boolean;
}) => (
  <Link
    to={`/contacts/${contactId}/notes/${note.id}`}
    className="block active:bg-accent/50 -mx-2 px-2 py-2 rounded-md"
  >
    <div className="flex items-center space-x-2 w-full">
      <div className="inline-flex h-full items-center text-sm text-muted-foreground">
        By{" "}
        <ReferenceField
          record={note}
          resource="contact_notes"
          source="sales_id"
          reference="sales"
          link={false}
        >
          <WithRecord render={(record) => <SaleName sale={record} />} />
        </ReferenceField>
        {showStatus && note.status && (
          <Status className="ml-2" status={note.status} />
        )}
      </div>
      <div className="flex-1" />
      <span className="text-sm text-muted-foreground">
        <RelativeDate date={note.date} />
      </span>
    </div>
    {note.text && (
      <p className="pt-2 text-sm line-clamp-3">
        {note.text.replace(/\s+/g, " ").trim()}
      </p>
    )}
  </Link>
);
