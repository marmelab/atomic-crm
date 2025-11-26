import { useRecordContext } from "ra-core";

import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Avatar } from "../contacts/Avatar";
import { SaleName } from "../sales/SaleName";
import type { ActivityContactNoteCreated, Contact } from "../types";
import { ActivityLogNote } from "./ActivityLogNote";
import { ActivityLogHeader } from "./ActivityLogHeader";

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
  const { contactNote } = activity;
  return (
    <ActivityLogNote
      header={
        <ActivityLogHeader
          avatar={
            <ReferenceField
              source="contact_id"
              reference="contacts"
              record={activity.contactNote}
            >
              <ContactAvatar />
            </ReferenceField>
          }
          activity={activity}
        >
          <ReferenceField
            source="sales_id"
            reference="sales"
            record={activity}
            className="inline-block"
          >
            <SaleName />
          </ReferenceField>
          &nbsp;added a note about&nbsp;
          <ReferenceField
            source="contact_id"
            reference="contacts"
            record={activity.contactNote}
            className="inline-block"
          >
            <TextField source="first_name" />
            &nbsp;
            <TextField source="last_name" />
          </ReferenceField>
        </ActivityLogHeader>
      }
      text={contactNote.text}
    />
  );
}
