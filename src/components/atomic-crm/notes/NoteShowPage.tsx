import { Pencil } from "lucide-react";
import { RecordRepresentation, useGetOne, WithRecord } from "ra-core";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { Markdown } from "../misc/Markdown";
import { MobileBackButton } from "../misc/MobileBackButton";
import { RelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { SaleName } from "../sales/SaleName";
import type { ContactNote } from "../types";
import { NoteAttachments } from "./NoteAttachments";
import { NoteEditSheet } from "./NoteEditSheet";

export const NoteShowPage = () => {
  const { id: contactId, noteId } = useParams<{
    id: string;
    noteId: string;
  }>();
  const [editOpen, setEditOpen] = useState(false);

  const { data: note, isPending } = useGetOne<ContactNote>("contact_notes", {
    id: noteId!,
  });

  if (isPending || !note) return null;

  return (
    <>
      <NoteEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        noteId={note.id}
      />
      <MobileHeader>
        <MobileBackButton to={`/contacts/${contactId}/show`} />
        <div className="flex flex-1">
          <Link to={`/contacts/${contactId}/show`}>
            <h1 className="text-xl font-semibold">
              Note for{" "}
              <ReferenceField
                record={note}
                resource="contact_notes"
                source="contact_id"
                reference="contacts"
                link={false}
              >
                <RecordRepresentation resource="contacts" />
              </ReferenceField>
            </h1>
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-5" />
          <span className="sr-only">Edit note</span>
        </Button>
      </MobileHeader>
      <MobileContent>
        <div className="mb-4">
          <div className="flex items-center space-x-2 w-full text-sm text-muted-foreground">
            <span>
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
            </span>
            {note.status && <Status status={note.status} />}
            <div className="flex-1" />
            <RelativeDate date={note.date} />
          </div>
        </div>

        {note.text && (
          <Markdown className="text-sm [&_p]:leading-5 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline">
            {note.text}
          </Markdown>
        )}

        {note.attachments && (
          <div className="mt-4">
            <NoteAttachments note={note} />
          </div>
        )}
      </MobileContent>
    </>
  );
};
