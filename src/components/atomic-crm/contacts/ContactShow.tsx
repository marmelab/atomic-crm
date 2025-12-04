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
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Edit } from "lucide-react";
import { ReferenceManyCount } from "../misc/ReferenceManyCount";

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
        <Card className="max-md:border-none max-md:py-0">
          <CardContent className="flex flex-col gap-2 p-0 md:p-4">
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
              <div>
                <Button asChild>
                  <Link to="/contacts">Back to contact list</Link>
                </Button>
              </div>
            ) : null}
            {isMobile ? (
              <Tabs defaultValue="notes">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="notes">
                    <ReferenceManyCount
                      reference="contactNotes"
                      target="contact_id"
                      render={(total) => (
                        <>
                          {total?.toString()} {total === 1 ? "note" : "notes"}
                        </>
                      )}
                    />
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <ReferenceManyCount
                      reference="tasks"
                      target="contact_id"
                      render={(total) => (
                        <>
                          {total?.toString()} {total === 1 ? "task" : "tasks"}
                        </>
                      )}
                    />
                  </TabsTrigger>
                  <TabsTrigger value="details">Contact details</TabsTrigger>
                </TabsList>
                <TabsContent value="notes">
                  <ReferenceManyField
                    target="contact_id"
                    reference="contactNotes"
                    sort={{ field: "date", order: "DESC" }}
                    empty={<NoteCreate reference="contacts" showStatus />}
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
