import { Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { Link } from "react-router";
import {
  useGetIdentity,
  useGetList,
  useLocaleState,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ShowButton } from "@/components/admin/show-button";
import { TextField } from "@/components/admin/text-field";
import { UrlField } from "@/components/admin/url-field";

import { formatLocalizedDate } from "../misc/RelativeDate";
import { AsideSection } from "../misc/AsideSection";
import type { Company, Contact } from "../types";
import { useCompanySectors } from "./useCompanySectors";
import { useGetSalesName } from "../sales/useGetSalesName";

interface CompanyAsideProps {
  link?: string;
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  if (!record) return null;

  return (
    <div className="hidden sm:block w-92 min-w-92 space-y-4">
      <div className="flex flex-row space-x-1">
        {link === "edit" ? (
          <EditButton label={translate("resources.companies.action.edit")} />
        ) : (
          <ShowButton label={translate("resources.companies.action.show")} />
        )}
      </div>

      <ContextInfo record={record} />

      <CompanyInfo record={record} />

      <PitchInfo record={record} />

      <AdditionalInfo record={record} />

      {link !== "edit" && (
        <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
          <DeleteButton
            className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            size="sm"
          />
        </div>
      )}
    </div>
  );
};

/** The company's primary contact, managed in the Contacts section of the form. */
export const CompanyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const { data } = useGetList<Contact>("contacts", {
    filter: { company_id: record.id, is_primary: true },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  const primary = data?.[0];
  if (!primary && !record.website) {
    return null;
  }

  const mobile = primary?.phone_jsonb?.[0]?.number;
  const email = primary?.email_jsonb?.[0]?.email;

  return (
    <AsideSection
      title={translate("resources.companies.contacts.primary", {
        _: "Primary contact",
      })}
    >
      {primary && (
        <Link
          to={`/contacts/${primary.id}/show`}
          className="font-medium underline hover:no-underline"
        >
          {[primary.first_name, primary.last_name].filter(Boolean).join(" ")}
        </Link>
      )}
      {primary?.title && (
        <span className="text-sm text-muted-foreground">{primary.title}</span>
      )}
      {mobile && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <a className="underline hover:no-underline" href={`tel:${mobile}`}>
            {mobile}
          </a>
        </div>
      )}
      {primary?.whatsapp_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <MessageCircle className="w-4 h-4" />
          <a
            className="underline hover:no-underline"
            href={`https://wa.me/${primary.whatsapp_number.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {primary.whatsapp_number}
          </a>
        </div>
      )}
      {email && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Mail className="w-4 h-4" />
          <a className="underline hover:no-underline" href={`mailto:${email}`}>
            {email}
          </a>
        </div>
      )}
      {record.website && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Globe className="w-4 h-4" />
          <UrlField
            source="website"
            target="_blank"
            rel="noopener"
            content={record.website
              .replace("http://", "")
              .replace("https://", "")}
          />
        </div>
      )}
    </AsideSection>
  );
};

export const ContextInfo = ({ record }: { record: Company }) => {
  const { sectors } = useCompanySectors();
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const sectorLabel =
    sectors.find((s) => s.value === record.sector)?.label ?? record.sector;
  if (
    !record.lead_date &&
    !sectorLabel &&
    !record.city &&
    !record.phone_number &&
    !record.email &&
    !record.whatsapp_number &&
    !record.priority
  ) {
    return null;
  }

  const priorityLabel =
    record.priority === "high"
      ? "High"
      : record.priority === "low"
        ? "Low"
        : record.priority === "medium"
          ? "Medium"
          : record.priority;

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.lead")}
    >
      {record.lead_date && (
        <span>
          {translate("resources.companies.fields.lead_date")}:{" "}
          {formatLocalizedDate(`${record.lead_date}T00:00:00`, locale)}
        </span>
      )}
      {record.phone_number && (
        <span>
          {translate("resources.companies.fields.phone_number")}:{" "}
          {record.phone_number}
        </span>
      )}
      {record.email && (
        <span>
          {translate("resources.companies.fields.email")}: {record.email}
        </span>
      )}
      {record.whatsapp_number && (
        <span>
          {translate("resources.companies.fields.whatsapp_number")}:{" "}
          {record.whatsapp_number}
        </span>
      )}
      {sectorLabel && (
        <span>
          {translate("resources.companies.fields.sector")}: {sectorLabel}
        </span>
      )}
      {record.city && (
        <span>
          {translate("resources.companies.fields.city")}:{" "}
          <TextField source="city" />
        </span>
      )}
      {priorityLabel && (
        <span>
          {translate("resources.companies.fields.priority")}: {priorityLabel}
        </span>
      )}
    </AsideSection>
  );
};

export const PitchInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (!record.pitch_point) {
    return null;
  }

  return (
    <AsideSection title={translate("resources.companies.fields.pitch_point")}>
      <p className="text-sm whitespace-pre-line">{record.pitch_point}</p>
    </AsideSection>
  );
};

export const AdditionalInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const isCurrentUser = record.sales_id === identity?.id;
  const salesName = useGetSalesName(record.sales_id, {
    enabled: !isCurrentUser,
  });
  if (
    !record.created_at &&
    !record.sales_id &&
    !record.description &&
    !record.context_links
  ) {
    return null;
  }
  const getBaseURL = (url: string) => {
    const urlObject = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObject.hostname;
  };

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.additional_info")}
    >
      {record.description && (
        <p className="text-sm  mb-1">{record.description}</p>
      )}
      {record.context_links && (
        <div className="flex flex-col">
          {record.context_links.map((link, index) =>
            link ? (
              <a
                key={index}
                className="text-sm underline hover:no-underline mb-1"
                href={link.startsWith("http") ? link : `https://${link}`}
                target="_blank"
                rel="noopener noreferrer"
                title={link}
              >
                {getBaseURL(link)}
              </a>
            ) : null,
          )}
        </div>
      )}
      {record.sales_id !== null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          {translate(
            isCurrentUser
              ? "resources.companies.followed_by_you"
              : "resources.companies.followed_by",
            { name: salesName },
          )}
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          {translate("resources.companies.added_on", {
            date: formatLocalizedDate(record.created_at, locale),
          })}{" "}
        </p>
      )}
    </AsideSection>
  );
};
