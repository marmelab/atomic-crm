import { ReferenceField, TextField } from "@/components/admin";
import { useRecordContext } from "ra-core";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { SaleName } from "@/components/atomic-crm/sales/SaleName";
import type {
  ActivityContactNoteCreated,
  Contact,
} from "@/components/atomic-crm/types";
import { useActivityLogContext } from "@/components/atomic-crm/activity/ActivityLogContext";
import { ActivityLogNote } from "@/components/atomic-crm/activity/ActivityLogNote";

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
  const { contactNote } = activity;
  return (
    <ActivityLogNote
      header={
        <div className="flex items-center gap-2 w-full">
          <ReferenceField
            source="contact_id"
            reference="contacts"
            record={activity.contactNote}
          >
            <ContactAvatar />
          </ReferenceField>

          <div className="flex flex-row flex-grow">
            <div className="text-sm text-muted-foreground flex-grow">
              <span className="text-muted-foreground text-sm inline-flex">
                <ReferenceField
                  source="sales_id"
                  reference="sales"
                  record={activity}
                >
                  <SaleName />
                </ReferenceField>
                <ReferenceField
                  source="contact_id"
                  reference="contacts"
                  record={activity.contactNote}
                >
                  &nbsp;added a note about <TextField source="first_name" />
                  &nbsp;
                  <TextField source="last_name" />
                </ReferenceField>
              </span>
            </div>

            {context === "company" && (
              <span className="text-muted-foreground text-sm">
                <RelativeDate date={activity.date} />
              </span>
            )}
          </div>
        </div>
      }
      text={contactNote.text}
    />
  );
}
