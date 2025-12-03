import { Linkedin, Mail, Phone } from "lucide-react";
import { useRecordContext, WithRecord } from "ra-core";
import type { ReactNode } from "react";
import { ArrayField } from "@/components/admin/array-field";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { ShowButton } from "@/components/admin/show-button";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { TextField } from "@/components/admin/text-field";
import { DateField } from "@/components/admin/date-field";
import { EmailField } from "@/components/admin/email-field";

import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { TagsListEdit } from "./TagsListEdit";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { SaleName } from "../sales/SaleName";
import type { Contact } from "../types";
import { ContactMergeButton } from "./ContactMergeButton";
import { ExportVCardButton } from "./ExportVCardButton";

export const ContactAside = ({ link = "edit" }: { link?: "edit" | "show" }) => {
  const { contactGender } = useConfigurationContext();
  const record = useRecordContext<Contact>();

  if (!record) return null;
  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        {link === "edit" ? (
          <EditButton label="Edit Contact" />
        ) : (
          <ShowButton label="Show Contact" />
        )}
      </div>

      <AsideSection title="Personal info">
        <ArrayField source="email_jsonb">
          <SingleFieldList className="flex-col">
            <PersonalInfoRow
              icon={<Mail className="w-4 h-4 text-muted-foreground" />}
              primary={<EmailField source="email" />}
            />
          </SingleFieldList>
        </ArrayField>

        {record.has_newsletter && (
          <p className="pl-6 text-sm text-muted-foreground">
            Subscribed to newsletter
          </p>
        )}

        {record.linkedin_url && (
          <PersonalInfoRow
            icon={<Linkedin className="w-4 h-4 text-muted-foreground" />}
            primary={
              <a
                className="underline hover:no-underline text-sm text-muted-foreground"
                href={record.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                title={record.linkedin_url}
              >
                LinkedIn
              </a>
            }
          />
        )}
        <ArrayField source="phone_jsonb">
          <SingleFieldList className="flex-col">
            <PersonalInfoRow
              icon={<Phone className="w-4 h-4 text-muted-foreground" />}
              primary={<TextField source="number" />}
              showType
            />
          </SingleFieldList>
        </ArrayField>
        {contactGender
          .map((genderOption) => {
            if (record.gender === genderOption.value) {
              return (
                <PersonalInfoRow
                  key={genderOption.value}
                  icon={
                    <genderOption.icon className="w-4 h-4 text-muted-foreground" />
                  }
                  primary={<span>{genderOption.label}</span>}
                />
              );
            }
            return null;
          })
          .filter(Boolean)}
      </AsideSection>
      <AsideSection title="Background info">
        <WithRecord<Contact>
          render={(record) =>
            record?.background ? (
              <TextField source="background" record={record} className="pb-2" />
            ) : null
          }
        />
        <div className="text-muted-foreground">
          <span className="text-sm">Added on</span>{" "}
          <DateField
            source="first_seen"
            options={{ year: "numeric", month: "long", day: "numeric" }}
          />
        </div>

        <div className="text-muted-foreground">
          <span className="text-sm">Last activity on</span>{" "}
          <DateField
            source="last_seen"
            options={{ year: "numeric", month: "long", day: "numeric" }}
          />
        </div>

        <div className="inline-flex text-muted-foreground">
          Followed by&nbsp;
          <ReferenceField source="sales_id" reference="sales">
            <SaleName />
          </ReferenceField>
        </div>
      </AsideSection>

      <AsideSection title="Tags">
        <TagsListEdit />
      </AsideSection>

      <AsideSection title="Tasks">
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

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => (
  <div className="flex flex-row items-center gap-2 min-h-6">
    {icon}
    <div className="flex flex-wrap gap-x-2 gap-y-0">
      {primary}
      {showType ? (
        <WithRecord
          render={(row) =>
            row.type !== "Other" && (
              <TextField source="type" className="text-muted-foreground" />
            )
          }
        />
      ) : null}
    </div>
  </div>
);
