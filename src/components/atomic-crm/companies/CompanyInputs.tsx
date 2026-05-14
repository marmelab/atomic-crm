import { required, useRecordContext, useTranslate } from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";

import ImageEditorField from "../misc/ImageEditorField";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Sale } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return {
      message: "crm.validation.invalid_url",
      args: { _: "Must be a valid URL" },
    };
  }
};

export const CompanyInputs = () => {
  const isMobile = useIsMobile();
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
        </div>
      </div>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="eswatini-compliance">
          <AccordionTrigger className="text-lg font-semibold py-2">
            {translate(
              "resources.companies.field_categories.eswatini_compliance",
              { _: "Eswatini Compliance" },
            )}
          </AccordionTrigger>
          <AccordionContent>
            <CompanyEswatiniInputs />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={record?.name.charAt(0)}
        linkPosition="bottom"
      />
      <TextInput
        source="name"
        className="w-full h-fit"
        validate={required()}
        helperText={false}
        placeholder={translate("resources.companies.fields.name", {
          _: "Company name",
        })}
      />
    </div>
  );
};

const CompanyContactInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.contact", {
          _: "Company info",
        })}
      </h6>
      <TextInput source="website" helperText={false} validate={isUrl} />
      <TextInput
        source="linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
      />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const CompanyContextInputs = () => {
  const translate = useTranslate();
  const { companySectors } = useConfigurationContext();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.context", {
          _: "Context",
        })}
      </h6>
      <SelectInput
        source="sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput source="size" choices={translatedSizes} helperText={false} />
      <TextInput source="revenue" helperText={false} />
      <TextInput source="tax_identifier" helperText={false} />
    </div>
  );
};

const CompanyAddressInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.address", {
          _: "Address",
        })}
      </h6>
      <TextInput source="address" helperText={false} />
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" helperText={false} />
      <TextInput source="state_abbr" helperText={false} />
      <TextInput source="country" helperText={false} />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.additional_info", {
          _: "Additional information",
        })}
      </h6>
      <TextInput source="description" multiline helperText={false} />
      <ArrayInput source="context_links" helperText={false}>
        <SimpleFormIterator disableReordering fullWidth getItemLabel={false}>
          <TextInput
            source=""
            label={false}
            helperText={false}
            validate={isUrl}
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput helperText={false} optionText={saleOptionRenderer} />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

const ENTITY_TYPE_CHOICES = [
  { id: "PTY_LTD", name: "Private Company (Pty) Ltd" },
  { id: "PUBLIC_CO", name: "Public Company" },
  { id: "SOLE_PROP", name: "Sole Proprietorship" },
  { id: "PARTNERSHIP", name: "Partnership" },
  { id: "TRUST", name: "Trust" },
  { id: "NGO", name: "NGO / Non-Profit" },
  { id: "OTHER", name: "Other" },
];

const VAT_FREQUENCY_CHOICES = [
  { id: "MONTHLY", name: "Monthly" },
  { id: "BIMONTHLY", name: "Bi-monthly" },
  { id: "QUARTERLY", name: "Quarterly" },
];

const MONTH_CHOICES = [
  { id: 1, name: "January" },
  { id: 2, name: "February" },
  { id: 3, name: "March" },
  { id: 4, name: "April" },
  { id: 5, name: "May" },
  { id: 6, name: "June" },
  { id: 7, name: "July" },
  { id: 8, name: "August" },
  { id: 9, name: "September" },
  { id: 10, name: "October" },
  { id: 11, name: "November" },
  { id: 12, name: "December" },
];

const CompanyEswatiniInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-4">
        <h6 className="text-base font-semibold text-muted-foreground">
          {translate("resources.companies.fields.entity_type", {
            _: "Registration",
          })}
        </h6>
        <TextInput
          source="tin"
          label={translate("resources.companies.fields.tin", {
            _: "TIN (Tax Identification Number)",
          })}
          helperText={false}
        />
        <TextInput
          source="registration_number"
          label={translate("resources.companies.fields.registration_number", {
            _: "Registration Number (CoI No.)",
          })}
          helperText={false}
        />
        <SelectInput
          source="entity_type"
          label={translate("resources.companies.fields.entity_type", {
            _: "Entity Type",
          })}
          choices={ENTITY_TYPE_CHOICES}
          helperText={false}
        />
        <SelectInput
          source="financial_year_end_month"
          label={translate(
            "resources.companies.fields.financial_year_end_month",
            { _: "Financial Year-End Month" },
          )}
          choices={MONTH_CHOICES}
          defaultValue={6}
          helperText={false}
        />
        <NumberInput
          source="employees_count"
          label={translate("resources.companies.fields.employees_count", {
            _: "Number of Employees",
          })}
          defaultValue={0}
          min={0}
          helperText={false}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h6 className="text-base font-semibold text-muted-foreground">
          Tax Registrations
        </h6>
        <BooleanInput
          source="vat_registered"
          label={translate("resources.companies.fields.vat_registered", {
            _: "VAT Registered",
          })}
          helperText={false}
        />
        <SelectInput
          source="vat_filing_frequency"
          label={translate("resources.companies.fields.vat_filing_frequency", {
            _: "VAT Filing Frequency",
          })}
          choices={VAT_FREQUENCY_CHOICES}
          helperText={false}
        />
        <BooleanInput
          source="paye_registered"
          label={translate("resources.companies.fields.paye_registered", {
            _: "PAYE Registered",
          })}
          helperText={false}
        />
        <BooleanInput
          source="sdl_registered"
          label={translate("resources.companies.fields.sdl_registered", {
            _: "SDL Registered",
          })}
          helperText={false}
        />
        <BooleanInput
          source="provisional_tax_registered"
          label={translate(
            "resources.companies.fields.provisional_tax_registered",
            { _: "Provisional Tax Registered" },
          )}
          helperText={false}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h6 className="text-base font-semibold text-muted-foreground">
          Licences &amp; Certificates
        </h6>
        <TextInput
          source="trading_license_number"
          label={translate(
            "resources.companies.fields.trading_license_number",
            {
              _: "Trading License Number",
            },
          )}
          helperText={false}
        />
        <DateInput
          source="trading_license_expiry"
          label={translate(
            "resources.companies.fields.trading_license_expiry",
            {
              _: "Trading License Expiry",
            },
          )}
          helperText={false}
        />
        <DateInput
          source="tax_clearance_certificate_expiry"
          label={translate(
            "resources.companies.fields.tax_clearance_certificate_expiry",
            { _: "Tax Clearance Certificate Expiry" },
          )}
          helperText={false}
        />
      </div>
    </div>
  );
};
