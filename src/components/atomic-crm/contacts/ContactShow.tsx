import { useState, type ReactNode } from "react";
import { RecordRepresentation, ShowBase, useShowContext } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ReferenceManyCount } from "@/components/admin/reference-many-count";
import { TextField } from "@/components/admin/text-field";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Avatar as ShadcnAvatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Pencil } from "lucide-react";
import { Link } from "react-router";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate, NotesIterator, NotesIteratorMobile } from "../notes";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { ContactEditSheet } from "./ContactEditSheet";
import { TagsListEdit } from "./TagsListEdit";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { ContactTasksList } from "./ContactTasksList";
import { ContactEmailHistory } from "./ContactEmailHistory";
import { ContactCalendarEvents } from "./ContactCalendarEvents";
import { ExportVCardButton } from "./ExportVCardButton";
import { ContactMergeButton } from "./ContactMergeButton";
import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import type { Contact } from "../types";
import { Avatar } from "./Avatar"; // used in mobile layout
import { MobileBackButton } from "../misc/MobileBackButton";
import { useGoogleConnectionStatus } from "../google/useGoogleConnectionStatus";

export const ContactShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase
      queryOptions={{
        onError: isMobile
          ? () => {
              {
                /** Disable error notification as the content handles offline */
              }
            }
          : undefined,
      }}
    >
      {isMobile ? <ContactShowContentMobile /> : <ContactShowContent />}
    </ShowBase>
  );
};

