import { useRecordContext } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ShowButton } from "@/components/admin/show-button";

import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { TagsListEdit } from "./TagsListEdit";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { ContactEmailHistory } from "./ContactEmailHistory";
import { ContactCalendarEvents } from "./ContactCalendarEvents";
import { AsideSection } from "../misc/AsideSection";
import type { Contact } from "../types";
import { ContactMergeButton } from "./ContactMergeButton";
import { ExportVCardButton } from "./ExportVCardButton";
import { useGoogleConnectionStatus } from "../google/useGoogleConnectionStatus";

export const ContactAside = ({ link = "edit" }: { link?: "edit" | "show" }) => {
  const record = useRecordContext<Contact>();
  const { data: googleStatus } = useGoogleConnectionStatus();
  const showEmails =
    googleStatus?.connected && googleStatus.preferences?.showEmailsOnContact;
  const showCalendar =
    googleStatus?.connected && googleStatus.preferences?.showCalendarOnContact;

  if (!record) return null;
  return (
    <div className="hidden sm:block w-92 min-w-92 text-sm">
      <div className="mb-4 -ml-1">
        {link === "edit" ? (
          <EditButton label="Modifier le contact" />
        ) : (
          <ShowButton label="Voir le contact" />
        )}
      </div>

      <AsideSection title="Informations personnelles">
        <ContactPersonalInfo />
      </AsideSection>

      <AsideSection title="Informations contextuelles">
        <ContactBackgroundInfo />
      </AsideSection>

      <AsideSection title="Étiquettes">
        <TagsListEdit />
      </AsideSection>

      <AsideSection title="Tâches">
        <ReferenceManyField
          target="contact_id"
          reference="tasks"
          sort={{ field: "due_date", order: "ASC" }}
        >
          <TasksIterator />
        </ReferenceManyField>
        <AddTask />
      </AsideSection>

      {showEmails && (
        <AsideSection title="Emails">
          <ContactEmailHistory />
        </AsideSection>
      )}

      {showCalendar && (
        <AsideSection title="Rendez-vous">
          <ContactCalendarEvents />
        </AsideSection>
      )}

      {link !== "edit" && (
        <>
          <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
            <ExportVCardButton />
            <ContactMergeButton />
          </div>
          <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
            <DeleteButton
              className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
              size="sm"
            />
          </div>
        </>
      )}
    </div>
  );
};
