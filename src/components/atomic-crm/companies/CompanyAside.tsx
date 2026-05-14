import { Globe, Linkedin, Phone } from "lucide-react";
import {
  useGetIdentity,
  useLocaleState,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ShowButton } from "@/components/admin/show-button";
import { TextField } from "@/components/admin/text-field";
import { UrlField } from "@/components/admin/url-field";
import { SelectField } from "@/components/admin/select-field";

import { formatLocalizedDate } from "../misc/RelativeDate";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";
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

      <CompanyInfo record={record} />

      <AddressInfo record={record} />

      <ContextInfo record={record} />

      <AdditionalInfo record={record} />

      <EswatiniComplianceInfo record={record} />

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

export const CompanyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (!record.website && !record.linkedin_url && !record.phone_number) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.contact")}
    >
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
      {record.linkedin_url && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Linkedin className="w-4 h-4" />
          <a
            className="underline hover:no-underline"
            href={record.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            title={record.linkedin_url}
          >
            LinkedIn
          </a>
        </div>
      )}
      {record.phone_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <TextField source="phone_number" />
        </div>
      )}
    </AsideSection>
  );
};

export const ContextInfo = ({ record }: { record: Company }) => {
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  if (!record.revenue && !record.id) {
    return null;
  }

  const sector = companySectors.find((s) => s.value === record.sector);
  const sectorLabel = sector?.label;
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.context")}
    >
      {sectorLabel && (
        <span>
          {translate("resources.companies.fields.sector")}: {sectorLabel}
        </span>
      )}
      {record.size && (
        <span>
          {translate("resources.companies.fields.size")}:{" "}
          <SelectField source="size" choices={translatedSizes} />
        </span>
      )}
      {record.revenue && (
        <span>
          {translate("resources.companies.fields.revenue")}:{" "}
          <TextField source="revenue" />
        </span>
      )}
      {record.tax_identifier && (
        <span>
          {translate("resources.companies.fields.tax_identifier", {})}
          : <TextField source="tax_identifier" />
        </span>
      )}
    </AsideSection>
  );
};

export const AddressInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.address &&
    !record.city &&
    !record.zipcode &&
    !record.state_abbr
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.address")}
      noGap
    >
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="state_abbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  PTY_LTD: "Private Company (Pty) Ltd",
  PUBLIC_CO: "Public Company",
  SOLE_PROP: "Sole Proprietorship",
  PARTNERSHIP: "Partnership",
  TRUST: "Trust",
  NGO: "NGO / Non-Profit",
  OTHER: "Other",
};

export const EswatiniComplianceInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const hasData =
    record.tin ||
    record.registration_number ||
    record.entity_type ||
    record.vat_registered ||
    record.paye_registered ||
    record.sdl_registered ||
    record.provisional_tax_registered ||
    record.trading_license_number ||
    record.trading_license_expiry ||
    record.tax_clearance_certificate_expiry ||
    (record.employees_count != null && record.employees_count > 0);
  if (!hasData) return null;

  return (
    <AsideSection
      title={translate(
        "resources.companies.field_categories.eswatini_compliance",
        { _: "Eswatini Compliance" },
      )}
    >
      {record.tin && (
        <span>
          {translate("resources.companies.fields.tin", { _: "TIN" })}:{" "}
          {record.tin}
        </span>
      )}
      {record.registration_number && (
        <span>
          {translate("resources.companies.fields.registration_number", {
            _: "Reg. No.",
          })}
          : {record.registration_number}
        </span>
      )}
      {record.entity_type && (
        <span>
          {translate("resources.companies.fields.entity_type", {
            _: "Entity Type",
          })}
          : {ENTITY_TYPE_LABELS[record.entity_type] ?? record.entity_type}
        </span>
      )}
      {record.financial_year_end_month != null && (
        <span>
          {translate("resources.companies.fields.financial_year_end_month", {
            _: "FY-End",
          })}
          : {MONTH_NAMES[(record.financial_year_end_month ?? 6) - 1]}
        </span>
      )}
      {record.employees_count != null && record.employees_count > 0 && (
        <span>
          {translate("resources.companies.fields.employees_count", {
            _: "Employees",
          })}
          : {record.employees_count}
        </span>
      )}
      {record.vat_registered && (
        <span>
          {translate("resources.companies.fields.vat_registered", {
            _: "VAT Registered",
          })}
          {record.vat_filing_frequency &&
            ` (${record.vat_filing_frequency.toLowerCase()})`}
        </span>
      )}
      {record.paye_registered && (
        <span>
          {translate("resources.companies.fields.paye_registered", {
            _: "PAYE Registered",
          })}
        </span>
      )}
      {record.sdl_registered && (
        <span>
          {translate("resources.companies.fields.sdl_registered", {
            _: "SDL Registered",
          })}
        </span>
      )}
      {record.provisional_tax_registered && (
        <span>
          {translate("resources.companies.fields.provisional_tax_registered", {
            _: "Provisional Tax",
          })}
        </span>
      )}
      {record.trading_license_number && (
        <span>
          {translate("resources.companies.fields.trading_license_number", {
            _: "Trading Lic.",
          })}
          : {record.trading_license_number}
          {record.trading_license_expiry &&
            ` (exp. ${record.trading_license_expiry})`}
        </span>
      )}
      {record.tax_clearance_certificate_expiry && (
        <span>
          {translate(
            "resources.companies.fields.tax_clearance_certificate_expiry",
            { _: "Tax Clearance Exp." },
          )}
          : {record.tax_clearance_certificate_expiry}
        </span>
      )}
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
