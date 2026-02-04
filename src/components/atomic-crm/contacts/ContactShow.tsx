import { ShowBase, useShowContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ReferenceManyCount } from "@/components/admin/reference-many-count";
import { TextField } from "@/components/admin/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate, NotesIterator } from "../notes";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { ContactEditSheet } from "./ContactEditSheet";
import { TagsListEdit } from "./TagsListEdit";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { ContactTasksList } from "./ContactTasksList";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { ContactAside } from "./ContactAside";
import { MobileBackButton } from "../misc/MobileBackButton";
import { Pencil } from "lucide-react";
import { Link } from "react-router";

export const ContactShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase>
      {isMobile ? <ContactShowContentMobile /> : <ContactShowContent />}
    </ShowBase>
  );
};

const ContactShowContentMobile = () => {
  const { record, isPending } = useShowContext<Contact>();
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (isPending || !record) return null;

  return (
    <>
      {/* We need to repeat the note creation sheet here to support the note 
      create button that is rendered when there are no notes. */}
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={record.id}
      />
      <ContactEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <MobileHeader>
        <MobileBackButton />
        <div className="flex flex-1">
          <Link to="/contacts">
            <h1 className="text-xl font-semibold">Contacts</h1>
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
          <span className="sr-only">Edit record</span>
        </Button>
      </MobileHeader>
      <MobileContent>
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <Avatar />
            <div className="mx-3 flex-1">
              <h2 className="text-2xl font-bold">
                {record.first_name} {record.last_name}
              </h2>
              <div className="text-sm text-muted-foreground">
                {record.title}
                {record.title && record.company_id != null && " at "}
                {record.company_id != null && (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link="show"
                  >
                    <TextField source="name" className="underline" />
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
        </div>

        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">
              <ReferenceManyCount
                target="contact_id"
                reference="tasks"
                filter={{ "done_date@is": null }}
              />{" "}
              Tasks
            </TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4">
            <ReferenceManyField
              target="contact_id"
              reference="contact_notes"
              sort={{ field: "date", order: "DESC" }}
              empty={
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground mb-4">No notes yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setNoteCreateOpen(true)}
                  >
                    Add note
                  </Button>
                </div>
              }
            >
              <NotesIterator reference="contacts" showStatus />
            </ReferenceManyField>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <ContactTasksList />
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Personal info</h3>
                <Separator />
                <div className="mt-3">
                  <ContactPersonalInfo />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Background info</h3>
                <Separator />
                <div className="mt-3">
                  <ContactBackgroundInfo />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Tags</h3>
                <Separator />
                <div className="mt-3">
                  <TagsListEdit />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </MobileContent>
    </>
  );
};

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
              reference="contact_notes"
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
