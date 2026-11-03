import { useState } from "react";
import { useRecordContext, useTranslate, WithRecord } from "ra-core";
import { ArrayField } from "@/components/admin/array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { EmailField } from "@/components/admin/email-field";
import { Mail, Phone, Linkedin, Check } from "lucide-react";
import type { ReactNode } from "react";
import {
  contactGender,
  translateContactGenderLabel,
  translatePersonalInfoTypeLabel,
} from "./contactModel";
import type { Contact } from "../types";

export const ContactPersonalInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;

  return (
    <div>
      <ArrayField source="email_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <EmailRow />
        </SingleFieldList>
      </ArrayField>

      {record.has_newsletter && (
        <p className="pl-6 py-1 text-sm text-muted-foreground">
          {translate("resources.contacts.fields.has_newsletter")}
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
        <SingleFieldList className="flex-col gap-y-0">
          <PhoneRow />
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
                primary={
                  <div>
                    {translateContactGenderLabel(genderOption, translate)}
                  </div>
                }
              />
            );
          }
          return null;
        })
        .filter(Boolean)}
    </div>
  );
};

const EmailRow = () => {
  const record = useRecordContext<{ email: string }>();
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <PersonalInfoRow
      icon={
        <button
          type="button"
          onClick={handleCopy}
          title={translate("crm.common.copy")}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
        </button>
      }
      primary={<EmailField source="email" />}
    />
  );
};

// tel: lets a phone offer to call or text the number. An extension
// ("x123", "ext. 123") becomes a pause, which dialers send once connected.
const toTelHref = (number: string) =>
  `tel:${number
    .replace(/\s*(?:x|ext\.?)\s*(\d+)\s*$/i, ",$1")
    .replace(/[^\d+,]/g, "")}`;

const PhoneRow = () => {
  const record = useRecordContext<{ number: string }>();

  if (!record) return null;

  return (
    <PersonalInfoRow
      icon={<Phone className="w-4 h-4 text-muted-foreground" />}
      primary={
        <a
          className="underline hover:no-underline"
          href={toTelHref(record.number)}
        >
          {record.number}
        </a>
      }
      showType
    />
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
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-row items-center gap-x-2 py-1 min-h-6">
      {icon}
      <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm">
        {primary}
        {showType ? (
          <WithRecord
            render={(row) =>
              row.type !== "Other" && (
                <span className="text-muted-foreground">
                  {translatePersonalInfoTypeLabel(row.type, translate)}
                </span>
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
};
