import { ShowBase, useShowContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate, NotesIterator } from "../notes";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { ContactAside, ContactDetails } from "./ContactAside";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { useRecordContext } from "ra-core";
import { useReferenceManyFieldController } from "ra-core";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Edit } from "lucide-react";

export const ContactShow = () => (
  <ShowBase>
    <ContactShowContent />
  </ShowBase>
);

const ContactShowContent = () => {
  const { record, isPending } = useShowContext<Contact>();
  const isMobile = useIsMobile();
  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent className="px-2 md:px-4">
            <div className="flex">
              <Avatar />
              <div className="ml-2 flex-1">
                <div className="flex items-center justify-between">
                  <h5 className="text-xl font-semibold">
                    {record.first_name} {record.last_name}
                  </h5>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    asChild
                  >
                    <Link to={`/contacts/${record.id}`}>
                      <span className="sr-only">Edit</span>
                      <Edit />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap md:inline-flex text-sm text-muted-foreground">
                  <span>{record.title}</span>
                  <span>
                    {record.title && record.company_id != null && " at "}
                    {record.company_id != null && (
                      <ReferenceField
                        source="company_id"
                        reference="companies"
                        link="show"
                        className="inline-block"
                      >
                        &nbsp;
                        <TextField source="name" />
                      </ReferenceField>
                    )}
                  </span>
                </div>
              </div>
              {isMobile ? null : (
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
              )}
            </div>
            {isMobile ? (
              <Tabs defaultValue="notes" className="mt-4">
                <TabsList>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="tasks">
                    <TasksCount />
                  </TabsTrigger>
                  <TabsTrigger value="details">Contact details</TabsTrigger>
                </TabsList>
                <TabsContent value="notes">
                  <ReferenceManyField
                    target="contact_id"
                    reference="contactNotes"
                    sort={{ field: "date", order: "DESC" }}
                    empty={
                      <NoteCreate
                        reference="contacts"
                        showStatus
                        className="mt-4"
                      />
                    }
                  >
                    <NotesIterator reference="contacts" showStatus />
                  </ReferenceManyField>
                </TabsContent>
                <TabsContent value="tasks">
                  <ReferenceManyField
                    target="contact_id"
                    reference="tasks"
                    sort={{ field: "due_date", order: "ASC" }}
                  >
                    <TasksIterator />
                  </ReferenceManyField>
                  <AddTask />
                </TabsContent>
                <TabsContent value="details">
                  <ContactDetails />
                </TabsContent>
              </Tabs>
            ) : (
              <ReferenceManyField
                target="contact_id"
                reference="contactNotes"
                sort={{ field: "date", order: "DESC" }}
                empty={
                  <NoteCreate
                    reference="contacts"
                    showStatus
                    className="mt-4"
                  />
                }
              >
                <NotesIterator reference="contacts" showStatus />
              </ReferenceManyField>
            )}
          </CardContent>
        </Card>
      </div>
      {isMobile ? null : <ContactAside />}
    </div>
  );
};

/**
 * Necessary until we have a render prop on ReferenceManyCountBase
 */
const TasksCount = () => {
  const record = useRecordContext();
  const { isLoading, error, total } = useReferenceManyFieldController({
    page: 1,
    perPage: 1,
    record,
    reference: "tasks",
    target: "contact_id",
  });

  const body = isLoading
    ? ""
    : error
      ? "error"
      : `${total} ${total === 1 ? "task" : "tasks"}`;
  return <span>{body}</span>;
};
