import { Globe, Linkedin, Phone } from "lucide-react";
import { useRecordContext } from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { ShowButton } from "@/components/admin/show-button";
import { TextField } from "@/components/admin/text-field";
import { DateField } from "@/components/admin/date-field";
import { UrlField } from "@/components/admin/url-field";
import { SelectField } from "@/components/admin/select-field";

import { AsideSection } from "../misc/AsideSection";
import { SaleName } from "../sales/SaleName";
import type { Company } from "../types";
import { sizes } from "./sizes";

interface CompanyAsideProps {
  link?: string;
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  if (!record) return null;

  return (
    <div className="hidden sm:block w-[250px] min-w-[250px] space-y-4">
      <div className="flex flex-row space-x-1">
        {link === "edit" ? (
          <EditButton label="Edit Company" />
        ) : (
          <ShowButton label="Show Company" />
        )}
      </div>

      <CompanyInfo record={record} />

      <AddressInfo record={record} />

      <ContextInfo record={record} />

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

const CompanyInfo = ({ record }: { record: Company }) => {
  if (!record.website && !record.linkedin_url && !record.phone_number) {
    return null;
  }

  return (
    <AsideSection title="Company Info">
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

const ContextInfo = ({ record }: { record: Company }) => {
  if (!record.revenue && !record.id) {
    return null;
  }

  return (
    <AsideSection title="Context">
      {record.sector && (
        <span>
          Sector: <TextField source="sector" />
        </span>
      )}
      {record.size && (
        <span>
          Size: <SelectField source="size" choices={sizes} />
        </span>
      )}
      {record.revenue && (
        <span>
          Revenue: <TextField source="revenue" />
        </span>
      )}
      {record.tax_identifier && (
        <span>
          Tax Identifier: <TextField source="tax_identifier" />
        </span>
      )}
    </AsideSection>
  );
};

const AddressInfo = ({ record }: { record: Company }) => {
  if (!record.address && !record.city && !record.zipcode && !record.stateAbbr) {
    return null;
  }

  return (
    <AsideSection title="Main Address" noGap>
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="stateAbbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

const AdditionalInfo = ({ record }: { record: Company }) => {
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
    <AsideSection title="Additional Info">
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
          Followed by&nbsp;
          <ReferenceField source="sales_id" reference="sales" record={record}>
            <SaleName />
          </ReferenceField>
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          Added on{" "}
          <DateField
            source="created_at"
            record={record}
            options={{
              year: "numeric",
              month: "long",
              day: "numeric",
            }}
          />
        </p>
      )}
    </AsideSection>
  );
};
