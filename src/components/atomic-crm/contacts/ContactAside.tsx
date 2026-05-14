import { useRecordContext, useTranslate } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ShowButton } from "@/components/admin/show-button";

import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { TagsListEdit } from "./TagsListEdit";
import { ContactStatusSelector } from "./ContactInputs";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { AsideSection } from "../misc/AsideSection";
import type { Contact } from "../types";

const ContactEswatiniInfo = ({ record }: { record: Contact }) => {
  const translate = useTranslate();
  if (!record.tin && !record.national_id_number && !record.role_at_company) {
    return null;
  }
  return (
    <AsideSection
      title={translate(
        "resources.contacts.field_categories.eswatini_identifiers",
        { _: "Eswatini Identifiers" },
      )}
    >
      {record.tin && (
        <span>
          {translate("resources.contacts.fields.tin", { _: "TIN" })}:{" "}
          {record.tin}
        </span>
      )}
      {record.national_id_number && (
        <span>
          {translate("resources.contacts.fields.national_id_number", {
            _: "National ID",
          })}
          : {record.national_id_number}
        </span>
      )}
      {record.role_at_company && (
        <span>
          {translate("resources.contacts.fields.role_at_company", {
            _: "Role",
          })}
          : {record.role_at_company}
        </span>
      )}
    </AsideSection>
  );
};
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
          <EditButton label="resources.contacts.action.edit" />
        ) : (
          <ShowButton label="resources.contacts.action.show" />
        )}
      </div>

      <AsideSection title={translate("resources.notes.fields.status")}>
        <ContactStatusSelector />
      </AsideSection>

      <AsideSection
        title={translate("resources.contacts.field_categories.personal_info")}
      >
        <ContactPersonalInfo />
      </AsideSection>

      <AsideSection
        title={translate("resources.contacts.field_categories.background_info")}
      >
        <ContactBackgroundInfo />
      </AsideSection>

      <ContactEswatiniInfo record={record} />

      <AsideSection
        title={translate("resources.tags.name", { smart_count: 2 })}
      >
        <TagsListEdit />
      </AsideSection>

      <AsideSection
        title={translate("resources.tasks.name", { smart_count: 2 })}
      >
        <ReferenceManyField
          target="contact_id"
          reference="tasks"
          sort={{ field: "due_date", order: "ASC" }}
          perPage={1000}
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
