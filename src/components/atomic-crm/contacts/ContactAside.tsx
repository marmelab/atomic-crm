import { useRecordContext, useTranslate } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ShowButton } from "@/components/admin/show-button";

import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { TagsListEdit } from "./TagsListEdit";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { AsideSection } from "../misc/AsideSection";
import type { Contact } from "../types";
import { ContactMergeButton } from "./ContactMergeButton";
import { ExportVCardButton } from "./ExportVCardButton";

export const ContactAside = ({ link = "edit" }: { link?: "edit" | "show" }) => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;
  return (
    <div className="hidden sm:block w-92 min-w-92 text-sm">
      <div className="mb-4 -ml-1">
        {link === "edit" ? (
          <EditButton
            label={translate("crm.contacts.action.edit", {
              _: "Edit contact",
            })}
          />
        ) : (
          <ShowButton
            label={translate("crm.contacts.action.show", {
              _: "Show contact",
            })}
          />
        )}
      </div>

      <AsideSection
        title={translate("crm.contacts.inputs.personal_info", {
          _: "Personal info",
        })}
      >
        <ContactPersonalInfo />
      </AsideSection>

      <AsideSection
        title={translate("crm.contacts.inputs.background_info_short", {
          _: "Background info",
        })}
      >
        <ContactBackgroundInfo />
      </AsideSection>

      <AsideSection
        title={translate("crm.tags.name", { smart_count: 2, _: "Tags" })}
      >
        <TagsListEdit />
      </AsideSection>

      <AsideSection
        title={translate("crm.tasks.name", { smart_count: 2, _: "Tasks" })}
      >
        <ReferenceManyField
          target="contact_id"
          reference="tasks"
          sort={{ field: "due_date", order: "ASC" }}
        >
          <TasksIterator />
        </ReferenceManyField>
        <AddTask />
      </AsideSection>

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
