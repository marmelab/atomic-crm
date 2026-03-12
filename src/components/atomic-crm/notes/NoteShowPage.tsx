import { Pencil } from "lucide-react";
import {
  useGetRecordRepresentation,
  RecordRepresentation,
  useGetIdentity,
  useGetOne,
  useTranslate,
} from "ra-core";
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
import type { ContactNote } from "../types";
import { NoteAttachments } from "./NoteAttachments";
import { NoteEditSheet } from "./NoteEditSheet";
import { useGetSalesName } from "../sales/useGetSalesName";

export const NoteShowPage = () => {
  const translate = useTranslate();
  const { id: contactId, noteId } = useParams<{
    id: string;
    noteId: string;
  }>();
  const [editOpen, setEditOpen] = useState(false);
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const { data: note, isPending } = useGetOne<ContactNote>("contact_notes", {
    id: noteId!,
  });
  const { identity } = useGetIdentity();
  const isCurrentUser = note?.sales_id === identity?.id;
  const salesName = useGetSalesName(note?.sales_id, {
    enabled: note && !isCurrentUser,
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
        <div className="flex flex-1 min-w-0">
          <Link to={`/contacts/${contactId}/show`} className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">
              <ReferenceField
                record={note}
                resource="contact_notes"
                source="contact_id"
                reference="contacts"
                link={false}
                render={({ referenceRecord }) =>
                  referenceRecord
                    ? translate("resources.notes.note_for_contact", {
                        name: getContactRepresentation(referenceRecord),
                      })
                    : null
                }
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
          <span className="sr-only">
            {translate("resources.notes.action.edit")}
          </span>
        </Button>
      </MobileHeader>
      <MobileContent>
        <div className="mb-4">
          <div className="flex items-center space-x-2 w-full text-sm text-muted-foreground">
            <span>
              {translate(
                isCurrentUser
                  ? "resources.notes.you_added"
                  : "resources.notes.author_added",
                { name: salesName },
              )}{" "}
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
