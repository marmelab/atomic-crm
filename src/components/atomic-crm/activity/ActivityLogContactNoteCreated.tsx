import { useRecordContext } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar } from "../contacts/Avatar";
import { RelativeDate } from "../misc/RelativeDate";
import { SaleName } from "../sales/SaleName";
import type { ActivityContactNoteCreated, Contact } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";

type ActivityLogContactNoteCreatedProps = {
  activity: ActivityContactNoteCreated;
};

function ContactAvatar() {
  const record = useRecordContext<Contact>();
  return <Avatar width={20} height={20} record={record} />;
}

export function ActivityLogContactNoteCreated({
  activity,
}: ActivityLogContactNoteCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const { contactNote } = activity;
  const link = isMobile
    ? `/contacts/${contactNote.contact_id}/notes/${contactNote.id}`
    : `/contacts/${contactNote.contact_id}/show`;
  return (
    <ActivityLogNote
      header={
        <div className="flex items-start gap-2 w-full">
          <ReferenceField
            source="contact_id"
            reference="contacts"
            record={activity.contactNote}
          >
            <ContactAvatar />
          </ReferenceField>

          <span className="text-muted-foreground text-sm flex-grow">
            <ReferenceField
              source="sales_id"
              reference="sales"
              record={activity}
            >
              <SaleName />
            </ReferenceField>{" "}
            added a note about{" "}
            <ReferenceField
              source="contact_id"
              reference="contacts"
              record={activity.contactNote}
            >
              <TextField source="first_name" /> <TextField source="last_name" />
            </ReferenceField>
            {context !== "company" && (
              <>
                {" "}
                <RelativeDate date={activity.date} />
              </>
            )}
          </span>

          {context === "company" && (
            <span className="text-muted-foreground text-sm">
              <RelativeDate date={activity.date} />
            </span>
          )}
        </div>
      }
      text={contactNote.text}
      link={link}
    />
  );
}
