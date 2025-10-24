import {
  ReferenceField,
  ReferenceManyField,
  TextField,
} from "@/components/admin";
import { Card, CardContent } from "@/components/ui/card";
import { ShowBase, useShowContext } from "ra-core";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { NoteCreate } from "@/components/atomic-crm/notes/NoteCreate";
import { NotesIterator } from "@/components/atomic-crm/notes/NotesIterator";
import type { Contact } from "@/components/atomic-crm/types";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactAside } from "@/components/atomic-crm/contacts/ContactAside";

export const ContactShow = () => (
  <ShowBase>
    <ContactShowContent />
  </ShowBase>
);

const ContactShowContent = () => {
  const { record, isPending } = useShowContext<Contact>();
  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex">
              <Avatar />
              <div className="ml-2 flex-1">
                <h5 className="text-xl font-semibold">
                  {record.first_name} {record.last_name}
                </h5>
                <div className="inline-flex text-sm text-muted-foreground">
                  {record.title}
                  {record.title && record.company_id != null && " at "}
                  {record.company_id != null && (
                    <ReferenceField
                      source="company_id"
                      reference="companies"
                      link="show"
                    >
                      &nbsp;
                      <TextField source="name" />
                    </ReferenceField>
                  )}
                </div>
              </div>
              <div>
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link="show"
                  className="no-underline"
                >
                  <CompanyAvatar />
                </ReferenceField>
              </div>
            </div>
            <ReferenceManyField
              target="contact_id"
              reference="contactNotes"
              sort={{ field: "date", order: "DESC" }}
              empty={
                <NoteCreate reference="contacts" showStatus className="mt-4" />
              }
            >
              <NotesIterator reference="contacts" showStatus />
            </ReferenceManyField>
          </CardContent>
        </Card>
      </div>
      <ContactAside />
    </div>
  );
};