const ContactShowContentMobile = () => {
  const { record, isPending } = useShowContext<Contact>();
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data: googleStatus } = useGoogleConnectionStatus();
  const showEmails =
    googleStatus?.connected && googleStatus.preferences?.showEmailsOnContact;
  const showCalendar =
    googleStatus?.connected && googleStatus.preferences?.showCalendarOnContact;
  const googleTabCount = (showEmails ? 1 : 0) + (showCalendar ? 1 : 0);
  const totalTabs = 3 + googleTabCount;
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
        <div className="flex flex-1 min-w-0">
          <Link to="/contacts" className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">
              <RecordRepresentation />
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
          <span className="sr-only">Modifier</span>
        </Button>
      </MobileHeader>
      <MobileContent>
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <Avatar />
            <div className="mx-3 flex-1">
              <h2 className="text-2xl font-bold">
                <RecordRepresentation />
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
          <TabsList
            className="grid w-full h-10"
            style={{ gridTemplateColumns: `repeat(${totalTabs}, 1fr)` }}
          >
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">
              <ReferenceManyCount
                target="contact_id"
                reference="tasks"
                filter={{ "done_date@is": null }}
              />{" "}
              Tâches
            </TabsTrigger>
            {showEmails && <TabsTrigger value="emails">Emails</TabsTrigger>}
            {showCalendar && <TabsTrigger value="calendar">Agenda</TabsTrigger>}
            <TabsTrigger value="details">Détails</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-2">
            <ReferenceManyField
              target="contact_id"
              reference="contact_notes"
              sort={{ field: "date", order: "DESC" }}
              empty={
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground mb-4">Aucune note pour l'instant</p>
                  <Button
                    variant="outline"
                    onClick={() => setNoteCreateOpen(true)}
                  >
                    Add note
                  </Button>
                </div>
              }
              loading={false}
              error={false}
              queryOptions={
                {
                  onError: () => {
                    /** override to hide notification as error case is handled by NotesIteratorMobile */
                  },
                } as any // fixme: remove once https://github.com/marmelab/react-admin/pull/11166 is released
              }
            >
              <NotesIteratorMobile contactId={record.id} showStatus />
            </ReferenceManyField>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <ContactTasksList />
          </TabsContent>

          {showEmails && (
            <TabsContent value="emails" className="mt-4">
              <ContactEmailHistory />
            </TabsContent>
          )}

          {showCalendar && (
            <TabsContent value="calendar" className="mt-4">
              <ContactCalendarEvents />
            </TabsContent>
          )}

          <TabsContent value="details" className="mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Infos personnelles</h3>
                <Separator />
                <div className="mt-3">
                  <ContactPersonalInfo />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Contexte</h3>
                <Separator />
                <div className="mt-3">
                  <ContactBackgroundInfo />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Étiquettes</h3>
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
  const { data: googleStatus } = useGoogleConnectionStatus();
  const showEmails =
    googleStatus?.connected && googleStatus.preferences?.showEmailsOnContact;
  const showCalendar =
    googleStatus?.connected && googleStatus.preferences?.showCalendarOnContact;

  if (isPending || !record) return null;

  const initials =
    (record.first_name?.charAt(0).toUpperCase() ?? "") +
    (record.last_name?.charAt(0).toUpperCase() ?? "");

  return (
    <div className="mt-2 mb-8 space-y-4">
      {/* ── Command Strip Header ── */}
      <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-5 px-6 py-5">
          {/* Large avatar */}
          <ShadcnAvatar className="size-14 ring-2 ring-orange-100 shrink-0">
            <AvatarImage src={record.avatar?.src ?? undefined} />
            <AvatarFallback className="text-base font-semibold">
              {initials}
            </AvatarFallback>
          </ShadcnAvatar>

          {/* Name + title/company */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight leading-none mb-1.5">
              <RecordRepresentation />
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {record.title && <span>{record.title}</span>}
              {record.title && record.company_id != null && (
                <span className="text-muted-foreground/40">·</span>
              )}
              {record.company_id != null && (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link="show"
                >
                  <TextField
                    source="name"
                    className="font-medium text-foreground hover:text-orange-500 transition-colors cursor-pointer"
                  />
                </ReferenceField>
              )}
            </div>
          </div>

          {/* Company logo + edit button */}
          <div className="flex items-center gap-3 shrink-0">
            <ReferenceField
              source="company_id"
              reference="companies"
              link="show"
              className="no-underline"
            >
              <CompanyAvatar />
            </ReferenceField>
            <EditButton
              label="Modifier le contact"
              variant="outline"
              className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 transition-colors"
            />
          </div>
        </div>
        {/* Orange accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300" />
      </div>

      {/* ── 3-Column Body ── */}
      <div className="grid grid-cols-[260px_1fr_260px] gap-4 items-start">

        {/* ── LEFT: Contact details ── */}
        <div className="space-y-3">
          <SectionCard label="Contact" accent>
            <ContactPersonalInfo />
          </SectionCard>

          <SectionCard label="Contexte">
            <ContactBackgroundInfo />
          </SectionCard>

          <SectionCard label="Étiquettes">
            <TagsListEdit />
          </SectionCard>

          <div className="flex flex-col gap-2 px-1 pt-1">
            <ExportVCardButton />
            <ContactMergeButton />
          </div>
          <div className="flex flex-col gap-2 px-1 pt-1 border-t border-border">
            <DeleteButton
              className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
              size="sm"
            />
          </div>
        </div>

        {/* ── CENTER: Notes ── */}
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden min-h-[300px]">
          <ReferenceManyField
            target="contact_id"
            reference="contact_notes"
            sort={{ field: "date", order: "DESC" }}
            empty={
              <NoteCreate reference="contacts" showStatus className="p-4" />
            }
          >
            <NotesIterator reference="contacts" showStatus />
          </ReferenceManyField>
        </div>

        {/* ── RIGHT: Tasks + Emails + Calendar ── */}
        <div className="space-y-3">
          <SectionCard label="Tâches" accent>
            <ReferenceManyField
              target="contact_id"
              reference="tasks"
              sort={{ field: "due_date", order: "ASC" }}
            >
              <TasksIterator />
            </ReferenceManyField>
            <AddTask />
          </SectionCard>

          {showEmails && (
            <SectionCard label="Emails">
              <ContactEmailHistory />
            </SectionCard>
          )}

          {showCalendar && (
            <SectionCard label="Rendez-vous">
              <ContactCalendarEvents />
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: ReactNode;
}) => (
  <div className="bg-background rounded-xl border border-border shadow-sm p-4">
    <p
      className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${
        accent ? "text-orange-500" : "text-muted-foreground"
      }`}
    >
      {label}
    </p>
    {children}
  </div>
);
