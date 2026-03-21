import { formatDistance } from "date-fns";
import { FileText } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";

import type { Contact, ContactNote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { NOTE_TYPE_ICONS } from "../notes/NoteTypeBadge";

export const LatestNotes = () => {
  const { noteTypes } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const { data: contactNotesData, isPending: contactNotesLoading } = useGetList(
    "contact_notes",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "date", order: "DESC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: Number.isInteger(identity?.id) },
  );
  const { data: dealNotesData, isPending: dealNotesLoading } = useGetList(
    "deal_notes",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "date", order: "DESC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: Number.isInteger(identity?.id) },
  );
  if (contactNotesLoading || dealNotesLoading) {
    return null;
  }
  // TypeScript guards
  if (!contactNotesData || !dealNotesData) {
    return null;
  }

  const allNotes = ([] as any[])
    .concat(
      contactNotesData.map((note) => ({
        ...note,
        noteKind: "contactNote",
      })),
      dealNotesData.map((note) => ({ ...note, noteKind: "dealNote" })),
    )
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <FileText className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.latest_notes")}
        </h2>
      </div>
      <Card>
        <CardContent>
          {allNotes.map((note) => (
            <div
              id={`${note.type}_${note.id}`}
              key={`${note.type}_${note.id}`}
              className="mb-8"
            >
              <div className="text-sm text-muted-foreground">
                {note.noteKind === "dealNote" ? (
                  <Deal note={note} />
                ) : (
                  <Contact note={note} />
                )}
                {", "}
                {translate("crm.dashboard.latest_notes_added_ago", {
                  timeAgo: formatDistance(note.date, new Date(), {
                    addSuffix: true,
                  }),
                })}
              </div>
              <div>
                <p className="text-sm line-clamp-3 overflow-hidden">
                  {note.noteKind === "contactNote" &&
                    (() => {
                      const noteType = note.type
                        ? noteTypes?.find((t) => t.value === note.type)
                        : null;
                      const Icon =
                        noteType?.icon && noteType.value !== "none"
                          ? NOTE_TYPE_ICONS[noteType.icon]
                          : null;
                      return Icon ? (
                        <Icon
                          className="w-4 h-4 float-left mr-2 mt-0.5"
                          style={
                            noteType?.color
                              ? { color: noteType.color }
                              : undefined
                          }
                        />
                      ) : null;
                    })()}
                  {note.text}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const Deal = ({ note }: any) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.deals.forcedCaseName")}{" "}
      <ReferenceField
        record={note}
        source="deal_id"
        reference="deals"
        link="show"
      >
        <TextField source="name" />
      </ReferenceField>
    </>
  );
};

const Contact = ({ note }: any) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.contacts.forcedCaseName")}{" "}
      <ReferenceField<ContactNote, Contact>
        record={note}
        source="contact_id"
        reference="contacts"
        link="show"
      />
    </>
  );
};
